"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const orders_gateway_1 = require("../orders/orders.gateway");
const orders_service_1 = require("../orders/orders.service");
const client_1 = require("@prisma/client");
const lifecycle_dispatcher_service_1 = require("../customer-alerts/lifecycle-dispatcher.service");
const razorpay_service_1 = require("./razorpay.service");
let PaymentsService = class PaymentsService {
    constructor(prisma, ordersGateway, dispatcher, razorpay, orders) {
        this.prisma = prisma;
        this.ordersGateway = ordersGateway;
        this.dispatcher = dispatcher;
        this.razorpay = razorpay;
        this.orders = orders;
    }
    async initiatePayment(orderId, mode, amount) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (['SERVED', 'CANCELLED', 'RESOLVED', 'REFUND_COMPLETE'].includes(order.status)) {
            throw new common_1.BadRequestException('Order is in a terminal state and cannot accept payment');
        }
        const payment = await this.prisma.payment.create({
            data: { orderId, mode, amount, status: 'PENDING' },
        });
        if (mode === client_1.PaymentMode.CASH) {
            return this.confirmPayment(payment.id, null);
        }
        return { paymentId: payment.id, amount, mode, orderId };
    }
    async confirmPayment(paymentId, gatewayRef) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { order: true },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: 'SUCCESS', gatewayRef },
        });
        this.ordersGateway.emitPaymentConfirmed(payment.order.outletId, updated);
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
            }).catch(() => { });
            this.orders.tryEarnRewards(payment.order.id, payment.order.customerId, payment.order.outletId, Number(payment.order.subtotal)).catch(() => { });
        }
        return updated;
    }
    async failPayment(paymentId, reason) {
        return this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: 'FAILED', gatewayResponse: { reason } },
        });
    }
    async getPaymentsByOrder(orderId) {
        return this.prisma.payment.findMany({ where: { orderId } });
    }
    async createRazorpayOrder(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { order: { include: { outlet: { select: { name: true } } } } },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.status !== 'PENDING') {
            throw new common_1.BadRequestException('Payment is not in PENDING state');
        }
        const order = await this.razorpay.createOrder({
            amountInRupees: Number(payment.amount),
            receipt: `pay_${payment.id}`,
            notes: { paymentId: payment.id, orderId: payment.orderId },
        });
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                gatewayRef: order.id,
                gatewayResponse: { provider: 'razorpay', order },
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
    async verifyRazorpayPayment(input) {
        const payment = await this.prisma.payment.findUnique({ where: { id: input.paymentId } });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.gatewayRef !== input.razorpayOrderId) {
            throw new common_1.BadRequestException('Razorpay order id mismatch');
        }
        const ok = this.razorpay.verifyHandlerSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
        if (!ok)
            throw new common_1.UnauthorizedException('Invalid Razorpay signature');
        return this.confirmPayment(payment.id, input.razorpayPaymentId);
    }
    async handleRazorpayWebhook(payload, signature, rawBody) {
        if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
            throw new common_1.UnauthorizedException('Invalid webhook signature');
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
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_gateway_1.OrdersGateway,
        lifecycle_dispatcher_service_1.LifecycleDispatcherService,
        razorpay_service_1.RazorpayService,
        orders_service_1.OrdersService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map