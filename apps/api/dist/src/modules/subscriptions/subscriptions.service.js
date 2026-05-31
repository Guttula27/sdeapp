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
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const dayjs = require("dayjs");
let SubscriptionsService = class SubscriptionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPlans() {
        return this.prisma.plan.findMany({ where: { isActive: true } });
    }
    async createPlan(data) {
        return this.prisma.plan.create({ data });
    }
    async subscribe(businessId, planId, billing) {
        const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!plan)
            throw new Error('Plan not found');
        const startDate = new Date();
        const endDate = billing === 'ANNUAL'
            ? dayjs().add(1, 'year').toDate()
            : dayjs().add(1, 'month').toDate();
        const subscription = await this.prisma.subscription.create({
            data: {
                planId,
                status: 'ACTIVE',
                startDate,
                endDate,
            },
        });
        await this.prisma.business.update({
            where: { id: businessId },
            data: { subscriptionId: subscription.id },
        });
        const amount = billing === 'ANNUAL' ? Number(plan.annualCost) : Number(plan.monthlyCost);
        const gstAmount = amount * 0.18;
        await this.prisma.invoice.create({
            data: {
                subscriptionId: subscription.id,
                amount,
                gstAmount,
                totalAmount: amount + gstAmount,
                dueDate: new Date(),
                status: 'PENDING',
            },
        });
        return subscription;
    }
    async getBusinessSubscription(businessId) {
        const business = await this.prisma.business.findUnique({
            where: { id: businessId },
            include: { subscription: { include: { plan: true, invoices: true } } },
        });
        return business?.subscription;
    }
    async getInvoices(businessId) {
        if (!businessId)
            return [];
        const business = await this.prisma.business.findUnique({
            where: { id: businessId },
            select: { subscriptionId: true },
        });
        if (!business?.subscriptionId)
            return [];
        return this.prisma.invoice.findMany({
            where: { subscriptionId: business.subscriptionId },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map