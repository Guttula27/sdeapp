import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

// Per-day-of-week multiple slots. dayOfWeek is ISO (1=Mon..7=Sun); times are
// minutes-since-midnight (0..1440). The validator below catches malformed
// payloads before they hit Prisma.
export interface TimingSlotInput {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

function validateSlots(slots: TimingSlotInput[]) {
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

@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  // ─── Business-level menus ──────────────────────────────────
  async listForBusiness(businessId: string) {
    return this.prisma.menu.findMany({
      where: { businessId },
      include: { timingSlots: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createForBusiness(businessId: string, body: { name: string; description?: string; isActive?: boolean }) {
    if (!body?.name?.trim()) throw new BadRequestException('Menu name is required');
    const max = await this.prisma.menu.aggregate({
      where: { businessId },
      _max: { displayOrder: true },
    });
    return this.prisma.menu.create({
      data: {
        businessId,
        name: body.name.trim(),
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        displayOrder: (max._max.displayOrder ?? -1) + 1,
      },
      include: { timingSlots: true },
    });
  }

  // Outlet-admin entrypoint: create a Menu on the outlet's parent business
  // and immediately link it as enabled at this outlet (so the new tab is
  // usable right away without a separate import step). Other outlets of the
  // same business won't see it until they enable it themselves.
  async createForOutlet(outletId: string, body: { name: string; description?: string; isActive?: boolean }) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    const menu = await this.createForBusiness(outlet.businessId, body);
    await this.prisma.outletMenu.upsert({
      where: { outletId_menuId: { outletId, menuId: menu.id } },
      update: { isEnabled: true },
      create: { outletId, menuId: menu.id, isEnabled: true },
    });
    return menu;
  }

  async update(id: string, body: { name?: string; description?: string | null; isActive?: boolean; displayOrder?: number }) {
    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Menu not found');
    return this.prisma.menu.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
      },
      include: { timingSlots: true },
    });
  }

  async remove(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: { _count: { select: { categories: true } } },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    if (menu.isDefault) {
      throw new ConflictException('The default menu cannot be deleted');
    }
    if (menu._count.categories > 0) {
      throw new ConflictException('Menu still has categories — move or delete them first');
    }
    return this.prisma.menu.delete({ where: { id } });
  }

  async replaceTimings(menuId: string, slots: TimingSlotInput[]) {
    validateSlots(slots);
    const menu = await this.prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new NotFoundException('Menu not found');
    await this.prisma.$transaction([
      this.prisma.menuTimingSlot.deleteMany({ where: { menuId } }),
      this.prisma.menuTimingSlot.createMany({
        data: slots.map((s) => ({ menuId, ...s })),
      }),
    ]);
    return this.prisma.menu.findUnique({
      where: { id: menuId },
      include: { timingSlots: true },
    });
  }

  // ─── Outlet-level menu links ───────────────────────────────
  // Returns one row per business menu, joined with the outlet's enable +
  // timing override (creating a default OutletMenu row lazily for menus the
  // outlet hasn't seen yet — keeps the UI simple).
  // When tableId is supplied (customer scanned a table QR), we ALSO factor in
  // the table's dine-in section: any menu disabled for that section flips
  // isEnabled=false even if the outlet has it enabled. Default menus stay
  // enabled regardless (the toggleMenu endpoint refuses to disable them).
  async listForOutlet(outletId: string, tableId?: string) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new NotFoundException('Outlet not found');

    // When the outlet has switched off multi-menu, customers and staff see
    // only the default menu — collapse the list here so callers don't have
    // to know about the flag.
    if (!(outlet as any).multipleMenusEnabled) {
      const defaultMenu = await this.prisma.menu.findFirst({
        where: { businessId: outlet.businessId, isDefault: true },
        include: { timingSlots: true },
      });
      if (!defaultMenu) return [];
      const link = await this.prisma.outletMenu.findUnique({
        where: { outletId_menuId: { outletId, menuId: defaultMenu.id } },
        include: { timingSlots: true },
      });
      return [{
        ...defaultMenu,
        outletMenu: {
          id: link?.id ?? null,
          isEnabled: true,
          overrideTimings: link?.overrideTimings ?? false,
          timingSlots: link?.timingSlots ?? [],
        },
      }];
    }

    // Resolve the table's section so we can apply section-level overrides.
    let sectionDisabledMenuIds: Set<string> = new Set();
    if (tableId) {
      const table = await this.prisma.table.findUnique({
        where: { id: tableId },
        select: { tableTypeId: true, outletId: true },
      });
      if (table && table.outletId === outletId && table.tableTypeId) {
        const sectionLinks = await this.prisma.tableTypeMenu.findMany({
          where: { tableTypeId: table.tableTypeId, isEnabled: false },
          select: { menuId: true },
        });
        sectionDisabledMenuIds = new Set(sectionLinks.map((l) => l.menuId));
      }
    }

    const [menus, links] = await Promise.all([
      this.prisma.menu.findMany({
        where: { businessId: outlet.businessId },
        include: { timingSlots: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.outletMenu.findMany({
        where: { outletId },
        include: { timingSlots: true },
      }),
    ]);
    const byMenuId = new Map(links.map((l) => [l.menuId, l]));
    // Honour the outlet's own ordering when it has reordered locally; fall
    // back to the business template order otherwise. createdAt is the final
    // stable tiebreaker so two menus with identical displayOrder still come
    // back deterministically.
    const decorated = menus.map((m) => {
      const link = byMenuId.get(m.id);
      const outletEnabled = link ? link.isEnabled : false;
      const effectiveEnabled = outletEnabled && (m.isDefault || !sectionDisabledMenuIds.has(m.id));
      const sortKey = link ? link.displayOrder : m.displayOrder;
      return {
        menu: m,
        link,
        outletEnabled,
        effectiveEnabled,
        sortKey,
      };
    });
    decorated.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.menu.createdAt.getTime() - b.menu.createdAt.getTime();
    });
    return decorated.map(({ menu, link, effectiveEnabled }) => ({
      ...menu,
      outletMenu: link
        ? {
            id: link.id,
            isEnabled: effectiveEnabled,
            overrideTimings: link.overrideTimings,
            timingSlots: link.timingSlots,
          }
        : { id: null, isEnabled: effectiveEnabled, overrideTimings: false, timingSlots: [] },
    }));
  }

  async toggleOutletMenu(outletId: string, menuId: string, body: { isEnabled?: boolean; overrideTimings?: boolean }) {
    const menu = await this.prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new NotFoundException('Menu not found');
    // The default menu can never be disabled — it's the always-on fallback
    // when multi-menu is off. Symmetric with the section-level rule in
    // TableTypesService.toggleMenu.
    if (menu.isDefault && body.isEnabled === false) {
      throw new BadRequestException('The default menu cannot be disabled');
    }
    const link = await this.prisma.outletMenu.upsert({
      where: { outletId_menuId: { outletId, menuId } },
      update: {
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
        ...(body.overrideTimings !== undefined ? { overrideTimings: body.overrideTimings } : {}),
      },
      create: {
        outletId,
        menuId,
        isEnabled: body.isEnabled ?? true,
        overrideTimings: body.overrideTimings ?? false,
      },
      include: { timingSlots: true },
    });
    return link;
  }

  async replaceOutletTimings(outletId: string, menuId: string, slots: TimingSlotInput[]) {
    validateSlots(slots);
    // Ensure link row exists before writing slots.
    const link = await this.prisma.outletMenu.upsert({
      where: { outletId_menuId: { outletId, menuId } },
      update: {},
      create: { outletId, menuId, isEnabled: true, overrideTimings: true },
    });
    await this.prisma.$transaction([
      this.prisma.outletMenuTimingSlot.deleteMany({ where: { outletMenuId: link.id } }),
      this.prisma.outletMenuTimingSlot.createMany({
        data: slots.map((s) => ({ outletMenuId: link.id, ...s })),
      }),
    ]);
    return this.prisma.outletMenu.findUnique({
      where: { id: link.id },
      include: { timingSlots: true },
    });
  }

  // Import: copy each Category (+ Subcategories + Items + Variants) belonging
  // to the source business menu into the outlet, attached to the same menu.
  // Toppings/tag-prices live at the outlet level and are NOT copied — owner
  // configures them post-import.
  async importMenuToOutlet(outletId: string, menuId: string) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    const menu = await this.prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu || menu.businessId !== outlet.businessId) {
      throw new BadRequestException('Menu does not belong to this outlet\'s business');
    }

