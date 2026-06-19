import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { PaymentMode } from '@prisma/client';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';
import { RazorpayService } from './razorpay.service';
import {
  PlatformSettingsService,
  computePlatformFee,
} from '../platform-settings/platform-settings.service';
import { AuditLogService } from '../../config/logger/audit-log.service';
import { EncryptionService } from '../../config/crypto/encryption.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
    private dispatcher: LifecycleDispatcherService,
    private razorpay: RazorpayService,
    private orders: OrdersService,
    private platformSettings: PlatformSettingsService,
    private audit: AuditLogService,
    private encryption: EncryptionService,
  ) {}

  async initiatePayment(
    orderId: string,
    mode: PaymentMode,
    amount: number,
    userId?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    // Truly terminal states — payment makes no sense once the order
    // was cancelled or fully refunded.
    if (['CANCELLED', 'RESOLVED', 'REFUND_COMPLETE'].includes(order.status)) {
      throw new BadRequestException('Order is in a terminal state and cannot accept payment');
    }
    // SERVED used to be in the terminal list too, but postpaid table
    // orders legitimately reach SERVED before the customer asks for
    // the bill (every item physically delivered → rollup to SERVED).
    // Guard against double-payment by checking whether a SUCCESS
    // payment already exists — that's the real "this is done" signal,
    // not the order's status.
    const paidAlready = await this.prisma.payment.count({
      where: { orderId, status: 'SUCCESS' },
    });
    if (paidAlready > 0) {
      throw new BadRequestException('Order has already been paid');
    }

    // Tag the payment with whoever's drawer settles it AT INITIATE time
    // (cash auto-confirms below; gateway flows confirm via webhook
    // with no user context, but the initiating cashier's drawer is
    // who owns the collection). The Z report groups revenue by
    // Payment.cashierShiftId — NOT Order.cashierShiftId — because a
    // tab opened in one shift can be billed in another.
    let cashierShiftId: string | null = null;
    if (userId) {
      const drawer = await this.prisma.cashierShift.findFirst({
        where: { outletId: order.outletId, cashierId: userId, status: 'ACTIVE' },
        select: { id: true },
      });
      cashierShiftId = drawer?.id ?? null;
    }

    const payment = await this.prisma.payment.create({
      data: { orderId, mode, amount, status: 'PENDING', cashierShiftId },
    });

    // For cash payments, auto-confirm
    if (mode === PaymentMode.CASH) {
      return this.confirmPayment(payment.id, null);
    }

    // For other modes, return payment details to initiate gateway flow
    return { paymentId: payment.id, amount, mode, orderId };
  }

  async confirmPayment(paymentId: string, gatewayRef: string | null, _userId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // cashierShiftId is intentionally NOT updated here. It's stamped
    // at initiate-time when the cashier triggers the flow, so the
    // webhook (which has no user context) doesn't need to know who
    // owns the drawer.
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCESS',
        gatewayRef: this.encryption.encrypt(gatewayRef),
      },
    });

    // Order status is driven by the kitchen/service workflow, not by payment.
    // Payment success is recorded on the Payment record itself.

    this.ordersGateway.emitPaymentConfirmed(payment.order.outletId, updated);
    this.audit.paymentConfirmed({
      paymentId: updated.id,
      orderId: updated.orderId,
      amount: Number(updated.amount),
      mode: updated.mode,
      gatewayRef: this.encryption.decrypt(updated.gatewayRef) ?? null,
    });

    // Lifecycle: PAYMENT_RECEIVED. Skip for guest/walk-in orders (no customerId).
    if (payment.order.customerId) {
      const outlet = await this.prisma.outlet.findUnique({
        where: { id: payment.order.outletId },
        select: { name: true, businessId: true },
      });
      this.dispatcher.fire('PAYMENT_RECEIVED', {
        customerId: payment.order.customerId,
        businessId: outlet?.businessId ?? null,
        outletId: payment.order.outletId,
        outletName: outlet?.name,
        orderId: payment.order.id,
        orderNumber: payment.order.orderNumber,
        amount: payment.amount.toString(),
      }).catch(() => {});

      // Reward earning — fired here for the deferred-payment path (online
      // gateways). Idempotent: tryEarnRewards short-circuits if an EARN
      // transaction for this order already exists, so duplicate webhooks
      // and retries are safe.
      this.orders.tryEarnRewards(
        payment.order.id,
        payment.order.customerId,
        payment.order.outletId,
        Number(payment.order.subtotal),
      ).catch(() => {});
    }
    return updated;
  }

  async failPayment(paymentId: string, reason?: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      // gatewayResponse stays Json? in the schema, but the inner blob
      // is encrypted to keep webhook bodies / handler payloads opaque
      // at rest. Stored as { enc: "enc:v1:..." } so the Prisma type
      // stays Json without a schema change.
      data: { status: 'FAILED', gatewayResponse: { enc: this.encryption.encryptJson({ reason }) } as any },
    });
  }

  async getPaymentsByOrder(orderId: string) {
    return this.prisma.payment.findMany({ where: { orderId } });
  }

  // Create a Razorpay order for an existing PENDING Payment. We persist the
  // razorpay order id on the gatewayResponse so the verify endpoint can
  // cross-check it against the handler payload.
  async createRazorpayOrder(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            outlet: { select: { name: true, businessId: true, razorpayLinkedAccountId: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not in PENDING state');
    }

    // Razorpay Route — when the outlet has a Linked Account configured,
    // the full ticket value is captured into the paynpik master account
    // and we route (total − platform fee) to the outlet's LA. The
    // master account keeps the fee (which covers Razorpay's gateway
    // charge and the platform's margin). When no LA is set we fall
    // back to a plain order; settlement lands in the master account
    // and no transfer fires.
    // razorpayLinkedAccountId is encrypted at rest; decrypt before
    // handing the plaintext acc_... id to Razorpay's Route API.
    const outletLA = this.encryption.decrypt(payment.order.outlet?.razorpayLinkedAccountId);
    let resolvedFee = 0;
    let transferable = Number(payment.amount);
    if (outletLA) {
      const feeCfg = await this.platformSettings.feeForBusiness(payment.order.outlet?.businessId);
      const calc = computePlatformFee(Number(payment.amount), feeCfg);
      resolvedFee = calc.fee;
      transferable = calc.transferable;
    }

    const order = outletLA
      ? await this.razorpay.createRouteOrder({
          amountInRupees: Number(payment.amount),
          receipt: `pay_${payment.id}`,
          notes: {
            paymentId: payment.id,
            orderId: payment.orderId,
            platformFee: resolvedFee.toFixed(2),
          },
          transfers: [{
            account: outletLA,
            amountInRupees: transferable,
            notes: { paymentId: payment.id, orderId: payment.orderId },
          }],
        })
      : await this.razorpay.createOrder({
          amountInRupees: Number(payment.amount),
          receipt: `pay_${payment.id}`,
          notes: { paymentId: payment.id, orderId: payment.orderId },
        });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        gatewayRef: this.encryption.encrypt(order.id),
        gatewayResponse: {
          enc: this.encryption.encryptJson({ provider: 'razorpay', order }),
        } as any,
      },
    });

    return {
      paymentId: payment.id,
      keyId: this.razorpay.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      outletName: payment.order.outlet?.name ?? 'Outlet',
    };
  }

  async verifyRazorpayPayment(input: {
    paymentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const payment = await this.prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    // gatewayRef is encrypted at rest — compare against the decrypted
    // value so the verify endpoint still matches the handler's plaintext.
    if (this.encryption.decrypt(payment.gatewayRef) !== input.razorpayOrderId) {
      throw new BadRequestException('Razorpay order id mismatch');
    }
    const ok = this.razorpay.verifyHandlerSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );
    if (!ok) throw new UnauthorizedException('Invalid Razorpay signature');
    return this.confirmPayment(payment.id, input.razorpayPaymentId);
  }

  async handleRazorpayWebhook(payload: any, signature: string, rawBody: string) {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const event = payload.event;
    if (event === 'payment.captured') {
      const paymentId = payload.payload?.payment?.entity?.notes?.paymentId;
      const gatewayRef = payload.payload?.payment?.entity?.id;
      if (paymentId) {
        return this.confirmPayment(paymentId, gatewayRef);
      }
    }
    return { received: true };
  }
}
