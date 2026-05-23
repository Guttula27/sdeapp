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
exports.CustomerAlertsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let CustomerAlertsService = class CustomerAlertsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(customerId, opts = {}) {
        return this.prisma.customerAlert.findMany({
            where: {
                customerId,
                ...(opts.unreadOnly ? { isRead: false } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: opts.limit ?? 50,
        });
    }
    unreadCount(customerId) {
        return this.prisma.customerAlert.count({ where: { customerId, isRead: false } });
    }
    async markRead(customerId, id) {
        return this.prisma.customerAlert.updateMany({
            where: { id, customerId },
            data: { isRead: true },
        });
    }
    async markAllRead(customerId) {
        return this.prisma.customerAlert.updateMany({
            where: { customerId, isRead: false },
            data: { isRead: true },
        });
    }
};
exports.CustomerAlertsService = CustomerAlertsService;
exports.CustomerAlertsService = CustomerAlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomerAlertsService);
//# sourceMappingURL=customer-alerts.service.js.map