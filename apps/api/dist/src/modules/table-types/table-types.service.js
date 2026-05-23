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
exports.TableTypesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const outlet_type_1 = require("../../common/outlet-type");
let TableTypesService = class TableTypesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertOutletAllowsSeating(outletId) {
        const outlet = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: { outletType: true },
        });
        if (!outlet)
            throw new common_1.NotFoundException('Outlet not found');
        if (!(0, outlet_type_1.allowsSeating)(outlet.outletType)) {
            throw new common_1.BadRequestException('This outlet is self-service; table types do not apply.');
        }
    }
    list(outletId) {
        return this.prisma.tableType.findMany({
            where: { outletId },
            orderBy: { createdAt: 'asc' },
            include: {
                tables: {
                    where: { isActive: true },
                    orderBy: { number: 'asc' },
                    include: { qrCode: true },
                },
                _count: { select: { tables: true, prices: true } },
            },
        });
    }
    async addTable(outletId, tableTypeId, data) {
        await this.assertOutletAllowsSeating(outletId);
        const type = await this.prisma.tableType.findUnique({ where: { id: tableTypeId } });
        if (!type)
            throw new common_1.NotFoundException('Table type not found');
        if (type.outletId !== outletId)
            throw new common_1.BadRequestException('Table type does not belong to this outlet');
        return this.prisma.table.create({
            data: {
                number: data.number.trim(),
                capacity: data.capacity ?? 4,
                outletId,
                tableTypeId,
            },
            include: { qrCode: true },
        });
    }
    async removeTable(tableId) {
        return this.prisma.table.update({ where: { id: tableId }, data: { isActive: false } });
    }
    async create(outletId, data) {
        await this.assertOutletAllowsSeating(outletId);
        const name = data.name?.trim();
        if (!name)
            throw new common_1.BadRequestException('Table type name is required');
        const exists = await this.prisma.tableType.findUnique({
            where: { outletId_name: { outletId, name } },
        });
        if (exists)
            throw new common_1.BadRequestException('A table type with that name already exists');
        return this.prisma.tableType.create({
            data: { outletId, name, color: data.color || '#0ea5e9' },
        });
    }
    async update(id, data) {
        const type = await this.prisma.tableType.findUnique({ where: { id } });
        if (!type)
            throw new common_1.NotFoundException('Table type not found');
        if (data.name) {
            const clash = await this.prisma.tableType.findFirst({
                where: { outletId: type.outletId, name: data.name.trim(), NOT: { id } },
            });
            if (clash)
                throw new common_1.BadRequestException('A table type with that name already exists');
        }
        return this.prisma.tableType.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.color !== undefined ? { color: data.color } : {}),
            },
        });
    }
    remove(id) {
        return this.prisma.tableType.delete({ where: { id } });
    }
    async setItemPrice(tableTypeId, itemId, price, variantId, gstRate) {
        if (!Number.isFinite(price) || price < 0) {
            throw new common_1.BadRequestException('Price must be a non-negative number');
        }
        if (gstRate != null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) {
            throw new common_1.BadRequestException('GST rate must be between 0 and 100');
        }
        const type = await this.prisma.tableType.findUnique({ where: { id: tableTypeId } });
        if (!type)
            throw new common_1.NotFoundException('Table type not found');
        const item = await this.prisma.item.findUnique({
            where: { id: itemId },
            include: { subcategory: { include: { category: true } } },
        });
        if (!item)
            throw new common_1.NotFoundException('Item not found');
        if (item.subcategory.category.outletId !== type.outletId) {
            throw new common_1.BadRequestException('Item and table type must belong to the same outlet');
        }
        if (variantId) {
            const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
            if (!variant || variant.itemId !== itemId) {
                throw new common_1.BadRequestException('Variant does not belong to this item');
            }
        }
        const existing = await this.prisma.tableTypePrice.findFirst({
            where: { itemId, tableTypeId, variantId: variantId ?? null },
        });
        if (existing) {
            return this.prisma.tableTypePrice.update({
                where: { id: existing.id },
                data: { price, ...(gstRate !== undefined ? { gstRate } : {}) },
            });
        }
        return this.prisma.tableTypePrice.create({
            data: {
                itemId,
                tableTypeId,
                variantId: variantId ?? null,
                price,
                gstRate: gstRate ?? null,
            },
        });
    }
    async clearItemPrice(tableTypeId, itemId, variantId) {
        await this.prisma.tableTypePrice.deleteMany({
            where: { tableTypeId, itemId, variantId: variantId ?? null },
        });
        return { success: true };
    }
};
exports.TableTypesService = TableTypesService;
exports.TableTypesService = TableTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TableTypesService);
//# sourceMappingURL=table-types.service.js.map