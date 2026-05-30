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
exports.OutletsService = exports.CreateTableDto = exports.CreateSectionDto = exports.CreateOutletDto = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const client_1 = require("@prisma/client");
const translations_service_1 = require("../translations/translations.service");
const outlet_type_1 = require("../../common/outlet-type");
const DEFAULT_OUTLET_ADMIN_PASSWORD = 'abc@123';
function generateOutletCode() {
    return 'OL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
class CreateOutletDto {
}
exports.CreateOutletDto = CreateOutletDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "businessId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "facilityId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OutletType),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "outletType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "addressLine1", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "addressLine2", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "state", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "pincode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "country", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "mapsLocation", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "gstNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "upiId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "primaryImageUrl", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateOutletDto.prototype, "defaultPrepTime", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "parcelChargeEnabled", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateOutletDto.prototype, "defaultParcelCharge", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "gstApplicable", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateOutletDto.prototype, "gstPercent", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "priceIncludesGst", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "multipleMenusEnabled", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "acceptRewardRedemption", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "kitchenAutoPrint", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOutletDto.prototype, "kitchenAllowManualPrint", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "adminPhone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateOutletDto.prototype, "adminName", void 0);
class CreateSectionDto {
}
exports.CreateSectionDto = CreateSectionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSectionDto.prototype, "name", void 0);
class CreateTableDto {
}
exports.CreateTableDto = CreateTableDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTableDto.prototype, "number", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateTableDto.prototype, "capacity", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sectionId != null),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateTableDto.prototype, "sectionId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.tableTypeId != null),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateTableDto.prototype, "tableTypeId", void 0);
let OutletsService = class OutletsService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    translatableOutletFields(o) {
        return {
            name: o.name,
            description: o.description,
            address: o.address,
            addressLine1: o.addressLine1,
            addressLine2: o.addressLine2,
        };
    }
    async create(data) {
        const { adminPhone, adminName, ...outletData } = data;
        if (!adminPhone)
            throw new common_1.BadRequestException('Outlet admin phone is required');
        const existing = await this.prisma.user.findUnique({ where: { phone: adminPhone } });
        if (existing)
            throw new common_1.BadRequestException(`Phone ${adminPhone} is already registered`);
        let outlet = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                outlet = await this.prisma.outlet.create({
                    data: { ...outletData, publicCode: generateOutletCode() },
                    include: { business: true },
                });
                break;
            }
            catch (e) {
                if (e?.code !== 'P2002' || !`${e?.message ?? ''}`.includes('publicCode'))
                    throw e;
            }
        }
        if (!outlet)
            throw new common_1.BadRequestException('Could not allocate outlet code');
        await this.translations.upsertAll('Outlet', outlet.id, this.translatableOutletFields(outlet));
        let outletAdminRole = await this.prisma.role.findFirst({
            where: { businessId: outlet.businessId, name: 'Outlet Admin' },
        });
        if (!outletAdminRole) {
            outletAdminRole = await this.prisma.role.create({
                data: { name: 'Outlet Admin', businessId: outlet.businessId, isSystem: false },
            });
        }
        const passwordHash = await bcrypt.hash(DEFAULT_OUTLET_ADMIN_PASSWORD, 12);
        const adminUser = await this.prisma.user.create({
            data: {
                name: adminName?.trim() || `${outlet.name} Admin`,
                phone: adminPhone.trim(),
                passwordHash,
                businessId: outlet.businessId,
                outletId: outlet.id,
                roleId: outletAdminRole.id,
                status: 'ACTIVE',
                mustChangePassword: true,
            },
            select: { id: true, name: true, phone: true },
        });
        return { ...outlet, admin: adminUser };
    }
    async findByBusiness(businessId, lang) {
        const outlets = await this.prisma.outlet.findMany({
            where: { businessId },
            include: { _count: { select: { orders: true, tables: true } } },
        });
        await this.translations.hydrate('Outlet', outlets, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
        return outlets;
    }
    async findOne(id, lang) {
        const outlet = await this.prisma.outlet.findUnique({
            where: { id },
            include: {
                sections: { include: { tables: true } },
                images: { orderBy: { displayOrder: 'asc' } },
                hours: { orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }] },
                _count: { select: { orders: true, tables: true } },
            },
        });
        if (!outlet)
            throw new common_1.NotFoundException('Outlet not found');
        await this.translations.hydrate('Outlet', outlet, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
        return outlet;
    }
    async update(id, data) {
        if (data.outletType && !(0, outlet_type_1.allowsSeating)(data.outletType)) {
            const [tables, sections, tableTypes] = await Promise.all([
                this.prisma.table.count({ where: { outletId: id } }),
                this.prisma.section.count({ where: { outletId: id } }),
                this.prisma.tableType.count({ where: { outletId: id } }),
            ]);
            if (tables + sections + tableTypes > 0) {
                throw new common_1.BadRequestException('Remove all sections, tables, and table types before switching this outlet to a self-service type.');
            }
        }
        const outlet = await this.prisma.outlet.update({ where: { id }, data });
        const touchedTextFields = ['name', 'description', 'address', 'addressLine1', 'addressLine2']
            .some((f) => data[f] !== undefined);
        if (touchedTextFields) {
            await this.translations.upsertAll('Outlet', outlet.id, this.translatableOutletFields(outlet));
        }
        return outlet;
    }
    async assertOutletAllowsSeating(outletId) {
        const outlet = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: { outletType: true },
        });
        if (!outlet)
            throw new common_1.NotFoundException('Outlet not found');
        if (!(0, outlet_type_1.allowsSeating)(outlet.outletType)) {
            throw new common_1.BadRequestException('This outlet is self-service; sections, tables, and table types do not apply.');
        }
    }
    async findAdmin(outletId) {
        return this.prisma.user.findFirst({
            where: { outletId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, phone: true, email: true },
        });
    }
    async addImage(outletId, url) {
        const max = await this.prisma.outletImage.aggregate({
            where: { outletId },
            _max: { displayOrder: true },
        });
        return this.prisma.outletImage.create({
            data: { outletId, url, displayOrder: (max._max.displayOrder ?? -1) + 1 },
        });
    }
    removeImage(imageId) {
        return this.prisma.outletImage.delete({ where: { id: imageId } });
    }
    listPublic() {
        return this.prisma.outlet.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                city: true,
                address: true,
                primaryImageUrl: true,
                logoUrl: true,
                business: { select: { name: true } },
            },
        });
    }
    async getOpenStatus(outletId) {
        const outlet = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: {
                id: true, isActive: true, name: true, outletType: true, hours: true,
                clusterMembership: {
                    select: {
                        clusterBusiness: { select: { id: true, publicCode: true, name: true } },
                    },
                },
            },
        });
        if (!outlet)
            throw new common_1.NotFoundException('Outlet not found');
        const base = {
            outletType: outlet.outletType,
            clusterMembership: outlet.clusterMembership?.clusterBusiness
                ? {
                    clusterBusinessId: outlet.clusterMembership.clusterBusiness.id,
                    clusterPublicCode: outlet.clusterMembership.clusterBusiness.publicCode,
                    clusterName: outlet.clusterMembership.clusterBusiness.name,
                }
                : null,
        };
        if (!outlet.isActive) {
            return { ...base, isOpen: false, isActive: false, reason: 'Outlet is currently closed' };
        }
        const now = new Date();
        const day = now.getDay();
        const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todays = outlet.hours.filter((h) => h.dayOfWeek === day);
        if (todays.length === 0) {
            return { ...base, isOpen: false, isActive: true, reason: 'Closed today' };
        }
        const within = todays.find((h) => hm >= h.openTime && hm < h.closeTime);
        if (within) {
            return { ...base, isOpen: true, isActive: true, reason: null };
        }
        const next = todays.find((h) => hm < h.openTime);
        return {
            ...base,
            isOpen: false,
            isActive: true,
            reason: next ? `Opens at ${next.openTime}` : 'Closed for the day',
        };
    }
    async getTokenCounter(outletId) {
        const o = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: { tokenStartNumber: true, nextTokenNumber: true, nextOrderSequence: true },
        });
        if (!o)
            throw new common_1.NotFoundException('Outlet not found');
        return o;
    }
    async setTokenCounter(outletId, body) {
        if (body.startNumber != null && (!Number.isInteger(body.startNumber) || body.startNumber < 1)) {
            throw new common_1.BadRequestException('startNumber must be a positive integer');
        }
        if (body.currentNumber != null && (!Number.isInteger(body.currentNumber) || body.currentNumber < 1)) {
            throw new common_1.BadRequestException('currentNumber must be a positive integer');
        }
        return this.prisma.outlet.update({
            where: { id: outletId },
            data: {
                ...(body.startNumber != null ? { tokenStartNumber: body.startNumber } : {}),
                ...(body.currentNumber != null ? { nextTokenNumber: body.currentNumber } : {}),
            },
            select: { tokenStartNumber: true, nextTokenNumber: true },
        });
    }
    async resetTokenCounter(outletId) {
        const o = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: { tokenStartNumber: true },
        });
        if (!o)
            throw new common_1.NotFoundException('Outlet not found');
        return this.prisma.outlet.update({
            where: { id: outletId },
            data: { nextTokenNumber: o.tokenStartNumber },
            select: { tokenStartNumber: true, nextTokenNumber: true },
        });
    }
    getHours(outletId) {
        return this.prisma.outletHour.findMany({
            where: { outletId },
            orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }],
        });
    }
    async setHours(outletId, ranges) {
        for (const r of ranges) {
            if (r.dayOfWeek < 0 || r.dayOfWeek > 6)
                throw new common_1.BadRequestException('dayOfWeek must be 0-6');
            if (!/^\d{2}:\d{2}$/.test(r.openTime) || !/^\d{2}:\d{2}$/.test(r.closeTime)) {
                throw new common_1.BadRequestException('Times must be HH:MM');
            }
            if (r.closeTime <= r.openTime)
                throw new common_1.BadRequestException('Close time must be after open time');
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.outletHour.deleteMany({ where: { outletId } });
            if (ranges.length) {
                await tx.outletHour.createMany({
                    data: ranges.map(r => ({
                        outletId,
                        dayOfWeek: r.dayOfWeek,
                        openTime: r.openTime,
                        closeTime: r.closeTime,
                    })),
                });
            }
            return tx.outletHour.findMany({
                where: { outletId },
                orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }],
            });
        });
    }
    async createSection(outletId, data) {
        await this.assertOutletAllowsSeating(outletId);
        return this.prisma.section.create({ data: { ...data, outletId } });
    }
    async getSections(outletId) {
        return this.prisma.section.findMany({
            where: { outletId },
            include: { tables: true },
        });
    }
    async createTable(outletId, data) {
        await this.assertOutletAllowsSeating(outletId);
        return this.prisma.table.create({ data: { ...data, outletId } });
    }
    async getDashboard(outletId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [todayOrders, activeOrders, revenue, topItems, paymentSplit, distinctCustomers] = await Promise.all([
            this.prisma.order.count({ where: { outletId, createdAt: { gte: today } } }),
            this.prisma.order.count({
                where: { outletId, status: { in: ['CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE'] } },
            }),
            this.prisma.order.aggregate({
                where: { outletId, status: 'SERVED', createdAt: { gte: today } },
                _sum: { totalAmount: true },
                _avg: { totalAmount: true },
            }),
            this.prisma.orderItem.groupBy({
                by: ['itemId'],
                where: { order: { outletId, createdAt: { gte: today } } },
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5,
            }),
            this.prisma.payment.groupBy({
                by: ['mode'],
                where: {
                    status: 'SUCCESS',
                    createdAt: { gte: today },
                    order: { outletId },
                },
                _sum: { amount: true },
                _count: { id: true },
            }),
            this.prisma.order.findMany({
                where: { outletId, createdAt: { gte: today }, customerId: { not: null } },
                distinct: ['customerId'],
                select: { customerId: true },
            }),
        ]);
        const splitMap = {
            CASH: { amount: 0, count: 0 },
            UPI: { amount: 0, count: 0 },
            CARD: { amount: 0, count: 0 },
            WALLET: { amount: 0, count: 0 },
            NET_BANKING: { amount: 0, count: 0 },
        };
        paymentSplit.forEach((g) => {
            splitMap[g.mode] = { amount: Number(g._sum.amount || 0), count: g._count.id };
        });
        return {
            todayOrders,
            todayCustomers: distinctCustomers.length,
            activeOrders,
            todayRevenue: revenue._sum.totalAmount || 0,
            avgOrderValue: revenue._avg.totalAmount || 0,
            topItems,
            paymentSplit: splitMap,
        };
    }
};
exports.OutletsService = OutletsService;
exports.OutletsService = OutletsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], OutletsService);
//# sourceMappingURL=outlets.service.js.map