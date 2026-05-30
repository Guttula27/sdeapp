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
exports.BusinessesService = exports.CreateBusinessDto = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const client_1 = require("@prisma/client");
const translations_service_1 = require("../translations/translations.service");
const DEFAULT_ADMIN_PASSWORD = 'abc@123';
function generateBusinessCode() {
    return 'BIZ-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
class CreateBusinessDto {
}
exports.CreateBusinessDto = CreateBusinessDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "addressLine1", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "addressLine2", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "state", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "pincode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "country", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "mapsLocation", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "gstNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "upiId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.BusinessType),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "businessType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "primaryImageUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "adminPhone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBusinessDto.prototype, "adminName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateBusinessDto.prototype, "multipleMenusEnabled", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateBusinessDto.prototype, "isCluster", void 0);
let BusinessesService = class BusinessesService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    translatableBusinessFields(b) {
        return {
            name: b.name,
            description: b.description,
            address: b.address,
            addressLine1: b.addressLine1,
            addressLine2: b.addressLine2,
        };
    }
    async create(data) {
        const { adminPhone, adminName, isCluster, ...biz } = data;
        if (!adminPhone)
            throw new common_1.BadRequestException('Business admin phone is required');
        const existing = await this.prisma.user.findUnique({ where: { phone: adminPhone } });
        if (existing)
            throw new common_1.BadRequestException(`Phone ${adminPhone} is already registered`);
        let business = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                business = await this.prisma.business.create({
                    data: { ...biz, isCluster: !!isCluster, publicCode: generateBusinessCode() },
                });
                break;
            }
            catch (e) {
                if (e?.code !== 'P2002' || !`${e?.message ?? ''}`.includes('publicCode'))
                    throw e;
            }
        }
        if (!business)
            throw new common_1.BadRequestException('Could not allocate a unique business code, please retry');
        await this.translations.upsertAll('Business', business.id, this.translatableBusinessFields(business));
        if (!isCluster) {
            await this.prisma.menu.create({
                data: { businessId: business.id, name: 'Main Menu', isDefault: true },
            });
        }
        const template = await this.prisma.role.findFirst({
            where: { name: 'Business Owner', isTemplate: true, businessId: null },
            select: { responsibilities: { select: { responsibilityId: true } } },
        });
        const ownerRole = await this.prisma.role.create({
            data: {
                name: 'Business Owner',
                businessId: business.id,
                isSystem: false,
                responsibilities: template
                    ? { create: template.responsibilities.map((r) => ({ responsibilityId: r.responsibilityId })) }
                    : undefined,
            },
        });
        const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
        const adminUser = await this.prisma.user.create({
            data: {
                name: adminName?.trim() || `${business.name} Owner`,
                phone: adminPhone.trim(),
                passwordHash,
                businessId: business.id,
                roleId: ownerRole.id,
                status: 'ACTIVE',
                mustChangePassword: true,
            },
            select: { id: true, name: true, phone: true },
        });
        return { ...business, admin: adminUser };
    }
    async findAll(page, limit, lang) {
        const p = Number(page) || 1;
        const l = Number(limit) || 20;
        const [businesses, total] = await Promise.all([
            this.prisma.business.findMany({
                include: { subscription: { include: { plan: true } }, _count: { select: { outlets: true } } },
                skip: (p - 1) * l,
                take: l,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.business.count(),
        ]);
        await this.translations.hydrate('Business', businesses, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
        return { businesses, total, page: p, limit: l };
    }
    async findOne(id, lang) {
        const business = await this.prisma.business.findUnique({
            where: { id },
            include: {
                outlets: true,
                subscription: { include: { plan: true } },
                images: { orderBy: { displayOrder: 'asc' } },
                _count: { select: { outlets: true, users: true } },
            },
        });
        if (!business)
            throw new common_1.NotFoundException('Business not found');
        await this.translations.hydrate('Business', business, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
        await this.translations.hydrate('Outlet', business.outlets, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
        return business;
    }
    async findAdmin(businessId) {
        return this.prisma.user.findFirst({
            where: { businessId, outletId: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, phone: true, email: true },
        });
    }
    async addImage(businessId, url) {
        const max = await this.prisma.businessImage.aggregate({
            where: { businessId },
            _max: { displayOrder: true },
        });
        return this.prisma.businessImage.create({
            data: { businessId, url, displayOrder: (max._max.displayOrder ?? -1) + 1 },
        });
    }
    removeImage(imageId) {
        return this.prisma.businessImage.delete({ where: { id: imageId } });
    }
    async update(id, data) {
        const business = await this.prisma.business.update({ where: { id }, data });
        const touchedTextFields = ['name', 'description', 'address', 'addressLine1', 'addressLine2']
            .some((f) => data[f] !== undefined);
        if (touchedTextFields) {
            await this.translations.upsertAll('Business', business.id, this.translatableBusinessFields(business));
        }
        return business;
    }
    async toggleStatus(id) {
        const business = await this.prisma.business.findUnique({ where: { id } });
        if (!business)
            throw new common_1.NotFoundException('Business not found');
        return this.prisma.business.update({
            where: { id },
            data: { status: business.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
        });
    }
    async getRoles(businessId) {
        return this.prisma.role.findMany({
            where: { OR: [{ businessId }, { isSystem: true }] },
            select: { id: true, name: true, isSystem: true },
        });
    }
    async getDashboard(id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [outlets, todayOrders, revenue, distinctCustomers] = await Promise.all([
            this.prisma.outlet.count({ where: { businessId: id, isActive: true } }),
            this.prisma.order.count({
                where: { outlet: { businessId: id }, createdAt: { gte: today } },
            }),
            this.prisma.order.aggregate({
                where: { outlet: { businessId: id }, status: 'SERVED', createdAt: { gte: today } },
                _sum: { totalAmount: true },
            }),
            this.prisma.order.findMany({
                where: { outlet: { businessId: id }, createdAt: { gte: today }, customerId: { not: null } },
                distinct: ['customerId'],
                select: { customerId: true },
            }),
        ]);
        return {
            activeOutlets: outlets,
            todayOrders,
            todayCustomers: distinctCustomers.length,
            todayRevenue: revenue._sum.totalAmount || 0,
        };
    }
};
exports.BusinessesService = BusinessesService;
exports.BusinessesService = BusinessesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], BusinessesService);
//# sourceMappingURL=businesses.service.js.map