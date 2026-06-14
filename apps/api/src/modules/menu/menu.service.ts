import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
import { DiscountsService } from '../discounts/discounts.service';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
    private discounts: DiscountsService,
  ) {}

  // Translate every menu-bearing entity in a single getMenu response.
  private async hydrateMenu(categories: any[], lang: string | null | undefined) {
    if (!lang || lang === 'en' || !categories.length) return categories;
    const cats: any[] = categories;
    const subs: any[] = categories.flatMap((c) => c.subcategories ?? []);
    const items: any[] = subs.flatMap((s) => s.items ?? []);
    const variants: any[] = items.flatMap((i) => i.variants ?? []);
    const toppings: any[] = items
      .flatMap((i) => i.itemToppings ?? [])
      .map((t) => t.topping)
      .filter(Boolean);

    await Promise.all([
      this.translations.hydrate('Category',    cats,     ['name'],                lang),
      this.translations.hydrate('Subcategory', subs,     ['name'],                lang),
      this.translations.hydrate('Item',        items,    ['name', 'description'], lang),
      this.translations.hydrate('Variant',     variants, ['name', 'shortDescription'], lang),
      this.translations.hydrate('Topping',     toppings, ['name'],                lang),
    ]);
    return categories;
  }

  // ─── Categories ──────────────────────────────────────────

  async getMenu(
    outletId: string,
    viewerUserId?: string,
    tableId?: string,
    lang?: string | null,
    // When true, include items where isDisplayed=false. Admin tools (menu
    // editor, bundle picker) pass this so they can see/manage hidden items
    // — e.g. a "mini dosa" that's only ever sold as part of a combo.
    opts?: { includeHidden?: boolean },
  ) {
    // Resolve which menus are visible to this caller right now. This is the
    // single source of truth for menu visibility — both the customer app and
    // staff PlaceOrderPage hit this endpoint, so filtering here covers both.
    //   • Outlet.multipleMenusEnabled = false → only the default menu's
    //     categories are returned, regardless of any other menus that exist.
    //   • Outlet.multipleMenusEnabled = true  → include menus where the
    //     OutletMenu link has isEnabled=true (default menu always counts),
    //     minus any menus the table's section has disabled.
    const outletMeta = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { multipleMenusEnabled: true, businessId: true },
    });
    let allowedMenuIds: string[] = [];
    if (outletMeta) {
      const defaultMenu = await this.prisma.menu.findFirst({
        where: { businessId: outletMeta.businessId, isDefault: true },
        select: { id: true },
      });
      if (!outletMeta.multipleMenusEnabled) {
        allowedMenuIds = defaultMenu ? [defaultMenu.id] : [];
      } else {
        const links = await this.prisma.outletMenu.findMany({
          where: { outletId, isEnabled: true },
          select: { menuId: true },
        });
        const enabled = new Set<string>(links.map((l) => l.menuId));
        if (defaultMenu) enabled.add(defaultMenu.id);
        // Table-type-level disables (legacy / "Patio table" style grouping)
        // AND section-level disables (physical area: "VIP room", "Bar"
        // etc.). Both apply when a table QR is scanned — section wins
        // when both reference the same menu (more specific to the
        // physical location the customer is sitting in).
        if (tableId) {
          const table = await this.prisma.table.findUnique({
            where: { id: tableId },
            select: { tableTypeId: true, sectionId: true, outletId: true },
          });
          if (table && table.outletId === outletId) {
            if (table.tableTypeId) {
              const sectionDisabled = await this.prisma.tableTypeMenu.findMany({
                where: { tableTypeId: table.tableTypeId, isEnabled: false },
                select: { menuId: true },
              });
              for (const s of sectionDisabled) {
                if (defaultMenu && s.menuId === defaultMenu.id) continue;
                enabled.delete(s.menuId);
              }
            }
            if (table.sectionId) {
              const sectionDisables = await this.prisma.menuSectionExclusion.findMany({
                where: { sectionId: table.sectionId },
                select: { menuId: true },
              });
              for (const s of sectionDisables) {
                // The default menu is the floor — never disabled, even
                // if an admin accidentally adds an exclusion row for it.
                if (defaultMenu && s.menuId === defaultMenu.id) continue;
                enabled.delete(s.menuId);
              }
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
        // Only include categories whose menu is currently visible. Legacy
        // categories with no menuId fall back to the default menu.
        OR: [
          { menuId: { in: allowedMenuIds } },
          ...(outletMeta && !outletMeta.multipleMenusEnabled
            ? [{ menuId: null }] // single-menu mode shows unassigned too
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

    // Resolve viewer's tag for this outlet (if any) and project effective price
    let viewerTagId: string | null = null;
    if (viewerUserId) {
      const assignment = await this.prisma.customerTagAssignment.findUnique({
        where: { userId_outletId: { userId: viewerUserId, outletId } },
      });
      viewerTagId = assignment?.customerTagId ?? null;
    }

    // Resolve table type (table-service context). Takes precedence over customer-tag pricing.
    let tableTypeId: string | null = null;
    if (tableId) {
      const table = await this.prisma.table.findUnique({
        where: { id: tableId },
        select: { tableTypeId: true, outletId: true },
      });
      if (table?.outletId === outletId) tableTypeId = table.tableTypeId;
    }

    // Auto-detect top 5 ordered items at this outlet over the last 30 days
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

    // Viewer's favourites
    let favoriteSet = new Set<string>();
    if (viewerUserId) {
      const favs = await this.prisma.favorite.findMany({
        where: { userId: viewerUserId },
        select: { itemId: true },
      });
      favoriteSet = new Set(favs.map(f => f.itemId));
    }

    // Pick the most-specific price override. Order: CustomerTag > TableType > base.
    // Rationale: a tagged customer (e.g. VIP / Staff) gets their tag price regardless of which
    // table they're seated at; table-type pricing only applies to walk-ins / untagged customers.
    const pickItemPrice = (item: any, variantId?: string) => {
      if (viewerTagId) {
        const ct = item.customerTagPrices.find(
          (p: any) => p.customerTagId === viewerTagId
            && ((variantId ? p.variantId === variantId : !p.variantId)),
        );
        if (ct) return { price: Number(ct.price), source: 'CUSTOMER_TAG' as const, id: viewerTagId };
      }
      if (tableTypeId) {
        const tt = item.tableTypePrices.find(
          (p: any) => p.tableTypeId === tableTypeId
            && ((variantId ? p.variantId === variantId : !p.variantId)),
        );
        if (tt) return { price: Number(tt.price), source: 'TABLE_TYPE' as const, id: tableTypeId };
      }
      return null;
    };

    await this.hydrateMenu(categories, lang);

    // Active line-level auto-discounts (ITEM / SUBCATEGORY / CATEGORY).
    // Surfaced on each item so the customer menu can render strikethrough
    // pricing with the savings badge. Bill-level discounts apply to the
    // whole cart and are computed at /cart/quote — they don't decorate
    // individual menu items.
    const activeAutoDiscounts = await this.discounts.activeAutoForOutlet(outletId);
    const lineDiscounts = activeAutoDiscounts.filter(
      (d: any) => d.targetType === 'ITEM'
        || d.targetType === 'SUBCATEGORY'
        || d.targetType === 'CATEGORY',
    );
    const computeLineDiscount = (
      candidates: any[],
      basePrice: number,
    ): { name: string; discountedPrice: number; saveAmount: number } | null => {
      if (!candidates.length || basePrice <= 0) return null;
      let best: { d: any; save: number } | null = null;
      for (const d of candidates) {
        let amt = d.discountType === 'PERCENT'
          ? (basePrice * Number(d.discountValue)) / 100
          : Number(d.discountValue);
        if (d.maxDiscountAmount) amt = Math.min(amt, Number(d.maxDiscountAmount));
        amt = Math.min(amt, basePrice);
        if (amt <= 0) continue;
        if (!best || amt > best.save) best = { d, save: amt };
      }
      if (!best) return null;
      return {
        name: best.d.name,
        discountedPrice: Math.round((basePrice - best.save) * 100) / 100,
        saveAmount: Math.round(best.save * 100) / 100,
      };
    };

    // Aggregate review stats for every item on the menu in one query so the
    // customer can see the consolidated rating chip without an extra round-trip.
    const itemIds = categories.flatMap((c: any) =>
      c.subcategories.flatMap((s: any) => s.items.map((i: any) => i.id)),
    );
    const ratingRows = itemIds.length
      ? await this.prisma.orderItemReview.groupBy({
          by: ['itemId'],
          where: { itemId: { in: itemIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];
    const ratingByItem = new Map<string, { avg: number; count: number }>();
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
          const itemEffective = itemOv ? itemOv.price : Number(item.basePrice);
          // Candidate discounts for this item — ITEM matches the row,
          // SUBCATEGORY matches its parent sub, CATEGORY matches the
          // sub's category. Same candidate set drives both the item-
          // level price and each variant's price (PERCENT scales).
          const candidates = lineDiscounts.filter((d: any) => {
            if (d.targetType === 'ITEM') return d.itemId === item.id;
            if (d.targetType === 'SUBCATEGORY') return d.subcategoryId === sub.id;
            if (d.targetType === 'CATEGORY') return d.categoryId === cat.id;
            return false;
          });
          const variants = item.variants.map((v: any) => {
            const vOv = pickItemPrice(item, v.id);
            const variantEffective = vOv ? vOv.price : Number(v.price);
            return {
              ...v,
              effectivePrice: variantEffective,
              appliedTagId: vOv?.source === 'CUSTOMER_TAG' ? vOv.id : null,
              appliedTableTypeId: vOv?.source === 'TABLE_TYPE' ? vOv.id : null,
              discountInfo: computeLineDiscount(candidates, variantEffective),
            };
          });
          const rating = ratingByItem.get(item.id) ?? { avg: 0, count: 0 };
          return {
            ...item,
            variants,
            effectivePrice: itemEffective,
            appliedTagId: itemOv?.source === 'CUSTOMER_TAG' ? itemOv.id : null,
            appliedTableTypeId: itemOv?.source === 'TABLE_TYPE' ? itemOv.id : null,
            // Active line-level discount on the item's base price.
            // The pricing engine applies the same rule at /cart/quote so
            // the menu badge and the actual bill stay in sync.
            discountInfo: computeLineDiscount(candidates, itemEffective),
            // Computed flags:
            isPopular: popularSet.has(item.id) || item.isPopular,
            isFavorite: favoriteSet.has(item.id),
            // Review aggregates: avg rating (rounded to 1 decimal) + count.
            ratingAvg: rating.avg,
            ratingCount: rating.count,
          };
        }),
      })),
    }));
  }

  async createCategory(outletId: string, data: { name: string; imageUrl?: string; menuId?: string }) {
    // Resolve a menuId so the new category lands inside a menu. When the
    // caller hasn't specified one we use the outlet's business's default menu.
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

  async updateCategory(id: string, data: Partial<{ name: string; imageUrl: string; displayOrder: number; isActive: boolean }>) {
    const category = await this.prisma.category.update({ where: { id }, data });
    if (data.name !== undefined) {
      await this.translations.upsertAll('Category', category.id, { name: category.name });
    }
    return category;
  }

  async deleteCategory(id: string) {
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
      if (subIds.length) await tx.subcategory.deleteMany({ where: { id: { in: subIds } } });
      return tx.category.delete({ where: { id } });
    });
  }

  // ─── Subcategories ────────────────────────────────────────

  async createSubcategory(categoryId: string, data: { name: string; imageUrl?: string | null }) {
    const sub = await this.prisma.subcategory.create({ data: { ...data, categoryId } });
    await this.translations.upsertAll('Subcategory', sub.id, { name: sub.name });
    return sub;
  }

  async updateSubcategory(id: string, data: Partial<{ name: string; imageUrl: string | null; displayOrder: number; isActive: boolean }>) {
    const sub = await this.prisma.subcategory.update({ where: { id }, data });
    if (data.name !== undefined) {
      await this.translations.upsertAll('Subcategory', sub.id, { name: sub.name });
    }
    return sub;
  }

  // ─── Items ────────────────────────────────────────────────

  async createItem(subcategoryId: string, data: any) {
    // If the caller didn't set a GST rate, inherit from the outlet's default
    // (Outlet.gstPercent) so newly-created items are taxed consistently with
    // the rest of the menu. Business-template items have no outlet — leave
    // gstRate null and let the importing outlet inherit at import time.
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
        if (outlet?.gstApplicable) data.gstRate = outlet.gstPercent;
      }
    }
    // Pull bundleChildren off the payload — they're stored in a separate
    // join table after the item is created.
    const { bundleChildren, ...itemData } = data || {};
    // Frontend forms historically post `price` (UI label) and `type`
    // (vegetarian classification). The Item schema names these basePrice
    // and foodGrade. Normalize so either spelling works on the wire.
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
        shortDescription: (v as any).shortDescription ?? undefined,
      });
    }
    return item;
  }

  async updateItem(id: string, data: any) {
    const { bundleChildren, ...itemData } = data || {};
    const item = await this.prisma.item.update({
      where: { id },
      data: itemData,
      include: { variants: true, options: true },
    });
    if (Array.isArray(bundleChildren)) {
      // Empty array clears all children; null/undefined leaves them alone.
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

  // Bundle children: replace the entire set in one transaction so the admin
  // can drag-reorder, swap items in/out and tweak quantities atomically.
  private async replaceBundleChildren(
    parentItemId: string,
    children: Array<{ childItemId: string; variantId?: string | null; quantity?: number; displayOrder?: number }>,
  ) {
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

  async toggleItemAvailability(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.item.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });
  }

  // Toggle whether this item is visible on the customer menu. Hidden items
  // still exist and can be ordered indirectly (e.g. inside a bundle); they
  // just don't show up in the customer's category listing.
  async toggleItemVisibility(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.item.update({
      where: { id },
      data: { isDisplayed: !item.isDisplayed },
    });
  }

  /**
   * Outlet staff stock adjustments. `addQuantity` is the normal flow (top up
   * existing stock); `setQuantity` is for recounts / corrections. Adding
   * positive stock automatically re-enables the item if it was auto-disabled
   * when the previous batch sold out.
   */
  async adjustItemStock(id: string, body: { addQuantity?: number; setQuantity?: number }) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    if (!item.hasLimitedStock) {
      throw new BadRequestException('Item is not in limited-stock mode — turn on Limited Stock first');
    }

    let next: number;
    if (body.setQuantity !== undefined) {
      if (body.setQuantity < 0) throw new BadRequestException('setQuantity must be ≥ 0');
      next = Math.floor(body.setQuantity);
    } else if (body.addQuantity !== undefined) {
      if (body.addQuantity <= 0) throw new BadRequestException('addQuantity must be > 0');
      next = item.availableQuantity + Math.floor(body.addQuantity);
    } else {
      throw new BadRequestException('Provide addQuantity or setQuantity');
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        availableQuantity: next,
        // Auto-flip back on once stock is positive again. Don't touch when
        // setting to 0 (staff may want to keep it hidden manually).
        ...(next > 0 ? { isAvailable: true } : {}),
      },
    });
  }

  async deleteItem(id: string) {
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

  // ─── Variants ─────────────────────────────────────────────

  async createVariant(itemId: string, data: { name: string; price: number; shortDescription?: string; unitQuantity?: number | null }) {
    const variant = await this.prisma.variant.create({ data: { ...data, itemId } });
    await this.translations.upsertAll('Variant', variant.id, {
      name: variant.name,
      shortDescription: (variant as any).shortDescription ?? undefined,
    });
    return variant;
  }

  // ─── Item gallery images ─────────────────────────────────
  async addItemImage(itemId: string, url: string) {
    const max = await this.prisma.itemImage.aggregate({
      where: { itemId },
      _max: { displayOrder: true },
    });
    return this.prisma.itemImage.create({
      data: { itemId, url, displayOrder: (max._max.displayOrder ?? -1) + 1 },
    });
  }

  async removeItemImage(imageId: string) {
    return this.prisma.itemImage.delete({ where: { id: imageId } });
  }

  async reorderItemImages(itemId: string, orderedIds: string[]) {
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.itemImage.update({
          where: { id },
          data: { displayOrder: idx },
        }),
      ),
    );
    return this.prisma.itemImage.findMany({
      where: { itemId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // ─── Reorder: categories / subcategories / items ──────────
  // Same pattern as reorderItemImages: client sends the new order, server
  // writes displayOrder = array index in one transaction. The scope filter
  // (outletId / businessId / parent id) doubles as the cross-tenant guard so
  // a caller cannot stamp displayOrder on a row that doesn't belong to its
  // tier — bad ids simply fall out of the WHERE and the count mismatch trips
  // a BadRequest.
  private async assertOwnership(found: number, expected: number, label: string) {
    if (found !== expected) {
      throw new BadRequestException(`One or more ${label} do not belong to this scope`);
    }
  }

  async reorderCategories(
    scope: { outletId?: string; businessId?: string },
    orderedIds: string[],
  ) {
    if (!orderedIds?.length) return { reordered: 0 };
    const where: any = { id: { in: orderedIds } };
    if (scope.outletId) where.outletId = scope.outletId;
    if (scope.businessId) where.businessId = scope.businessId;
    const owned = await this.prisma.category.findMany({ where, select: { id: true } });
    await this.assertOwnership(owned.length, orderedIds.length, 'categories');
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.category.update({ where: { id }, data: { displayOrder: idx } }),
      ),
    );
    return { reordered: orderedIds.length };
  }

  async reorderSubcategories(categoryId: string, orderedIds: string[]) {
    if (!orderedIds?.length) return { reordered: 0 };
    const owned = await this.prisma.subcategory.findMany({
      where: { id: { in: orderedIds }, categoryId },
      select: { id: true },
    });
    await this.assertOwnership(owned.length, orderedIds.length, 'subcategories');
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.subcategory.update({ where: { id }, data: { displayOrder: idx } }),
      ),
    );
    return { reordered: orderedIds.length };
  }

  async reorderItems(subcategoryId: string, orderedIds: string[]) {
    if (!orderedIds?.length) return { reordered: 0 };
    const owned = await this.prisma.item.findMany({
      where: { id: { in: orderedIds }, subcategoryId },
      select: { id: true },
    });
    await this.assertOwnership(owned.length, orderedIds.length, 'items');
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.item.update({ where: { id }, data: { displayOrder: idx } }),
      ),
    );
    return { reordered: orderedIds.length };
  }

  async updateVariant(id: string, data: Partial<{ name: string; shortDescription: string | null; price: number; isAvailable: boolean }>) {
    const variant = await this.prisma.variant.update({ where: { id }, data });
    if (data.name !== undefined || data.shortDescription !== undefined) {
      await this.translations.upsertAll('Variant', variant.id, {
        name: variant.name,
        shortDescription: (variant as any).shortDescription ?? undefined,
      });
    }
    return variant;
  }

  async deleteVariant(id: string) {
    const orderItemCount = await this.prisma.orderItem.count({ where: { variantId: id } });
    if (orderItemCount > 0) {
      return this.prisma.variant.update({ where: { id }, data: { isAvailable: false } });
    }
    return this.prisma.variant.delete({ where: { id } });
  }

  // ─── Options ──────────────────────────────────────────────

  async createOption(itemId: string, data: { name: string; price: number }) {
    return this.prisma.option.create({ data: { ...data, itemId } });
  }

  async getPopularItems(outletId: string) {
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

  // Outlet-to-outlet menu import has been removed by product decision —
  // outlets may only import from the parent business template.

  /* ── Business-template menu ──────────────────────────────
   *
   * Business owners curate a master menu that outlets can optionally import.
   * Templates only carry categories / subcategories / items / variants —
   * outlet-specific concerns (toppings, tag pricing, table-type pricing) are
   * set up at the outlet level after import.
   */

  async getBusinessMenu(businessId: string, lang?: string | null) {
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

  async createBusinessCategory(businessId: string, dto: { name: string; imageUrl?: string; displayOrder?: number; menuId?: string }) {
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

  async updateBusinessCategory(id: string, dto: { name?: string; imageUrl?: string; displayOrder?: number; isActive?: boolean }) {
    const cat = await this.prisma.category.update({ where: { id }, data: dto });
    if (dto.name) await this.translations.upsertAll('Category', cat.id, { name: cat.name });
    return cat;
  }

  async deleteBusinessCategory(id: string) {
    // Cascade: any subcategories+items under this template category.
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

  async createBusinessSubcategory(categoryId: string, dto: { name: string; displayOrder?: number }) {
    const cat = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { businessId: true } });
    if (!cat?.businessId) throw new BadRequestException('Category does not belong to a business template');
    const sub = await this.prisma.subcategory.create({
      data: { categoryId, name: dto.name, displayOrder: dto.displayOrder ?? 0 },
    });
    await this.translations.upsertAll('Subcategory', sub.id, { name: sub.name });
    return sub;
  }

  async createBusinessItem(subcategoryId: string, dto: any) {
    const sub = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: { category: { select: { businessId: true } } },
    });
    if (!sub?.category?.businessId) throw new BadRequestException('Subcategory does not belong to a business template');
    // bundleChildren is a join-table relation, not a scalar column — strip it
    // off the payload and apply it via replaceBundleChildren after create,
    // mirroring the outlet-level createItem path.
    const { bundleChildren, ...itemData } = dto || {};
    const item = await this.prisma.item.create({ data: { subcategoryId, ...itemData } });
    if (Array.isArray(bundleChildren) && bundleChildren.length) {
      await this.replaceBundleChildren(item.id, bundleChildren);
    }
    await this.translations.upsertAll('Item', item.id, {
      name: item.name,
      description: item.description ?? undefined,
      shortDescription: item.shortDescription ?? undefined,
    });
    return item;
  }

  // Import from the parent business template. The selection model is
  // explicit at three levels:
  //   • categoryIds    — bring the whole category (every sub, every item)
  //   • subcategoryIds — bring the whole sub (every item)
  //   • itemIds        — bring just these items
  // At least one of the three must be non-empty. We deliberately do NOT
  // wholesale-import the entire template any more; that surprised outlets.
  // Touched menus are auto-linked + enabled on the outlet so the imported
  // categories become visible immediately.
  async importFromBusiness(
    targetOutletId: string,
    sourceBusinessId: string,
    selection: { categoryIds?: string[]; subcategoryIds?: string[]; itemIds?: string[] } = {},
  ) {
    const catIds = selection.categoryIds ?? [];
    const subIds = selection.subcategoryIds ?? [];
    const itemIds = selection.itemIds ?? [];
    if (catIds.length + subIds.length + itemIds.length === 0) {
      throw new BadRequestException('Pick at least one category, subcategory, or item to import');
    }

    const [target, source] = await Promise.all([
      this.prisma.outlet.findUnique({
        where: { id: targetOutletId },
        select: { id: true, businessId: true, gstApplicable: true, gstPercent: true },
      }),
      this.prisma.business.findUnique({ where: { id: sourceBusinessId }, select: { id: true } }),
    ]);
    if (!target) throw new NotFoundException('Target outlet not found');
    if (!source) throw new NotFoundException('Source business not found');
    if (target.businessId !== sourceBusinessId) {
      throw new BadRequestException('Outlet does not belong to the source business');
    }
    // Template items have no outlet, so they don't carry a GST rate. Inherit
    // the target outlet's default when copying so the new item is taxed correctly.
    const defaultGst = target.gstApplicable ? target.gstPercent : null;

    const catSet = new Set(catIds);
    const subSet = new Set(subIds);
    const itemSet = new Set(itemIds);

    // Pull the full tree once. Filtering happens in-memory below so the same
    // category can be "wholly picked" (catSet) and partially picked (some
    // items also in itemSet) without double-fetching.
    const sourceCategories = await this.prisma.category.findMany({
      where: { businessId: sourceBusinessId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            items: { orderBy: { displayOrder: 'asc' }, include: { variants: true } },
          },
        },
      },
    });

    let categoriesCount = 0;
    let subcategoriesCount = 0;
    let itemsCount = 0;
    // Collect rows that need translations and fan them out *after* the
    // transaction commits — external HTTP calls to the translation provider
    // would otherwise blow the default Prisma 5-second transaction timeout.
    type TranslationJob = { entityType: string; entityId: string; fields: Record<string, string | null | undefined> };
    const translationJobs: TranslationJob[] = [];
    // Menus touched by this import — we'll upsert OutletMenu links for each.
    const touchedMenuIds = new Set<string>();

    await this.prisma.$transaction(async (tx) => {
      for (const cat of sourceCategories) {
        const wholeCat = catSet.has(cat.id);
        // Sub is in scope if the whole cat is picked, the sub is individually
        // picked, or any of its items is in itemSet.
        const subsInScope = cat.subcategories.filter((s) =>
          wholeCat || subSet.has(s.id) || s.items.some((it) => itemSet.has(it.id)),
        );
        // Only skip when the cat itself isn't whole-picked. If wholeCat is
        // true, we still want to create the empty category skeleton at the
        // outlet — that's the explicit promise of category-level selection,
        // and silently dropping it is exactly what was making the toast say
        // "Imported 0 …" after a multi-menu pick.
        if (!wholeCat && subsInScope.length === 0) continue;

        // Look for an existing same-name category at the outlet so re-import
        // is additive instead of duplicating top-level groups. Must scope by
        // menuId — with multi-menu, the same name can legitimately exist in
        // different menus (e.g. "Specials" in Breakfast vs Lunch), and we
        // must not merge them. menuId can be null on legacy rows; Prisma
        // turns `menuId: null` into `IS NULL`, which is the behaviour we want.
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
              // Carry the source category's menu through the import so the
              // outlet copy lands in the same menu it had at the business level.
              menuId: cat.menuId ?? undefined,
            },
          });
          categoriesCount++;
          translationJobs.push({ entityType: 'Category', entityId: outletCat.id, fields: { name: outletCat.name } });
        }
        if (cat.menuId) touchedMenuIds.add(cat.menuId);

        for (const sub of subsInScope) {
          const wholeSub = wholeCat || subSet.has(sub.id);
          const itemsInScope = wholeSub
            ? sub.items
            : sub.items.filter((it) => itemSet.has(it.id));
          // A sub with no items in scope (and not whole-selected) means the
          // caller asked for an empty wrapper — usually because it's the sub
          // of a wholly-selected category that is itself empty. Allow it.
          if (!wholeSub && itemsInScope.length === 0) continue;

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

          for (const item of itemsInScope) {
            const existingItem = await tx.item.findFirst({
              where: { subcategoryId: outletSub.id, name: item.name },
            });
            if (existingItem) continue; // skip dupes — outlet may have customised this
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

      // Auto-enable an OutletMenu link for each menu we just imported into.
      // Importing is an explicit "I want this menu visible at my outlet"
      // signal, so we force isEnabled=true even when a previous link existed
      // in a disabled state (otherwise the outlet would import items into a
      // menu customers still couldn't see).
      for (const menuId of touchedMenuIds) {
        await tx.outletMenu.upsert({
          where: { outletId_menuId: { outletId: targetOutletId, menuId } },
          update: { isEnabled: true },
          create: { outletId: targetOutletId, menuId, isEnabled: true },
        });
      }
    });

    // Fire-and-forget the translation jobs. External providers (Lingva /
    // Bhashini) can take many seconds per field × language; we don't want the
    // import HTTP request to block on that. Items render in English until
    // each translation lands; subsequent GETs will hydrate them.
    void (async () => {
      for (const job of translationJobs) {
        try {
          await this.translations.upsertAll(job.entityType, job.entityId, job.fields);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[importFromBusiness] translate ${job.entityType}/${job.entityId} failed`, err);
        }
      }
    })();

    return { categories: categoriesCount, subcategories: subcategoriesCount, items: itemsCount };
  }
}
