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
exports.DisputesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const translations_service_1 = require("../translations/translations.service");
let DisputesService = class DisputesService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    async create(orderId, customerId, data) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { disputes: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!['DELIVERED', 'CLOSED'].includes(order.status)) {
            throw new common_1.BadRequestException('Disputes can only be raised on delivered or closed orders');
        }
        if (order.disputes.some(d => !['CLOSED', 'RESOLVED'].includes(d.status))) {
            throw new common_1.BadRequestException('An active dispute already exists for this order');
        }
        if (customerId && order.customerId && order.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only dispute your own orders');
        }
        const dispute = await this.prisma.dispute.create({
            data: {
                orderId,
                description: data.description,
                claimAmount: data.claimAmount,
                status: 'OPEN',
            },
            include: { order: { select: { orderNumber: true, outletId: true, totalAmount: true } } },
        });
        await this.translations.upsertAll('Dispute', dispute.id, { description: dispute.description });
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'DISPUTED',
                statusHistory: { create: { status: 'DISPUTED', changedBy: customerId ?? 'CUSTOMER', notes: 'Dispute raised by customer' } },
            },
        });
        return dispute;
    }
    async findByCustomer(customerId, lang) {
        const disputes = await this.prisma.dispute.findMany({
            where: { order: { customerId } },
            include: {
                order: {
                    select: {
                        id: true, orderNumber: true, totalAmount: true, createdAt: true,
                        outlet: { select: { id: true, name: true } },
                        items: { take: 1, include: { item: { select: { id: true, name: true } } } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        await this.translations.hydrate('Dispute', disputes, ['description'], lang);
        return disputes;
    }
    async findOne(id, lang) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id },
            include: {
                order: {
                    include: {
                        items: { include: { item: { select: { id: true, name: true } } } },
                        outlet: { select: { id: true, name: true } },
                        customer: { select: { id: true, name: true, phone: true } },
                    },
                },
            },
        });
        if (!dispute)
            throw new common_1.NotFoundException('Dispute not found');
        await this.translations.hydrate('Dispute', dispute, ['description'], lang);
        return dispute;
    }
    async findByOutlet(outletId, status, lang) {
        const where = {
            order: { outletId },
            ...(status && { status }),
        };
        const [disputes, total] = await Promise.all([
            this.prisma.dispute.findMany({
                where,
                include: {
                    order: {
                        select: {
                            id: true, orderNumber: true, totalAmount: true, createdAt: true,
                            customer: { select: { id: true, name: true, phone: true } },
                            items: { take: 2, include: { item: { select: { id: true, name: true } } } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.dispute.count({ where }),
        ]);
        const stats = await this.prisma.dispute.groupBy({
            by: ['status'],
            where: { order: { outletId } },
            _count: { id: true },
        });
        await this.translations.hydrate('Dispute', disputes, ['description'], lang);
        return { disputes, total, stats };
    }
    async update(id, data) {
        const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: { order: true } });
        if (!dispute)
            throw new common_1.NotFoundException('Dispute not found');
        if (dispute.status === 'CLOSED') {
            throw new common_1.BadRequestException('Closed disputes cannot be updated');
        }
        const updated = await this.prisma.dispute.update({
            where: { id },
            data: {
                status: data.status,
                resolution: data.resolution,
            },
            include: {
                order: { select: { id: true, orderNumber: true, outletId: true } },
            },
        });
        if (['RESOLVED', 'CLOSED'].includes(data.status)) {
            const orderStatus = data.refundRequested ? 'FOR_REFUND' : 'RESOLVED';
            await this.prisma.order.update({
                where: { id: dispute.orderId },
                data: {
                    status: orderStatus,
                    statusHistory: {
                        create: {
                            status: orderStatus,
                            changedBy: 'OUTLET',
                            notes: `Dispute ${data.status.toLowerCase()}: ${data.resolution || ''}`,
                        },
                    },
                },
            });
        }
        return updated;
    }
    async getStats(outletId) {
        const [open, reviewing, resolved, closed] = await Promise.all([
            this.prisma.dispute.count({ where: { order: { outletId }, status: 'OPEN' } }),
            this.prisma.dispute.count({ where: { order: { outletId }, status: 'REVIEWING' } }),
            this.prisma.dispute.count({ where: { order: { outletId }, status: 'RESOLVED' } }),
            this.prisma.dispute.count({ where: { order: { outletId }, status: 'CLOSED' } }),
        ]);
        const claimSum = await this.prisma.dispute.aggregate({
            where: { order: { outletId }, status: { in: ['OPEN', 'REVIEWING'] } },
            _sum: { claimAmount: true },
        });
        return {
            open, reviewing, resolved, closed,
            total: open + reviewing + resolved + closed,
            pendingClaimAmount: claimSum._sum.claimAmount || 0,
        };
    }
};
exports.DisputesService = DisputesService;
exports.DisputesService = DisputesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], DisputesService);
//# sourceMappingURL=disputes.service.js.map