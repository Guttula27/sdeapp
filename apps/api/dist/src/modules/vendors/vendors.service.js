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
exports.VendorsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let VendorsService = class VendorsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(businessId, search) {
        const where = {
            businessId,
            ...(search && {
                OR: [
                    { name: { contains: search } },
                    { phone: { contains: search } },
                    { email: { contains: search } },
                    { gstNumber: { contains: search } },
                ],
            }),
        };
        const [vendors, total] = await Promise.all([
            this.prisma.vendor.findMany({
                where,
                orderBy: { name: 'asc' },
                include: {
                    _count: { select: { purchaseOrders: true } },
                },
            }),
            this.prisma.vendor.count({ where }),
        ]);
        return { vendors, total };
    }
    async findOne(id) {
        const vendor = await this.prisma.vendor.findUnique({
            where: { id },
            include: {
                purchaseOrders: {
                    include: { material: { select: { id: true, name: true, unit: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                _count: { select: { purchaseOrders: true } },
            },
        });
        if (!vendor)
            throw new common_1.NotFoundException('Vendor not found');
        return vendor;
    }
    async create(businessId, data) {
        return this.prisma.vendor.create({
            data: { ...data, businessId },
        });
    }
    async update(id, data) {
        const vendor = await this.prisma.vendor.findUnique({ where: { id } });
        if (!vendor)
            throw new common_1.NotFoundException('Vendor not found');
        return this.prisma.vendor.update({ where: { id }, data });
    }
    async toggleStatus(id) {
        const vendor = await this.prisma.vendor.findUnique({ where: { id } });
        if (!vendor)
            throw new common_1.NotFoundException('Vendor not found');
        return this.prisma.vendor.update({
            where: { id },
            data: { isActive: !vendor.isActive },
        });
    }
    async remove(id) {
        const vendor = await this.prisma.vendor.findUnique({
            where: { id },
            include: { _count: { select: { purchaseOrders: true } } },
        });
        if (!vendor)
            throw new common_1.NotFoundException('Vendor not found');
        if (vendor._count.purchaseOrders > 0) {
            throw new common_1.ConflictException(`Cannot delete vendor with ${vendor._count.purchaseOrders} purchase order(s). Deactivate instead.`);
        }
        await this.prisma.vendor.delete({ where: { id } });
        return { message: 'Vendor deleted' };
    }
    async getStats(businessId) {
        const [total, active, pos] = await Promise.all([
            this.prisma.vendor.count({ where: { businessId } }),
            this.prisma.vendor.count({ where: { businessId, isActive: true } }),
            this.prisma.purchaseOrder.aggregate({
                where: { vendor: { businessId } },
                _sum: { totalAmount: true },
                _count: { id: true },
            }),
        ]);
        const topVendors = await this.prisma.purchaseOrder.groupBy({
            by: ['vendorId'],
            where: { vendor: { businessId } },
            _sum: { totalAmount: true },
            _count: { id: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 5,
        });
        return {
            totalVendors: total,
            activeVendors: active,
            totalPOs: pos._count.id,
            totalSpend: pos._sum.totalAmount || 0,
            topVendors,
        };
    }
};
exports.VendorsService = VendorsService;
exports.VendorsService = VendorsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VendorsService);
//# sourceMappingURL=vendors.service.js.map