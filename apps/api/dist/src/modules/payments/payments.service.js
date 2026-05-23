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
const client_1 = require("@prisma/client");
const lifecycle_dispatcher_service_1 = require("../customer-alerts/lifecycle-dispatcher.service");
let PaymentsService = class PaymentsService {
    constructor(prisma, ordersGateway, dispatcher) {
        this.prisma = prisma;
        this.ordersGateway = ordersGateway;
        this.dispatcher = dispatcher;
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
    async handleRazorpayWebhook(payload, signature) {
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
        lifecycle_dispatcher_service_1.LifecycleDispatcherService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map