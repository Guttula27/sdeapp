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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const dayjs = require("dayjs");
let ReportsService = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getRevenueReport(outletId, from, to) {
        const orders = await this.prisma.order.groupBy({
            by: ['createdAt'],
            where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
            _sum: { totalAmount: true },
            _count: { id: true },
        });
        const [total, payments, distinctCustomers, allOrdersCount] = await Promise.all([
            this.prisma.order.aggregate({
                where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
                _sum: { totalAmount: true, taxAmount: true },
                _count: { id: true },
                _avg: { totalAmount: true },
            }),
            this.prisma.payment.groupBy({
                by: ['mode'],
                where: {
                    status: 'SUCCESS',
                    createdAt: { gte: from, lte: to },
                    order: { outletId },
                },
                _sum: { amount: true },
                _count: { id: true },
            }),
            this.prisma.order.findMany({
                where: { outletId, createdAt: { gte: from, lte: to }, customerId: { not: null } },
                distinct: ['customerId'],
                select: { customerId: true },
            }),
            this.prisma.order.count({
                where: { outletId, createdAt: { gte: from, lte: to } },
            }),
        ]);
        const paymentSplit = {
            CASH: { amount: 0, count: 0 },
            UPI: { amount: 0, count: 0 },
            CARD: { amount: 0, count: 0 },
            WALLET: { amount: 0, count: 0 },
            NET_BANKING: { amount: 0, count: 0 },
        };
        payments.forEach((p) => {
            paymentSplit[p.mode] = { amount: Number(p._sum.amount || 0), count: p._count.id };
        });
        return {
            orders,
            summary: {
                totalRevenue: total._sum.totalAmount || 0,
                totalTax: total._sum.taxAmount || 0,
                totalOrders: total._count.id,
                totalOrdersAll: allOrdersCount,
                totalCustomers: distinctCustomers.length,
                avgOrderValue: total._avg.totalAmount || 0,
                paymentSplit,
            },
        };
    }
    async getItemSalesReport(outletId, from, to) {
        return this.prisma.orderItem.groupBy({
            by: ['itemId'],
            where: { order: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } } },
            _sum: { quantity: true, totalPrice: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 20,
        });
    }
    async getKitchenReport(outletId, from, to) {
        const orders = await this.prisma.order.findMany({
            where: { outletId, createdAt: { gte: from, lte: to }, status: 'SERVED' },
            include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
        const preparationTimes = orders.flatMap((order) => {
            const accepted = order.statusHistory.find((h) => h.status === 'QUEUED');
            const ready = order.statusHistory.find((h) => h.status === 'READY');
            if (!accepted || !ready)
                return [];
            return [dayjs(ready.createdAt).diff(dayjs(accepted.createdAt), 'minute')];
        });
        const avgTime = preparationTimes.length
            ? preparationTimes.reduce((a, b) => a + b, 0) / preparationTimes.length
            : 0;
        return { avgPreparationMinutes: Math.round(avgTime), sampleSize: preparationTimes.length };
    }
    async getHourlyOrders(outletId, date) {
        const start = dayjs(date).startOf('day').toDate();
        const end = dayjs(date).endOf('day').toDate();
        const orders = await this.prisma.order.findMany({
            where: { outletId, createdAt: { gte: start, lte: end } },
            select: { createdAt: true, totalAmount: true },
        });
        const hourly = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            orders: 0,
            revenue: 0,
        }));
        orders.forEach((o) => {
            const hour = dayjs(o.createdAt).hour();
            hourly[hour].orders++;
            hourly[hour].revenue += Number(o.totalAmount);
        });
        return hourly;
    }
    async getPlatformSummary(date) {
        const start = dayjs(date).startOf('day').toDate();
        const end = dayjs(date).endOf('day').toDate();
        const [totalBusinesses, activeBusinesses, totalOutlets, todayTotals, activeOrders, topBusinesses, distinctCustomers,] = await Promise.all([
            this.prisma.business.count(),
            this.prisma.business.count({ where: { status: 'ACTIVE' } }),
            this.prisma.outlet.count(),
            this.prisma.order.aggregate({
                where: { createdAt: { gte: start, lte: end } },
                _sum: { totalAmount: true },
                _count: { id: true },
                _avg: { totalAmount: true },
            }),
            this.prisma.order.count({
                where: { status: { in: ['CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE'] } },
            }),
            this.prisma.order.groupBy({
                by: ['outletId'],
                where: { status: 'SERVED', createdAt: { gte: start, lte: end } },
                _sum: { totalAmount: true },
                _count: { id: true },
                orderBy: { _sum: { totalAmount: 'desc' } },
                take: 5,
            }),
            this.prisma.order.findMany({
                where: { createdAt: { gte: start, lte: end }, customerId: { not: null } },
                distinct: ['customerId'],
                select: { customerId: true },
            }),
        ]);
        const outletIds = topBusinesses.map(r => r.outletId);
        const outlets = outletIds.length
            ? await this.prisma.outlet.findMany({
                where: { id: { in: outletIds } },
                select: { id: true, name: true, business: { select: { name: true } } },
            })
            : [];
        const outletMap = new Map(outlets.map(o => [o.id, o]));
        return {
            totalBusinesses,
            activeBusinesses,
            totalOutlets,
            todayOrders: todayTotals._count.id,
            todayCustomers: distinctCustomers.length,
            todayRevenue: Number(todayTotals._sum.totalAmount || 0),
            avgOrderValue: Number(todayTotals._avg.totalAmount || 0),
            activeOrders,
            topOutlets: topBusinesses.map(r => ({
                outletId: r.outletId,
                outletName: outletMap.get(r.outletId)?.name || 'Unknown',
                businessName: outletMap.get(r.outletId)?.business?.name || '',
                revenue: Number(r._sum.totalAmount || 0),
                orders: r._count.id,
            })),
        };
    }
    async getPlatformHourly(date) {
        const start = dayjs(date).startOf('day').toDate();
        const end = dayjs(date).endOf('day').toDate();
        const orders = await this.prisma.order.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { createdAt: true, totalAmount: true },
        });
        const hourly = Array.from({ length: 24 }, (_, h) => ({
            hour: h, orders: 0, revenue: 0,
        }));
        orders.forEach(o => {
            const h = dayjs(o.createdAt).hour();
            hourly[h].orders++;
            hourly[h].revenue += Number(o.totalAmount);
        });
        return hourly;
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map