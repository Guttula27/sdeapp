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
exports.MenuService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const translations_service_1 = require("../translations/translations.service");
let MenuService = class MenuService {
    constructor(prisma, translations) {
        this.prisma = prisma;
        this.translations = translations;
    }
    async hydrateMenu(categories, lang) {
        if (!lang || lang === 'en' || !categories.length)
            return categories;
        const cats = categories;
        const subs = categories.flatMap((c) => c.subcategories ?? []);
        const items = subs.flatMap((s) => s.items ?? []);
        const variants = items.flatMap((i) => i.variants ?? []);
        const toppings = items
            .flatMap((i) => i.itemToppings ?? [])
            .map((t) => t.topping)
            .filter(Boolean);
        await Promise.all([
            this.translations.hydrate('Category', cats, ['name'], lang),
            this.translations.hydrate('Subcategory', subs, ['name'], lang),
            this.translations.hydrate('Item', items, ['name', 'description'], lang),
            this.translations.hydrate('Variant', variants, ['name', 'shortDescription'], lang),
            this.translations.hydrate('Topping', toppings, ['name'], lang),
        ]);
        return categories;
    }
    async getMenu(outletId, viewerUserId, tableId, lang, opts) {
        const outletMeta = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: { multipleMenusEnabled: true, businessId: true },
        });
        let allowedMenuIds = [];
        if (outletMeta) {
            const defaultMenu = await this.prisma.menu.findFirst({
                where: { businessId: outletMeta.businessId, isDefault: true },
                select: { id: true },
            });
            if (!outletMeta.multipleMenusEnabled) {
                allowedMenuIds = defaultMenu ? [defaultMenu.id] : [];
            }
            else {
                const links = await this.prisma.outletMenu.findMany({
                    where: { outletId, isEnabled: true },
                    select: { menuId: true },
                });
                const enabled = new Set(links.map((l) => l.menuId));
                if (defaultMenu)
                    enabled.add(defaultMenu.id);
                if (tableId) {
                    const table = await this.prisma.table.findUnique({
                        where: { id: tableId },
                        select: { tableTypeId: true, outletId: true },
                    });
                    if (table && table.outletId === outletId && table.tableTypeId) {
                        const sectionDisabled = await this.prisma.tableTypeMenu.findMany({
                            where: { tableTypeId: table.tableTypeId, isEnabled: false },
                            select: { menuId: true },
                        });
                        for (const s of sectionDisabled) {
                            if (defaultMenu && s.menuId === defaultMenu.id)
                                continue;
                            enabled.delete(s.menuId);
                        }
                    }
                }
                allowedMenuIds = Array.from(enabled);
            }
        }
        const categories = await this.prisma.category.findMany({
            where: {
                outletId,
                isActive: true,
                OR: [
                    { menuId: { in: allowedMenuIds } },
                    ...(outletMeta && !outletMeta.multipleMenusEnabled
                        ? [{ menuId: null }]
                        : []),
                ],
            },
            orderBy: { displayOrder: 'asc' },
            include: {
                subcategories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        items: {
                            ...(opts?.includeHidden ? {} : { where: { isDisplayed: true } }),
                            orderBy: { displayOrder: 'asc' },
                            include: {
                                variants: true,
                                options: true,
                                tags: true,
                                customerTagPrices: { include: { customerTag: true } },
                                tableTypePrices: { include: { tableType: true } },
                                images: { orderBy: { displayOrder: 'asc' } },
                                itemToppings: {
                                    include: {
                                        topping: {
                                            include: { options: { orderBy: { displayOrder: 'asc' } } },
                                        },
                                    },
                                },
                                bundleChildren: {
                                    orderBy: { displayOrder: 'asc' },
                                    include: {
                                        childItem: { select: { id: true, name: true } },
                                        variant: { select: { id: true, name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        let viewerTagId = null;
        if (viewerUserId) {
            const assignment = await this.prisma.customerTagAssignment.findUnique({
                where: { userId_outletId: { userId: viewerUserId, outletId } },
            });
            viewerTagId = assignment?.customerTagId ?? null;
        }
        let tableTypeId = null;
        if (tableId) {
            const table = await this.prisma.table.findUnique({
                where: { id: tableId },
                select: { tableTypeId: true, outletId: true },
            });
            if (table?.outletId === outletId)
                tableTypeId = table.tableTypeId;
        }
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const topGroups = await this.prisma.orderItem.groupBy({
            by: ['itemId'],
            where: {
                order: { outletId, createdAt: { gte: since } },
                status: { not: 'CANCELLED' },
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
        });
        const popularSet = new Set(topGroups.map(g => g.itemId));
        let favoriteSet = new Set();
        if (viewerUserId) {
            const favs = await this.prisma.favorite.findMany({
                where: { userId: viewerUserId },
                select: { itemId: true },
            });
            favoriteSet = new Set(favs.map(f => f.itemId));
        }
        const pickItemPrice = (item, variantId) => {
            if (viewerTagId) {
                const ct = item.customerTagPrices.find((p) => p.customerTagId === viewerTagId
                    && ((variantId ? p.variantId === variantId : !p.variantId)));
                if (ct)
                    return { price: Number(ct.price), source: 'CUSTOMER_TAG', id: viewerTagId };
            }
            if (tableTypeId) {
                const tt = item.tableTypePrices.find((p) => p.tableTypeId === tableTypeId
                    && ((variantId ? p.variantId === variantId : !p.variantId)));
                if (tt)
                    return { price: Number(tt.price), source: 'TABLE_TYPE', id: tableTypeId };
            }
            return null;
        };
        await this.hydrateMenu(categories, lang);
        const itemIds = categories.flatMap((c) => c.subcategories.flatMap((s) => s.items.map((i) => i.id)));
        const ratingRows = itemIds.length
            ? await this.prisma.orderItemReview.groupBy({
                by: ['itemId'],
                where: { itemId: { in: itemIds } },
                _avg: { rating: true },
                _count: { rating: true },
            })
            : [];
        const ratingByItem = new Map();
        for (const r of ratingRows) {
            ratingByItem.set(r.itemId, {
                avg: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
                count: r._count.rating ?? 0,
            });
        }
        return categories.map(cat => ({
            ...cat,
            subcategories: cat.subcategories.map(sub => ({
                ...sub,
                items: sub.items.map(item => {
                    const itemOv = pickItemPrice(item);
                    const variants = item.variants.map((v) => {
                        const vOv = pickItemPrice(item, v.id);
                        return {
                            ...v,
                            effectivePrice: vOv ? vOv.price : Number(v.price),
                            appliedTagId: vOv?.source === 'CUSTOMER_TAG' ? vOv.id : null,
                            appliedTableTypeId: vOv?.source === 'TABLE_TYPE' ? vOv.id : null,
                        };
                    });
                    const rating = ratingByItem.get(item.id) ?? { avg: 0, count: 0 };
                    return {
                        ...item,
                        variants,
                        effectivePrice: itemOv ? itemOv.price : Number(item.basePrice),
                        appliedTagId: itemOv?.source === 'CUSTOMER_TAG' ? itemOv.id : null,
                        appliedTableTypeId: itemOv?.source === 'TABLE_TYPE' ? itemOv.id : null,
                        isPopular: popularSet.has(item.id) || item.isPopular,
                        isFavorite: favoriteSet.has(item.id),
                        ratingAvg: rating.avg,
                        ratingCount: rating.count,
                    };
                }),
            })),
        }));
    }
    async createCategory(outletId, data) {
        let menuId = data.menuId ?? null;
        if (!menuId) {
            const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
            if (outlet) {
                const defaultMenu = await this.prisma.menu.findFirst({
                    where: { businessId: outlet.businessId, isDefault: true },
                    select: { id: true },
                });
                menuId = defaultMenu?.id ?? null;
            }
        }
        const category = await this.prisma.category.create({
            data: { name: data.name, imageUrl: data.imageUrl, outletId, menuId: menuId ?? undefined },
        });
        await this.translations.upsertAll('Category', category.id, { name: category.name });
        return category;
    }
    async updateCategory(id, data) {
        const category = await this.prisma.category.update({ where: { id }, data });
        if (data.name !== undefined) {
            await this.translations.upsertAll('Category', category.id, { name: category.name });
        }
        return category;
    }
    async deleteCategory(id) {
        const orderItemCount = await this.prisma.orderItem.count({
            where: { item: { subcategory: { categoryId: id } } },
        });
        if (orderItemCount > 0) {
            return this.prisma.category.update({ where: { id }, data: { isActive: false } });
        }
        return this.prisma.$transaction(async (tx) => {
            const subs = await tx.subcategory.findMany({ where: { categoryId: id }, select: { id: true } });
            const subIds = subs.map((s) => s.id);
            const items = await tx.item.findMany({ where: { subcategoryId: { in: subIds } }, select: { id: true } });
            const itemIds = items.map((i) => i.id);
            if (itemIds.length) {
                await tx.itemTag.deleteMany({ where: { itemId: { in: itemIds } } });
                await tx.option.deleteMany({ where: { itemId: { in: itemIds } } });
                await tx.variant.deleteMany({ where: { itemId: { in: itemIds } } });
                await tx.item.deleteMany({ where: { id: { in: itemIds } } });
            }
            if (subIds.length)
                await tx.subcategory.deleteMany({ where: { id: { in: subIds } } });
            return tx.category.delete({ where: { id } });
        });
    }
    async createSubcategory(categoryId, data) {
        const sub = await this.prisma.subcategory.create({ data: { ...data, categoryId } });
        await this.translations.upsertAll('Subcategory', sub.id, { name: sub.name });
        return sub;
    }
    async updateSubcategory(id, data) {
        const sub = await this.prisma.subcategory.update({ where: { id }, data });
        if (data.name !== undefined) {
            await this.translations.upsertAll('Subcategory', sub.id, { name: sub.name });
        }
        return sub;
    }
    async createItem(subcategoryId, data) {
        if (data.gstRate == null) {
            const sub = await this.prisma.subcategory.findUnique({
                where: { id: subcategoryId },
                select: { category: { select: { outletId: true } } },
            });
            const outletId = sub?.category?.outletId;
            if (outletId) {
                const outlet = await this.prisma.outlet.findUnique({
                    where: { id: outletId },
                    select: { gstApplicable: true, gstPercent: true },
                });
                if (outlet?.gstApplicable)
                    data.gstRate = outlet.gstPercent;
            }
        }
        const { bundleChildren, ...itemData } = data || {};
        if (itemData.basePrice == null && itemData.price != null) {
            itemData.basePrice = itemData.price;
        }
        delete itemData.price;
        if (itemData.foodGrade == null && itemData.type != null) {
            itemData.foodGrade = itemData.type;
        }
        delete itemData.type;
        const item = await this.prisma.item.create({
            data: { ...itemData, subcategoryId },
            include: { variants: true, options: true },
        });
        if (Array.isArray(bundleChildren) && bundleChildren.length) {
            await this.replaceBundleChildren(item.id, bundleChildren);
        }
        await this.translations.upsertAll('Item', item.id, {
            name: item.name,
            description: item.description ?? undefined,
        });
        for (const v of item.variants ?? []) {
            await this.translations.upsertAll('Variant', v.id, {
                name: v.name,
                shortDescription: v.shortDescription ?? undefined,
            });
        }
        return item;
    }
    async updateItem(id, data) {
        const { bundleChildren, ...itemData } = data || {};
        const item = await this.prisma.item.update({
            where: { id },
            data: itemData,
            include: { variants: true, options: true },
        });
        if (Array.isArray(bundleChildren)) {
            await this.replaceBundleChildren(id, bundleChildren);
        }
        if (data.name !== undefined || data.description !== undefined) {
            await this.translations.upsertAll('Item', item.id, {
                name: item.name,
                description: item.description ?? undefined,
            });
        }
        return item;
    }
    async replaceBundleChildren(parentItemId, children) {
        await this.prisma.$transaction([
            this.prisma.itemBundleChild.deleteMany({ where: { parentItemId } }),
            ...(children.length
                ? [this.prisma.itemBundleChild.createMany({
                        data: children.map((c, idx) => ({
                            parentItemId,
                            childItemId: c.childItemId,
                            variantId: c.variantId ?? null,
                            quantity: Math.max(1, Number(c.quantity ?? 1)),
                            displayOrder: c.displayOrder ?? idx,
                        })),
                    })]
                : []),
        ]);
    }
    async toggleItemAvailability(id) {
        const item = await this.prisma.item.findUnique({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException('Item not found');
        return this.prisma.item.update({
            where: { id },
            data: { isAvailable: !item.isAvailable },
        });
    }
    async toggleItemVisibility(id) {
        const item = await this.prisma.item.findUnique({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException('Item not found');
        return this.prisma.item.update({
            where: { id },
            data: { isDisplayed: !item.isDisplayed },
        });
    }
    async adjustItemStock(id, body) {
        const item = await this.prisma.item.findUnique({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException('Item not found');
        if (!item.hasLimitedStock) {
            throw new common_1.BadRequestException('Item is not in limited-stock mode — turn on Limited Stock first');
        }
        let next;
        if (body.setQuantity !== undefined) {
            if (body.setQuantity < 0)
                throw new common_1.BadRequestException('setQuantity must be ≥ 0');
            next = Math.floor(body.setQuantity);
        }
        else if (body.addQuantity !== undefined) {
            if (body.addQuantity <= 0)
                throw new common_1.BadRequestException('addQuantity must be > 0');
            next = item.availableQuantity + Math.floor(body.addQuantity);
        }
        else {
            throw new common_1.BadRequestException('Provide addQuantity or setQuantity');
        }
        return this.prisma.item.update({
            where: { id },
            data: {
                availableQuantity: next,
                ...(next > 0 ? { isAvailable: true } : {}),
            },
        });
    }
    async deleteItem(id) {
        const orderItemCount = await this.prisma.orderItem.count({ where: { itemId: id } });
        if (orderItemCount > 0) {
            return this.prisma.item.update({
                where: { id },
                data: { isDisplayed: false, isAvailable: false },
            });
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.itemTag.deleteMany({ where: { itemId: id } });
            await tx.option.deleteMany({ where: { itemId: id } });
            await tx.variant.deleteMany({ where: { itemId: id } });
            return tx.item.delete({ where: { id } });
        });
    }
    async createVariant(itemId, data) {
        const variant = await this.prisma.variant.create({ data: { ...data, itemId } });
        await this.translations.upsertAll('Variant', variant.id, {
            name: variant.name,
            shortDescription: variant.shortDescription ?? undefined,
        });
        return variant;
    }
    async addItemImage(itemId, url) {
        const max = await this.prisma.itemImage.aggregate({
            where: { itemId },
            _max: { displayOrder: true },
        });
        return this.prisma.itemImage.create({
            data: { itemId, url, displayOrder: (max._max.displayOrder ?? -1) + 1 },
        });
    }
    async removeItemImage(imageId) {
        return this.prisma.itemImage.delete({ where: { id: imageId } });
    }
    async reorderItemImages(itemId, orderedIds) {
        await this.prisma.$transaction(orderedIds.map((id, idx) => this.prisma.itemImage.update({
            where: { id },
            data: { displayOrder: idx },
        })));
        return this.prisma.itemImage.findMany({
            where: { itemId },
            orderBy: { displayOrder: 'asc' },
        });
    }
    async updateVariant(id, data) {
        const variant = await this.prisma.variant.update({ where: { id }, data });
        if (data.name !== undefined || data.shortDescription !== undefined) {
            await this.translations.upsertAll('Variant', variant.id, {
                name: variant.name,
                shortDescription: variant.shortDescription ?? undefined,
            });
        }
        return variant;
    }
    async deleteVariant(id) {
        const orderItemCount = await this.prisma.orderItem.count({ where: { variantId: id } });
        if (orderItemCount > 0) {
            return this.prisma.variant.update({ where: { id }, data: { isAvailable: false } });
        }
        return this.prisma.variant.delete({ where: { id } });
    }
    async createOption(itemId, data) {
        return this.prisma.option.create({ data: { ...data, itemId } });
    }
    async getPopularItems(outletId) {
        return this.prisma.item.findMany({
            where: {
                isPopular: true,
                isAvailable: true,
                isDisplayed: true,
                subcategory: { category: { outletId } },
            },
            include: { variants: true },
            take: 10,
        });
    }
    async importFromOutlet(targetOutletId, sourceOutletId) {
        if (targetOutletId === sourceOutletId) {
            throw new common_1.BadRequestException('Source and target outlet must differ');
        }
        const [target, source] = await Promise.all([
            this.prisma.outlet.findUnique({ where: { id: targetOutletId }, select: { id: true, businessId: true } }),
            this.prisma.outlet.findUnique({ where: { id: sourceOutletId }, select: { id: true, businessId: true } }),
        ]);
        if (!target)
            throw new common_1.NotFoundException('Target outlet not found');
        if (!source)
            throw new common_1.NotFoundException('Source outlet not found');
        if (target.businessId !== source.businessId) {
            throw new common_1.BadRequestException('Outlets must belong to the same business');
        }
        const existing = await this.prisma.category.count({
            where: { outletId: targetOutletId, isActive: true },
        });
        if (existing > 0) {
            throw new common_1.BadRequestException('Target menu is not empty — delete categories first or pick an empty outlet');
        }
        const sourceCategories = await this.prisma.category.findMany({
            where: { outletId: sourceOutletId, isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
                subcategories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        items: {
                            where: { isDisplayed: true },
                            orderBy: { displayOrder: 'asc' },
                            include: { variants: true, options: true, tags: true },
                        },
                    },
                },
            },
        });
        let categoriesCount = 0;
        let subcategoriesCount = 0;
        let itemsCount = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const cat of sourceCategories) {
                const newCat = await tx.category.create({
                    data: {
                        outletId: targetOutletId,
                        name: cat.name,
                        imageUrl: cat.imageUrl,
                        displayOrder: cat.displayOrder,
                        menuId: cat.menuId ?? undefined,
                    },
                });
                categoriesCount++;
                for (const sub of cat.subcategories) {
                    const newSub = await tx.subcategory.create({
                        data: {
                            categoryId: newCat.id,
                            name: sub.name,
                            displayOrder: sub.displayOrder,
                        },
                    });
                    subcategoriesCount++;
                    for (const item of sub.items) {
                        const newItem = await tx.item.create({
                            data: {
                                subcategoryId: newSub.id,
                                name: item.name,
                                description: item.description,
                                basePrice: item.basePrice,
                                parcelCharge: item.parcelCharge,
                                preparationTime: item.preparationTime,
                                imageUrl: item.imageUrl,
                                isPopular: item.isPopular,
                                isAvailable: item.isAvailable,
                                isDisplayed: item.isDisplayed,
                                displayOrder: item.displayOrder,
                            },
                        });
                        itemsCount++;
                        if (item.variants.length) {
                            await tx.variant.createMany({
                                data: item.variants.map(v => ({
                                    itemId: newItem.id,
                                    name: v.name,
                                    price: v.price,
                                    isAvailable: v.isAvailable,
                                })),
                            });
                        }
                        if (item.options.length) {
                            await tx.option.createMany({
                                data: item.options.map(o => ({
                                    itemId: newItem.id,
                                    name: o.name,
                                    price: o.price,
                                })),
                            });
                        }
                        if (item.tags.length) {
                            await tx.itemTag.createMany({
                                data: item.tags.map(t => ({
                                    itemId: newItem.id,
                                    name: t.name,
                                })),
                            });
                        }
                    }
                }
            }
        });
        return { categories: categoriesCount, subcategories: subcategoriesCount, items: itemsCount };
    }
    async getBusinessMenu(businessId, lang) {
        const categories = await this.prisma.category.findMany({
            where: { businessId, isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
                subcategories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        items: {
                            where: { isDisplayed: true },
                            orderBy: { displayOrder: 'asc' },
                            include: { variants: true },
                        },
                    },
                },
            },
        });
        return this.hydrateMenu(categories, lang);
    }
    async createBusinessCategory(businessId, dto) {
        let menuId = dto.menuId ?? null;
        if (!menuId) {
            const defaultMenu = await this.prisma.menu.findFirst({
                where: { businessId, isDefault: true },
                select: { id: true },
            });
            menuId = defaultMenu?.id ?? null;
        }
        const cat = await this.prisma.category.create({
            data: {
                businessId,
                name: dto.name,
                imageUrl: dto.imageUrl,
                displayOrder: dto.displayOrder ?? 0,
                menuId: menuId ?? undefined,
            },
        });
        await this.translations.upsertAll('Category', cat.id, { name: cat.name });
        return cat;
    }
    async updateBusinessCategory(id, dto) {
        const cat = await this.prisma.category.update({ where: { id }, data: dto });
        if (dto.name)
            await this.translations.upsertAll('Category', cat.id, { name: cat.name });
        return cat;
    }
    async deleteBusinessCategory(id) {
        const subs = await this.prisma.subcategory.findMany({ where: { categoryId: id }, select: { id: true } });
        for (const s of subs) {
            const items = await this.prisma.item.findMany({ where: { subcategoryId: s.id }, select: { id: true } });
            for (const it of items) {
                await this.prisma.translation.deleteMany({ where: { entityType: 'Item', entityId: it.id } });
                await this.prisma.variant.deleteMany({ where: { itemId: it.id } });
            }
            await this.prisma.item.deleteMany({ where: { subcategoryId: s.id } });
            await this.prisma.translation.deleteMany({ where: { entityType: 'Subcategory', entityId: s.id } });
        }
        await this.prisma.subcategory.deleteMany({ where: { categoryId: id } });
        await this.prisma.translation.deleteMany({ where: { entityType: 'Category', entityId: id } });
        return this.prisma.category.delete({ where: { id } });
    }
    async createBusinessSubcategory(categoryId, dto) {
        const cat = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { businessId: true } });
        if (!cat?.businessId)
            throw new common_1.BadRequestException('Category does not belong to a business template');
        const sub = await this.prisma.subcategory.create({
            data: { categoryId, name: dto.name, displayOrder: dto.displayOrder ?? 0 },
        });
        await this.translations.upsertAll('Subcategory', sub.id, { name: sub.name });
        return sub;
    }
    async createBusinessItem(subcategoryId, dto) {
        const sub = await this.prisma.subcategory.findUnique({
            where: { id: subcategoryId },
            include: { category: { select: { businessId: true } } },
        });
        if (!sub?.category?.businessId)
            throw new common_1.BadRequestException('Subcategory does not belong to a business template');
        const item = await this.prisma.item.create({ data: { subcategoryId, ...dto } });
        await this.translations.upsertAll('Item', item.id, {
            name: item.name,
            description: item.description ?? undefined,
            shortDescription: item.shortDescription ?? undefined,
        });
        return item;
    }
    async importFromBusiness(targetOutletId, sourceBusinessId, itemIds) {
        const [target, source] = await Promise.all([
            this.prisma.outlet.findUnique({
                where: { id: targetOutletId },
                select: { id: true, businessId: true, gstApplicable: true, gstPercent: true },
            }),
            this.prisma.business.findUnique({ where: { id: sourceBusinessId }, select: { id: true } }),
        ]);
        if (!target)
            throw new common_1.NotFoundException('Target outlet not found');
        if (!source)
            throw new common_1.NotFoundException('Source business not found');
        if (target.businessId !== sourceBusinessId) {
            throw new common_1.BadRequestException('Outlet does not belong to the source business');
        }
        const defaultGst = target.gstApplicable ? target.gstPercent : null;
        const itemFilter = itemIds && itemIds.length ? { id: { in: itemIds } } : undefined;
        const sourceCategories = await this.prisma.category.findMany({
            where: { businessId: sourceBusinessId, isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
                subcategories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        items: itemFilter
                            ? { where: itemFilter, orderBy: { displayOrder: 'asc' }, include: { variants: true } }
                            : { orderBy: { displayOrder: 'asc' }, include: { variants: true } },
                    },
                },
            },
        });
        let categoriesCount = 0;
        let subcategoriesCount = 0;
        let itemsCount = 0;
        const translationJobs = [];
        await this.prisma.$transaction(async (tx) => {
            for (const cat of sourceCategories) {
                const hasItemsInScope = cat.subcategories.some((s) => s.items.length > 0);
                if (itemFilter && !hasItemsInScope)
                    continue;
                let outletCat = await tx.category.findFirst({
                    where: {
                        outletId: targetOutletId,
                        name: cat.name,
                        menuId: cat.menuId ?? null,
                        isActive: true,
                    },
                });
                if (!outletCat) {
                    outletCat = await tx.category.create({
                        data: {
                            outletId: targetOutletId,
                            name: cat.name,
                            imageUrl: cat.imageUrl,
                            displayOrder: cat.displayOrder,
                            menuId: cat.menuId ?? undefined,
                        },
                    });
                    categoriesCount++;
                    translationJobs.push({ entityType: 'Category', entityId: outletCat.id, fields: { name: outletCat.name } });
                }
                for (const sub of cat.subcategories) {
                    if (itemFilter && sub.items.length === 0)
                        continue;
                    let outletSub = await tx.subcategory.findFirst({
                        where: { categoryId: outletCat.id, name: sub.name, isActive: true },
                    });
                    if (!outletSub) {
                        outletSub = await tx.subcategory.create({
                            data: { categoryId: outletCat.id, name: sub.name, displayOrder: sub.displayOrder },
                        });
                        subcategoriesCount++;
                        translationJobs.push({ entityType: 'Subcategory', entityId: outletSub.id, fields: { name: outletSub.name } });
                    }
                    for (const item of sub.items) {
                        const existingItem = await tx.item.findFirst({
                            where: { subcategoryId: outletSub.id, name: item.name },
                        });
                        if (existingItem)
                            continue;
                        const newItem = await tx.item.create({
                            data: {
                                subcategoryId: outletSub.id,
                                name: item.name,
                                description: item.description,
                                shortDescription: item.shortDescription,
                                basePrice: item.basePrice,
                                gstRate: item.gstRate ?? defaultGst,
                                parcelAvailable: item.parcelAvailable,
                                useCustomParcelCharge: item.useCustomParcelCharge,
                                parcelCharge: item.parcelCharge,
                                preparationTime: item.preparationTime,
                                foodGrade: item.foodGrade,
                                isPopular: item.isPopular,
                                isAvailable: item.isAvailable,
                                isDisplayed: item.isDisplayed,
                                imageUrl: item.imageUrl,
                                displayOrder: item.displayOrder,
                            },
                        });
                        itemsCount++;
                        translationJobs.push({
                            entityType: 'Item',
                            entityId: newItem.id,
                            fields: {
                                name: newItem.name,
                                description: newItem.description ?? undefined,
                                shortDescription: newItem.shortDescription ?? undefined,
                            },
                        });
                        if (item.variants.length) {
                            for (const v of item.variants) {
                                const newVariant = await tx.variant.create({
                                    data: {
                                        itemId: newItem.id,
                                        name: v.name,
                                        price: v.price,
                                        isAvailable: v.isAvailable,
                                    },
                                });
                                translationJobs.push({ entityType: 'Variant', entityId: newVariant.id, fields: { name: newVariant.name } });
                            }
                        }
                    }
                }
            }
        });
        void (async () => {
            for (const job of translationJobs) {
                try {
                    await this.translations.upsertAll(job.entityType, job.entityId, job.fields);
                }
                catch (err) {
                    console.warn(`[importFromBusiness] translate ${job.entityType}/${job.entityId} failed`, err);
                }
            }
        })();
        return { categories: categoriesCount, subcategories: subcategoriesCount, items: itemsCount };
    }
};
exports.MenuService = MenuService;
exports.MenuService = MenuService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        translations_service_1.TranslationsService])
], MenuService);
//# sourceMappingURL=menu.service.js.map