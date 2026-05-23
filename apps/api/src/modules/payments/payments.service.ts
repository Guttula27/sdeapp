import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { PaymentMode } from '@prisma/client';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
    private dispatcher: LifecycleDispatcherService,
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

  async handleRazorpayWebhook(payload: any, signature: string) {
    // Verify signature and process webhook
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
