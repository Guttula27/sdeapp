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
exports.CustomerTagsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const translations_service_1 = require("../translations/translations.service");
let CustomerTagsService = class CustomerTagsService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    async list(outletId, lang) {
        const tags = await this.prisma.customerTag.findMany({
            where: { outletId },
            orderBy: { createdAt: 'asc' },
            include: {
                _count: { select: { assignments: true, itemPrices: true } },
            },
        });
        await this.translations.hydrate('CustomerTag', tags, ['name'], lang);
        return tags;
    }
    async create(outletId, data) {
        const name = data.name?.trim();
        if (!name)
            throw new common_1.BadRequestException('Tag name is required');
        const exists = await this.prisma.customerTag.findUnique({
            where: { outletId_name: { outletId, name } },
        });
        if (exists)
            throw new common_1.BadRequestException('A tag with that name already exists');
        const tag = await this.prisma.customerTag.create({
            data: { outletId, name, color: data.color || '#f97316' },
        });
        await this.translations.upsertAll('CustomerTag', tag.id, { name: tag.name });
        return tag;
    }
    async update(id, data) {
        const tag = await this.prisma.customerTag.findUnique({ where: { id } });
        if (!tag)
            throw new common_1.NotFoundException('Tag not found');
        if (data.name) {
            const clash = await this.prisma.customerTag.findFirst({
                where: { outletId: tag.outletId, name: data.name.trim(), NOT: { id } },
            });
            if (clash)
                throw new common_1.BadRequestException('A tag with that name already exists');
        }
        const updated = await this.prisma.customerTag.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.color !== undefined ? { color: data.color } : {}),
            },
        });
        if (data.name !== undefined) {
            await this.translations.upsertAll('CustomerTag', updated.id, { name: updated.name });
        }
        return updated;
    }
    async remove(id) {
        return this.prisma.customerTag.delete({ where: { id } });
    }
    async setItemPrice(tagId, itemId, price, variantId, gstRate) {
        if (!Number.isFinite(price) || price < 0) {
            throw new common_1.BadRequestException('Price must be a non-negative number');
        }
        if (gstRate != null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) {
            throw new common_1.BadRequestException('GST rate must be between 0 and 100');
        }
        const tag = await this.prisma.customerTag.findUnique({ where: { id: tagId } });
        if (!tag)
            throw new common_1.NotFoundException('Tag not found');
        const item = await this.prisma.item.findUnique({
            where: { id: itemId },
            include: { subcategory: { include: { category: true } } },
        });
        if (!item)
            throw new common_1.NotFoundException('Item not found');
        if (item.subcategory.category.outletId !== tag.outletId) {
            throw new common_1.BadRequestException('Item and tag must belong to the same outlet');
        }
        if (variantId) {
            const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
            if (!variant || variant.itemId !== itemId) {
                throw new common_1.BadRequestException('Variant does not belong to this item');
            }
        }
        const existing = await this.prisma.customerTagPrice.findFirst({
            where: { itemId, customerTagId: tagId, variantId: variantId ?? null },
        });
        if (existing) {
            return this.prisma.customerTagPrice.update({
                where: { id: existing.id },
                data: { price, ...(gstRate !== undefined ? { gstRate } : {}) },
            });
        }
        return this.prisma.customerTagPrice.create({
            data: {
                itemId,
                customerTagId: tagId,
                variantId: variantId ?? null,
                price,
                gstRate: gstRate ?? null,
            },
        });
    }
    async clearItemPrice(tagId, itemId, variantId) {
        await this.prisma.customerTagPrice.deleteMany({
            where: { customerTagId: tagId, itemId, variantId: variantId ?? null },
        });
        return { success: true };
    }
};
exports.CustomerTagsService = CustomerTagsService;
exports.CustomerTagsService = CustomerTagsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], CustomerTagsService);
//# sourceMappingURL=customer-tags.service.js.map