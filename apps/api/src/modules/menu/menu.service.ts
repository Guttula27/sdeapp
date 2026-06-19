import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
import { DiscountsService } from '../discounts/discounts.service';
import {
  evaluateCascade,
  nowInOutletTz,
  TimingSlot,
} from '../../common/timing/timing-slots';

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

  /**
   * Top-level read used by the customer app and staff PlaceOrderPage.
   * Two-phase by design so the heavy DB+translation work can be cached
   * independently of per-request projection (viewer, table, time).
   *
   *   loadMenuTree(outletId, lang, includeHidden)   ← cacheable
   *   projectMenu(tree, viewerUserId, tableId)      ← per request
   */
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
    const tree = await this.loadMenuTree(outletId, lang, opts?.includeHidden);
    return this.projectMenu(tree, { outletId, viewerUserId, tableId, includeHidden: opts?.includeHidden });
  }

  /**
   * Heavy DB load: outlet meta + every active category in the outlet with
   * nested subs, items, variants, toppings, images, timing slots, and all
   * pricing-override rows so the projection can pick. Returns translated
   * names/descriptions per `lang`.
   *
   * Intentionally outlet-only — no tableId, viewer, time-of-day. This is
   * what step 2 will wrap in Redis keyed by (outletId, lang, public|all).
   */
  async loadMenuTree(
    outletId: string,
    lang?: string | null,
    includeHidden?: boolean,
  ) {
    const categories = await this.prisma.category.findMany({
      where: { outletId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        // Per-day availability windows. Absent rows = no constraint at
        // this level; cascade evaluation in projection combines
        // outlet → menu → category → subcategory → item to set
        // `inSchedule` per node.
        timingSlots: true,
        // Menu-level timing slots come along so projection can resolve
        // the outlet-override variant (OutletMenuTimingSlot) when present
        // and fall back to MenuTimingSlot otherwise.
        menu: {
          include: {
            timingSlots: true,
            outletLinks: {
              where: { outletId },
              include: { timingSlots: true },
            },
          },
        },
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            timingSlots: true,
            items: {
              ...(includeHidden ? {} : { where: { isDisplayed: true } }),
              orderBy: { displayOrder: 'asc' },
              include: {
                timingSlots: true,
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

    await this.hydrateMenu(categories, lang);
    return { categories };
  }

  /**
   * Per-request decoration layer. Inputs that change per request live
   * here and never enter the cached tree:
   *   • viewer's tag and favorites
   *   • table's table-type (pricing) and section (menu exclusions)
   *   • current time (schedule cascade)
   *   • active auto-discounts
   *   • rolling 30-day popular set + per-item rating aggregates
   *
   * Also applies the outlet's menu-visibility filter (OutletMenu enabled
   * links + section/table-type exclusions) — kept out of the cache so
   * menu toggles and table layout changes never invalidate.
   */
  private async projectMenu(
    tree: { categories: any[] },
    ctx: { outletId: string; viewerUserId?: string; tableId?: string; includeHidden?: boolean },
  ) {
    const { outletId, viewerUserId, tableId } = ctx;
    const skipSchedule = !!ctx.includeHidden;

    // ── Outlet-menu visibility resolution (out of cache so toggles
    // don't invalidate). Mirrors the original gating:
    //   • multipleMenusEnabled = false → only default menu (+ legacy
    //     unassigned categories with menuId = null)
    //   • multipleMenusEnabled = true  → enabled OutletMenu links,
    //     minus table-driven exclusions; default menu always counts.
    const outletMeta = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { multipleMenusEnabled: true, businessId: true },
    });
    let allowedMenuIds = new Set<string>();
    let allowNullMenu = false; // single-menu mode also shows unassigned categories
    let defaultMenuId: string | null = null;
    if (outletMeta) {
      const defaultMenu = await this.prisma.menu.findFirst({
        where: { businessId: outletMeta.businessId, isDefault: true },
        select: { id: true },
      });
      defaultMenuId = defaultMenu?.id ?? null;
      if (!outletMeta.multipleMenusEnabled) {
        if (defaultMenuId) allowedMenuIds.add(defaultMenuId);
        allowNullMenu = true;
      } else {
        const links = await this.prisma.outletMenu.findMany({
          where: { outletId, isEnabled: true },
          select: { menuId: true },
        });
        for (const l of links) allowedMenuIds.add(l.menuId);
        if (defaultMenuId) allowedMenuIds.add(defaultMenuId);
        // Table-type-level disables (legacy / "Patio table" style
        // grouping) AND section-level disables (physical area: "VIP
        // room", "Bar"). Both apply when a table QR is scanned.
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
                if (defaultMenuId && s.menuId === defaultMenuId) continue;
                allowedMenuIds.delete(s.menuId);
              }
            }
            if (table.sectionId) {
              const sectionDisables = await this.prisma.menuSectionExclusion.findMany({
                where: { sectionId: table.sectionId },
                select: { menuId: true },
              });
              for (const s of sectionDisables) {
                // Default menu is the floor — never disabled, even
                // if an admin accidentally adds an exclusion row for it.
                if (defaultMenuId && s.menuId === defaultMenuId) continue;
                allowedMenuIds.delete(s.menuId);
              }
            }
          }
        }
      }
    }

    const categories = tree.categories.filter((c: any) => {
      if (c.menuId == null) return allowNullMenu;
      return allowedMenuIds.has(c.menuId);
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

    // Aggregate review stats for every item on the (filtered) menu in one
    // query so the customer can see the consolidated rating chip without
    // an extra round-trip.
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

    // Cascading availability evaluation. Outlet hours and bot
    // category/sub/item per-day slots all cascade — a node is in
    // schedule only if its own slots pass AND every ancestor passes.
    // The menu-level effective slots prefer the outlet override
    // (OutletMenuTimingSlot) when set, falling back to MenuTimingSlot.
    // Staff (includeHidden) callers see everything regardless of the
    // current time so the admin can edit out-of-window items.
    const now = nowInOutletTz();
    const slotShape = (rows: any[]): TimingSlot[] => (rows ?? []).map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    }));

    return categories.map((cat: any) => {
      const menuSlots: TimingSlot[] = (() => {
        const link = cat.menu?.outletLinks?.[0];
        const overrideSlots = link?.overrideTimings ? slotShape(link.timingSlots) : null;
        if (overrideSlots && overrideSlots.length) return overrideSlots;
        return slotShape(cat.menu?.timingSlots);
      })();
      const menuChain = [
        { slots: menuSlots, label: cat.menu?.name || 'Menu' },
      ];
      const catSlots = slotShape(cat.timingSlots);
      const catChain = [...menuChain, { slots: catSlots, label: cat.name }];
      const catEval = skipSchedule ? { inSchedule: true } : evaluateCascade(catChain, now);
      // Strip the internal menu join — clients only need the
      // pre-existing menuId/menuName fields, not the slot rows.
      const { menu: _menuJoin, timingSlots: catSlotRows, ...catRest } = cat;
      void _menuJoin; void catSlotRows;
      return {
        ...catRest,
        timingSlots: catSlots,
        inSchedule: catEval.inSchedule,
        nextOpen: skipSchedule ? null : (catEval as any).blockedBy?.nextOpen ?? null,
        blockedBy: skipSchedule ? null : (catEval as any).blockedBy?.label ?? null,
        subcategories: cat.subcategories.map((sub: any) => {
          const subSlots = slotShape(sub.timingSlots);
          const subChain = [...catChain, { slots: subSlots, label: sub.name }];
          const subEval = skipSchedule ? { inSchedule: true } : evaluateCascade(subChain, now);
          const { timingSlots: subSlotRows, ...subRest } = sub;
          void subSlotRows;
          return {
            ...subRest,
            timingSlots: subSlots,
            inSchedule: subEval.inSchedule,
            nextOpen: skipSchedule ? null : (subEval as any).blockedBy?.nextOpen ?? null,
            blockedBy: skipSchedule ? null : (subEval as any).blockedBy?.label ?? null,
            items: sub.items.map((item: any) => {
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
              const itemSlots = slotShape(item.timingSlots);
              const itemChain = [...subChain, { slots: itemSlots, label: item.name }];
              const itemEval = skipSchedule ? { inSchedule: true } : evaluateCascade(itemChain, now);
              const { timingSlots: itemSlotRows, ...itemRest } = item;
              void itemSlotRows;
              return {
                ...itemRest,
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
                // Schedule flags. inSchedule=true means the item is
                // orderable right now. When false, nextOpen + blockedBy
                // tell the UI what to show as the "available from" hint
                // and which ancestor closed the window (so a customer
                // sees one badge, not three conflicting ones).
                timingSlots: itemSlots,
                inSchedule: itemEval.inSchedule,
                nextOpen: skipSchedule ? null : (itemEval as any).blockedBy?.nextOpen ?? null,
                blockedBy: skipSchedule ? null : (itemEval as any).blockedBy?.label ?? null,
              };
            }),
          };
        }),
      };
    });
  }

  // ─── Per-day availability slots: cat / sub / item ─────────
  // Same shape as MenuService.replaceTimings — the client sends the
  // full desired set and we replace in one transaction. Empty array
  // clears the slots (level inherits from its ancestors via cascade).
  private validateTimingSlots(slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>) {
    if (!Array.isArray(slots)) throw new BadRequestException('timings must be an array');
    for (const s of slots) {
      if (!Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 1 || s.dayOfWeek > 7) {
        throw new BadRequestException('dayOfWeek must be 1..7');
      }
      if (!Number.isInteger(s.startMinute) || !Number.isInteger(s.endMinute)) {
        throw new BadRequestException('start/end minute must be integers');
      }
      if (s.startMinute < 0 || s.startMinute >= 1440 || s.endMinute < 0 || s.endMinute > 1440) {
        throw new BadRequestException('start/end minute must be within 0..1440');
      }
      if (s.endMinute <= s.startMinute) {
        throw new BadRequestException('endMinute must be greater than startMinute');
      }
    }
  }

  async replaceCategoryTimings(categoryId: string, slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>) {
    this.validateTimingSlots(slots);
    const cat = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.$transaction([
      this.prisma.categoryTimingSlot.deleteMany({ where: { categoryId } }),
      this.prisma.categoryTimingSlot.createMany({
        data: slots.map((s) => ({ categoryId, ...s })),
      }),
    ]);
    return this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { timingSlots: true },
    });
  }

  async replaceSubcategoryTimings(subcategoryId: string, slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>) {
    this.validateTimingSlots(slots);
    const sub = await this.prisma.subcategory.findUnique({ where: { id: subcategoryId } });
    if (!sub) throw new NotFoundException('Subcategory not found');
    await this.prisma.$transaction([
      this.prisma.subcategoryTimingSlot.deleteMany({ where: { subcategoryId } }),
      this.prisma.subcategoryTimingSlot.createMany({
        data: slots.map((s) => ({ subcategoryId, ...s })),
      }),
    ]);
    return this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: { timingSlots: true },
    });
  }

  async replaceItemTimings(itemId: string, slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>) {
    this.validateTimingSlots(slots);
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');
    await this.prisma.$transaction([
      this.prisma.itemTimingSlot.deleteMany({ where: { itemId } }),
      this.prisma.itemTimingSlot.createMany({
        data: slots.map((s) => ({ itemId, ...s })),
      }),
    ]);
    return this.prisma.item.findUnique({
      where: { id: itemId },
      include: { timingSlots: true },
    });
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

  // Sub deletion mirrors deleteCategory: hard-delete when no orders ever
  // referenced an item beneath the sub; otherwise soft-deactivate the sub
  // and its items so historical orders still resolve cleanly. Used for both
  // outlet rows and business templates — the template path skips the order
  // count entirely (template items can never be ordered).
  async deleteSubcategory(id: string) {
    const orderItemCount = await this.prisma.orderItem.count({
      where: { item: { subcategoryId: id } },
    });
    if (orderItemCount > 0) {
      return this.prisma.subcategory.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.item.findMany({ where: { subcategoryId: id }, select: { id: true } });
      const itemIds = items.map((i) => i.id);
      if (itemIds.length) {
        await tx.itemTag.deleteMany({ where: { itemId: { in: itemIds } } });
        await tx.option.deleteMany({ where: { itemId: { in: itemIds } } });
        await tx.variant.deleteMany({ where: { itemId: { in: itemIds } } });
        await tx.translation.deleteMany({ where: { entityType: 'Item', entityId: { in: itemIds } } });
        await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      }
      await tx.translation.deleteMany({ where: { entityType: 'Subcategory', entityId: id } });
      return tx.subcategory.delete({ where: { id } });
    });
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
