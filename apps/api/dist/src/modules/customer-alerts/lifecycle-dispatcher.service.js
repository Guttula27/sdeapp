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
var LifecycleDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifecycleDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const orders_gateway_1 = require("../orders/orders.gateway");
const FALLBACK_BODIES = {
    ORDER_PLACED: 'Hi {{customer_name}}, your order *{{order_number}}* at {{outlet_name}} has been placed.\n\n' +
        '*Items*\n{{items_list}}\n\n' +
        'Total: *{{total}}*\nToken: {{token_number}}\n\n' +
        'View receipt: {{receipt_url}}',
    PAYMENT_RECEIVED: 'Payment of ₹{{amount}} received for order {{order_number}}.',
    ITEM_READY: 'Your {{item}} is ready (order {{order_number}}).',
    ORDER_READY: 'Your order {{order_number}} is ready.',
    PICKUP_READY: 'Your parcel order {{order_number}} is packed and ready for pickup at {{outlet_name}}.',
    ORDER_SERVED: 'Order {{order_number}} has been served. Enjoy!',
};
const TITLES = {
    ORDER_PLACED: 'Order placed',
    PAYMENT_RECEIVED: 'Payment received',
    ITEM_READY: 'Item ready',
    ORDER_READY: 'Order ready',
    PICKUP_READY: 'Ready for pickup',
    ORDER_SERVED: 'Order served',
};
function render(body, vars) {
    return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
        const v = vars[key];
        return v === undefined || v === null ? '' : String(v);
    });
}
let LifecycleDispatcherService = LifecycleDispatcherService_1 = class LifecycleDispatcherService {
    constructor(prisma, notifications, ordersGateway) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.ordersGateway = ordersGateway;
        this.logger = new common_1.Logger(LifecycleDispatcherService_1.name);
    }
    async resolveTemplateBody(trigger, channel, businessId, outletId) {
        const where = {
            trigger,
            channel,
            approvalStatus: 'APPROVED',
        };
        const candidates = await this.prisma.messageTemplate.findMany({
            where: {
                ...where,
                OR: [
                    { scope: 'OUTLET', outletId: outletId ?? undefined },
                    { scope: 'BUSINESS', businessId: businessId ?? undefined },
                    { scope: 'PLATFORM' },
                ],
            },
        });
        const byScope = (s) => candidates.find((c) => c.scope === s);
        const picked = byScope('OUTLET') || byScope('BUSINESS') || byScope('PLATFORM');
        return picked?.body || FALLBACK_BODIES[trigger];
    }
    async whatsappProvider() {
        return this.prisma.integrationConfig.findFirst({
            where: { channel: 'WHATSAPP', isActive: true, isDefault: true },
        });
    }
    async fire(trigger, ctx) {
        if (!ctx.customerId)
            return;
        const customer = await this.prisma.user.findUnique({
            where: { id: ctx.customerId },
            select: { name: true, phone: true, alertRingtone: true },
        });
        if (!customer)
            return;
        const body = await this.resolveTemplateBody(trigger, 'WHATSAPP', ctx.businessId, ctx.outletId);
        const itemsList = (ctx.items ?? [])
            .map((it) => `• ${it.name} × ${it.quantity} — ₹${Number(it.total).toFixed(0)}`)
            .join('\n');
        const rendered = render(body, {
            customer_name: ctx.customerName ?? customer.name,
            order_number: ctx.orderNumber,
            order_id: ctx.orderId,
            item: ctx.itemName,
            outlet_name: ctx.outletName,
            amount: ctx.amount,
            datetime: new Date().toLocaleString(),
            items_list: itemsList,
            subtotal: ctx.subtotal !== undefined ? `₹${Number(ctx.subtotal).toFixed(0)}` : '',
            tax: ctx.taxAmount !== undefined ? `₹${Number(ctx.taxAmount).toFixed(0)}` : '',
            total: ctx.totalAmount !== undefined ? `₹${Number(ctx.totalAmount).toFixed(0)}` : '',
            token_number: ctx.tokenNumber ?? '',
            receipt_url: ctx.receiptUrl ?? '',
        });
        const provider = await this.whatsappProvider();
        const hasApiKey = !!provider?.config && Object.values(provider.config).some((v) => !!v);
        let sentVia = 'IN_APP';
        let whatsappError = null;
        if (provider && hasApiKey && customer.phone) {
            try {
                await this.notifications.sendWhatsApp(customer.phone, rendered);
                sentVia = 'BOTH';
            }
            catch (e) {
                this.logger.warn(`WhatsApp send failed for ${customer.phone}: ${e?.message}`);
                whatsappError = e?.message || 'send failed';
            }
        }
        const alert = await this.prisma.customerAlert.create({
            data: {
                customerId: ctx.customerId,
                orderId: ctx.orderId,
                orderItemId: ctx.orderItemId,
                trigger,
                title: TITLES[trigger],
                body: rendered,
                ringtone: ctx.ringtone || customer.alertRingtone || 'chime',
                sentVia,
                whatsappError,
            },
        });
        this.ordersGateway.emitCustomerAlert(alert);
        return alert;
    }
};
exports.LifecycleDispatcherService = LifecycleDispatcherService;
exports.LifecycleDispatcherService = LifecycleDispatcherService = LifecycleDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        orders_gateway_1.OrdersGateway])
], LifecycleDispatcherService);
//# sourceMappingURL=lifecycle-dispatcher.service.js.map