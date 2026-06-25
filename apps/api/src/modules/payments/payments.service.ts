import { Inject, Injectable, NotFoundException, BadRequestException, UnauthorizedException, forwardRef } from '@nestjs/common';
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
import { RefundsService } from '../refunds/refunds.service';
import { SplitBillsService } from '../split-bills/split-bills.service';

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
    // forwardRef-ed because RefundsService also depends on this
    // module (RazorpayService). See the module wiring for the cycle.
    @Inject(forwardRef(() => RefundsService))
    private refunds: RefundsService,
    // Same forwardRef pattern — SplitBillsService listens for share
    // settlements via this service's confirmPayment hook below.
    @Inject(forwardRef(() => SplitBillsService))
    private splitBills: SplitBillsService,
  ) {}

  async initiatePayment(
    orderId: string,
    mode: PaymentMode,
    amount: number,
    userId?: string,
    splitShareId?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    // Split-share payment guardrails. The customer PWA's split pay
    // page passes splitShareId so the Payment row links back to the
    // share via @@unique Payment.splitShareId. Reject duplicates +
    // mismatched amounts to keep reconciliation honest.
    if (splitShareId) {
      const share = await this.prisma.splitShare.findUnique({
        where: { id: splitShareId },
        select: { orderId: true, status: true, amount: true, paymentId: true },
      });
      if (!share) throw new NotFoundException('Split share not found');
      if (share.orderId !== orderId) {
        throw new BadRequestException('Split share does not belong to this order');
      }
      if (share.status === 'PAID' || share.paymentId) {
        throw new BadRequestException('Split share already paid');
      }
      if (share.status === 'CANCELLED' || share.status === 'EXPIRED') {
        throw new BadRequestException(`Split share is ${share.status}`);
      }
      if (Math.abs(Number(share.amount) - amount) > 0.005) {
        throw new BadRequestException(
          `Payment amount ₹${amount.toFixed(2)} does not match share amount ₹${Number(share.amount).toFixed(2)}`,
        );
      }
    }
    // Truly terminal states — payment makes no sense once the order
    // was cancelled or fully refunded.
    if (['CANCELLED', 'RESOLVED', 'REFUND_COMPLETE'].includes(order.status)) {
      throw new BadRequestException('Order is in a terminal state and cannot accept payment');
    }
    // SERVED used to be in the terminal list too, but postpaid table
    // orders legitimately reach SERVED before the customer asks for
    // the bill (every item physically delivered → rollup to SERVED).
    // Split-bill support: multiple partial payments are allowed as
    // long as the cumulative SUCCESS-paid amount stays within the
    // order's totalAmount. Refunds don't reduce the paid sum here —
    // they have their own reversal flow and don't restore the
    // payable balance.
    const paidAgg = await this.prisma.payment.aggregate({
      where: { orderId, status: 'SUCCESS', isRefund: false },
      _sum: { amount: true },
    });
    const paidSum = Number(paidAgg._sum.amount ?? 0);
    const orderTotal = Number(order.totalAmount);
    const remaining = orderTotal - paidSum;
    // Half-cent tolerance covers decimal-arithmetic drift from
    // earlier partials totalling exactly to the order amount.
    if (remaining <= 0.005) {
      throw new BadRequestException('Order has already been paid');
    }
    if (amount > remaining + 0.005) {
      throw new BadRequestException(
        `Amount ₹${amount.toFixed(2)} exceeds outstanding balance ₹${remaining.toFixed(2)}`,
      );
    }
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
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
      data: { orderId, mode, amount, status: 'PENDING', cashierShiftId, splitShareId: splitShareId ?? null },
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
    //
    // When the Payment is settling a split-bill share (splitShareId
    // set at initiate time by the customer PWA's split-share pay
    // flow), the share row + parent order's denormalised counters
    // are updated inside the same transaction. Doing the writes
    // inline here also means SPLIT_ALL_PAID fires from
    // SplitBillsService.applyShareSettled before the response returns,
    // so the diner who just paid the final share gets their
    // "all paid" confirmation in the same WhatsApp round-trip.
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          gatewayRef: this.encryption.encrypt(gatewayRef),
        },
      });
      if (u.splitShareId) {
        const share = await tx.splitShare.findUnique({ where: { id: u.splitShareId } });
        if (share) {
          await this.splitBills.applyShareSettled(tx, share, u.id);
        }
      }
      return u;
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
    // Razorpay fires refund.processed when the money has actually moved
    // back to the customer's instrument. We match the entity.id against
    // the Refund row's stored gatewayRef and flip it COMPLETED — the
    // sibling Payment.isRefund row gets minted there so reports + Z
    // report's refund block update without any extra plumbing.
    if (event === 'refund.processed') {
      const razorpayRefundId = payload.payload?.refund?.entity?.id;
      if (razorpayRefundId) {
        await this.refunds.markCompletedByGatewayRef(razorpayRefundId);
      }
    }
    if (event === 'refund.failed') {
      const razorpayRefundId = payload.payload?.refund?.entity?.id;
      const errorDescription = payload.payload?.refund?.entity?.error_description;
      if (razorpayRefundId) {
        await this.refunds.markFailedByGatewayRef(razorpayRefundId, errorDescription);
      }
    }
    return { received: true };
  }
}
