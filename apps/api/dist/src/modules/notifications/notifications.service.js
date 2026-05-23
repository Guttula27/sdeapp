"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor() {
        this.logger = new common_1.Logger(NotificationsService_1.name);
    }
    async sendSms(to, message) {
        this.logger.log(`SMS to ${to}: ${message}`);
    }
    async sendWhatsApp(to, message) {
        this.logger.log(`WhatsApp to ${to}: ${message}`);
    }
    async sendEmail(to, subject, html) {
        this.logger.log(`Email to ${to}: ${subject}`);
    }
    async notifyOrderStatus(phone, orderNumber, status) {
        const messages = {
            ACCEPTED: `Your order ${orderNumber} has been accepted and will be prepared shortly.`,
            READY: `Your order ${orderNumber} is ready! Please collect it.`,
            DELIVERED: `Your order ${orderNumber} has been delivered. Enjoy your meal!`,
            CANCELLED: `Your order ${orderNumber} has been cancelled. Contact the outlet for assistance.`,
        };
        const message = messages[status];
        if (message)
            await this.sendSms(phone, message);
    }
    async notifyLowStock(email, materialName, currentStock, unit) {
        await this.sendEmail(email, 'Low Stock Alert - PayNPik', `<p>Stock alert: <strong>${materialName}</strong> is running low. Current stock: ${currentStock} ${unit}.</p>`);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map