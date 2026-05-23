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
exports.ToppingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const translations_service_1 = require("../translations/translations.service");
let ToppingsService = class ToppingsService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    async list(outletId, lang) {
        const toppings = await this.prisma.topping.findMany({
            where: { outletId },
            orderBy: { createdAt: 'asc' },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
        });
        await this.translations.hydrate('Topping', toppings, ['name'], lang);
        for (const t of toppings) {
            await this.translations.hydrate('ToppingOption', t.options, ['name'], lang);
        }
        return toppings;
    }
    async create(outletId, data) {
        const name = data.name?.trim();
        if (!name)
            throw new common_1.BadRequestException('Topping name is required');
        const exists = await this.prisma.topping.findUnique({
            where: { outletId_name: { outletId, name } },
        });
        if (exists)
            throw new common_1.BadRequestException('A topping with that name already exists');
        const topping = await this.prisma.topping.create({
            data: {
                outletId,
                name,
                basePriceAdd: data.basePriceAdd ?? 0,
                options: data.options?.length
                    ? {
                        create: data.options.map((o, idx) => ({
                            name: o.name,
                            priceAdd: o.priceAdd ?? 0,
                            displayOrder: idx,
                        })),
                    }
                    : undefined,
            },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
        });
        await this.translations.upsertAll('Topping', topping.id, { name: topping.name });
        for (const o of topping.options) {
            await this.translations.upsertAll('ToppingOption', o.id, { name: o.name });
        }
        return topping;
    }
    async update(id, data) {
        const topping = await this.prisma.topping.findUnique({ where: { id } });
        if (!topping)
            throw new common_1.NotFoundException('Topping not found');
        if (data.options !== undefined) {
            await this.prisma.toppingOption.deleteMany({ where: { toppingId: id } });
        }
        const updated = await this.prisma.topping.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.basePriceAdd !== undefined ? { basePriceAdd: data.basePriceAdd } : {}),
                ...(data.options !== undefined
                    ? {
                        options: {
                            create: data.options.map((o, idx) => ({
                                name: o.name,
                                priceAdd: o.priceAdd ?? 0,
                                displayOrder: idx,
                            })),
                        },
                    }
                    : {}),
            },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
        });
        if (data.name !== undefined) {
            await this.translations.upsertAll('Topping', updated.id, { name: updated.name });
        }
        if (data.options !== undefined) {
            for (const o of updated.options) {
                await this.translations.upsertAll('ToppingOption', o.id, { name: o.name });
            }
        }
        return updated;
    }
    remove(id) {
        return this.prisma.topping.delete({ where: { id } });
    }
    setItemToppings(itemId, links) {
        return this.prisma.$transaction(async (tx) => {
            await tx.itemTopping.deleteMany({ where: { itemId } });
            if (links.length) {
                await tx.itemTopping.createMany({
                    data: links.map(l => ({
                        itemId,
                        toppingId: l.toppingId,
                        priceAdd: l.priceAdd ?? null,
                        isRequired: !!l.isRequired,
                    })),
                });
            }
            return tx.itemTopping.findMany({
                where: { itemId },
                include: { topping: { include: { options: { orderBy: { displayOrder: 'asc' } } } } },
            });
        });
    }
};
exports.ToppingsService = ToppingsService;
exports.ToppingsService = ToppingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], ToppingsService);
//# sourceMappingURL=toppings.service.js.map