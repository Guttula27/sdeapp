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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let CustomersService = class CustomersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(outletId) {
        const [grouped, manualLinks] = await Promise.all([
            this.prisma.order.groupBy({
                by: ['customerId'],
                where: { outletId, customerId: { not: null } },
                _count: { id: true },
                _sum: { totalAmount: true },
                _max: { createdAt: true },
            }),
            this.prisma.outletCustomer.findMany({ where: { outletId }, select: { userId: true } }),
        ]);
        const customerIds = new Set();
        grouped.forEach(g => { if (g.customerId)
            customerIds.add(g.customerId); });
        manualLinks.forEach(l => customerIds.add(l.userId));
        if (customerIds.size === 0)
            return [];
        const idsArr = [...customerIds];
        const [users, assignments] = await Promise.all([
            this.prisma.user.findMany({
                where: { id: { in: idsArr } },
                select: { id: true, name: true, phone: true, email: true },
            }),
            this.prisma.customerTagAssignment.findMany({
                where: { outletId, userId: { in: idsArr } },
                include: { customerTag: true },
            }),
        ]);
        const userMap = new Map(users.map(u => [u.id, u]));
        const tagMap = new Map(assignments.map(a => [a.userId, a.customerTag]));
        const orderMap = new Map(grouped.filter(g => g.customerId).map(g => [g.customerId, g]));
        return idsArr.map(uid => {
            const g = orderMap.get(uid);
            return {
                id: uid,
                name: userMap.get(uid)?.name || 'Unknown',
                phone: userMap.get(uid)?.phone || '',
                email: userMap.get(uid)?.email || null,
                orderCount: g?._count.id ?? 0,
                totalSpend: Number(g?._sum.totalAmount || 0),
                lastOrderAt: g?._max.createdAt ?? null,
                tag: tagMap.get(uid) || null,
            };
        }).sort((a, b) => {
            const ta = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : -1;
            const tb = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : -1;
            if (ta !== tb)
                return tb - ta;
            return a.name.localeCompare(b.name);
        });
    }
    async addCustomer(outletId, data) {
        const phone = data.phone?.trim();
        if (!phone)
            throw new common_1.BadRequestException('Phone is required');
        const name = data.name?.trim() || `Customer (${phone})`;
        const existing = await this.prisma.user.findUnique({ where: { phone } });
        const user = existing
            ? await this.prisma.user.update({
                where: { id: existing.id },
                data: existing.name ? {} : { name },
                select: { id: true, name: true, phone: true, email: true },
            })
            : await this.prisma.user.create({
                data: { phone, name, status: 'ACTIVE' },
                select: { id: true, name: true, phone: true, email: true },
            });
        await this.prisma.outletCustomer.upsert({
            where: { outletId_userId: { outletId, userId: user.id } },
            create: { outletId, userId: user.id },
            update: {},
        });
        return user;
    }
    async listOrders(outletId, userId) {
        return this.prisma.order.findMany({
            where: { outletId, customerId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                items: { include: { item: true, variant: true } },
                table: true,
                payments: true,
            },
        });
    }
    async setTag(outletId, userId, customerTagId) {
        if (customerTagId === null) {
            await this.prisma.customerTagAssignment.deleteMany({
                where: { outletId, userId },
            });
            return { success: true, tag: null };
        }
        const tag = await this.prisma.customerTag.findUnique({
            where: { id: customerTagId },
        });
        if (!tag)
            throw new common_1.NotFoundException('Tag not found');
        if (tag.outletId !== outletId) {
            throw new common_1.BadRequestException('Tag does not belong to this outlet');
        }
        const assignment = await this.prisma.customerTagAssignment.upsert({
            where: { userId_outletId: { userId, outletId } },
            create: { userId, outletId, customerTagId },
            update: { customerTagId },
            include: { customerTag: true },
        });
        return { success: true, tag: assignment.customerTag };
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map