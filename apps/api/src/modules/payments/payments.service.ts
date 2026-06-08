import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { PaymentMode } from '@prisma/client';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';
import { RazorpayService } from './razorpay.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
    private dispatcher: LifecycleDispatcherService,
    private razorpay: RazorpayService,
    private orders: OrdersService,
  ) {}

  async initiatePayment(orderId: string, mode: PaymentMode, amount: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (['SERVED', 'CANCELLED', 'RESOLVED', 'REFUND_COMPLETE'].includes(order.status)) {
      throw new BadRequestException('Order is in a terminal state and cannot accept payment');
    }

    const payment = await this.prisma.payment.create({
      data: { orderId, mode, amount, status: 'PENDING' },
    });

    // For cash payments, auto-confirm
    if (mode === PaymentMode.CASH) {
      return this.confirmPayment(payment.id, null);
    }

    // For other modes, return payment details to initiate gateway flow
    return { paymentId: payment.id, amount, mode, orderId };
  }

  async confirmPayment(paymentId: string, gatewayRef: string | null) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCESS', gatewayRef },
    });

    // Order status is driven by the kitchen/service workflow, not by payment.
    // Payment success is recorded on the Payment record itself.

    this.ordersGateway.emitPaymentConfirmed(payment.order.outletId, updated);

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
      data: { status: 'FAILED', gatewayResponse: { reason } },
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
            outlet: { select: { name: true, razorpayLinkedAccountId: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not in PENDING state');
    }

    // Razorpay Route — when the outlet has a Linked Account configured,
    // route the full payment to that account on capture (Razorpay
    // deducts the gateway fee from the source so the LA receives the
    // gross amount net of fees). When no LA is set we fall back to a
    // plain order; settlement lands in the platform account.
    const outletLA = payment.order.outlet?.razorpayLinkedAccountId;
    const order = outletLA
      ? await this.razorpay.createRouteOrder({
          amountInRupees: Number(payment.amount),
          receipt: `pay_${payment.id}`,
          notes: { paymentId: payment.id, orderId: payment.orderId },
          transfers: [{
            account: outletLA,
            amountInRupees: Number(payment.amount),
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
        gatewayRef: order.id,
        gatewayResponse: { provider: 'razorpay', order } as any,
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
    if (payment.gatewayRef !== input.razorpayOrderId) {
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