    const businessCategories = await this.prisma.category.findMany({
      where: { businessId: outlet.businessId, menuId },
      include: {
        subcategories: {
          include: {
            items: { include: { variants: true } },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    let categoriesCreated = 0;
    let itemsCreated = 0;

    for (const cat of businessCategories) {
      const newCat = await this.prisma.category.create({
        data: {
          name: cat.name,
          imageUrl: cat.imageUrl,
          displayOrder: cat.displayOrder,
          isActive: cat.isActive,
          outletId,
          menuId,
        },
      });
      categoriesCreated++;
      for (const sub of cat.subcategories) {
        const newSub = await this.prisma.subcategory.create({
          data: {
            name: sub.name,
            imageUrl: sub.imageUrl,
            displayOrder: sub.displayOrder,
            isActive: sub.isActive,
            categoryId: newCat.id,
          },
        });
        for (const item of sub.items) {
          await this.prisma.item.create({
            data: {
              name: item.name,
              description: item.description,
              shortDescription: item.shortDescription,
              longDescription: item.longDescription,
              thumbnailUrl: item.thumbnailUrl,
              imageUrl: item.imageUrl,
              basePrice: item.basePrice,
              gstRate: item.gstRate,
              parcelAvailable: item.parcelAvailable,
              useCustomParcelCharge: item.useCustomParcelCharge,
              parcelCharge: item.parcelCharge,
              preparationTime: item.preparationTime,
              foodGrade: item.foodGrade,
              isAvailable: item.isAvailable,
              isDisplayed: item.isDisplayed,
              isPopular: item.isPopular,
              isSpecial: item.isSpecial,
              printSeparately: (item as any).printSeparately ?? false,
              displayOrder: item.displayOrder,
              subcategoryId: newSub.id,
              variants: item.variants?.length
                ? {
                    create: item.variants.map((v) => ({
                      name: v.name,
                      shortDescription: v.shortDescription,
                      price: v.price,
                      isAvailable: v.isAvailable,
                    })),
                  }
                : undefined,
            },
          });
          itemsCreated++;
        }
      }
    }

    // Ensure the OutletMenu link exists and is enabled after a successful import.
    await this.prisma.outletMenu.upsert({
      where: { outletId_menuId: { outletId, menuId } },
      update: { isEnabled: true },
      create: { outletId, menuId, isEnabled: true },
    });

    return { categoriesCreated, itemsCreated };
  }

  // ─── Reorder ───────────────────────────────────────────────
  // Two independent ordering surfaces:
  //   • Menu.displayOrder       — business tier
  //   • OutletMenu.displayOrder — outlet tier (overrides the business order
  //     for that outlet only)
  // listForOutlet honours OutletMenu.displayOrder when present and falls back
  // to Menu.displayOrder otherwise, so an outlet that hasn't reordered stays
  // in sync with the business template.

  async reorderBusinessMenus(businessId: string, orderedIds: string[]) {
    if (!orderedIds?.length) return { reordered: 0 };
    const owned = await this.prisma.menu.findMany({
      where: { id: { in: orderedIds }, businessId },
      select: { id: true },
    });
    if (owned.length !== orderedIds.length) {
      throw new BadRequestException('One or more menus do not belong to this business');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.menu.update({ where: { id }, data: { displayOrder: idx } }),
      ),
    );
    return { reordered: orderedIds.length };
  }

  async reorderOutletMenus(outletId: string, orderedIds: string[]) {
    if (!orderedIds?.length) return { reordered: 0 };
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    const owned = await this.prisma.menu.findMany({
      where: { id: { in: orderedIds }, businessId: outlet.businessId },
      select: { id: true },
    });
    if (owned.length !== orderedIds.length) {
      throw new BadRequestException('One or more menus do not belong to this outlet');
    }
    // Upsert so menus the outlet hasn't actively enabled still pick up the
    // new order. Existing isEnabled state is preserved on update.
    await this.prisma.$transaction(
      orderedIds.map((menuId, idx) =>
        this.prisma.outletMenu.upsert({
          where: { outletId_menuId: { outletId, menuId } },
          update: { displayOrder: idx },
          create: { outletId, menuId, displayOrder: idx, isEnabled: true },
        }),
      ),
    );
    return { reordered: orderedIds.length };
  }
}
