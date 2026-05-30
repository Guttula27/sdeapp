import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { allowsSeating } from '../../common/outlet-type';

@Injectable()
export class TableTypesService {
  constructor(private prisma: PrismaService) {}

  private async assertOutletAllowsSeating(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { outletType: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!allowsSeating(outlet.outletType)) {
      throw new BadRequestException(
        'This outlet is self-service; table types do not apply.',
      );
    }
  }

  async list(outletId: string) {
    const rows = await this.prisma.tableType.findMany({
      where: { outletId },
      orderBy: { createdAt: 'asc' },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { number: 'asc' },
          include: { qrCode: true },
        },
        // Pull only the disabled menu links so the UI knows which menus to
        // exclude from per-section price/GST overrides (no point pricing
        // items the section's customers will never see).
        menus: {
          where: { isEnabled: false },
          select: { menuId: true },
        },
        _count: { select: { tables: true, prices: true } },
      },
    });
    return rows.map((tt) => ({
      ...tt,
      disabledMenuIds: tt.menus.map((m) => m.menuId),
      menus: undefined,
    }));
  }

  // ─── Tables under a type ─────────────────────────────────
  async addTable(outletId: string, tableTypeId: string, data: { number: string; capacity?: number }) {
    await this.assertOutletAllowsSeating(outletId);
    const type = await this.prisma.tableType.findUnique({ where: { id: tableTypeId } });
    if (!type) throw new NotFoundException('Table type not found');
    if (type.outletId !== outletId) throw new BadRequestException('Table type does not belong to this outlet');
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

  async removeTable(tableId: string) {
    return this.prisma.table.update({ where: { id: tableId }, data: { isActive: false } });
  }

  async create(outletId: string, data: { name: string; color?: string }) {
    await this.assertOutletAllowsSeating(outletId);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Table type name is required');
    const exists = await this.prisma.tableType.findUnique({
      where: { outletId_name: { outletId, name } },
    });
    if (exists) throw new BadRequestException('A table type with that name already exists');
    return this.prisma.tableType.create({
      data: { outletId, name, color: data.color || '#0ea5e9' },
    });
  }

  async update(id: string, data: { name?: string; color?: string }) {
    const type = await this.prisma.tableType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException('Table type not found');
    if (data.name) {
      const clash = await this.prisma.tableType.findFirst({
        where: { outletId: type.outletId, name: data.name.trim(), NOT: { id } },
      });
      if (clash) throw new BadRequestException('A table type with that name already exists');
    }
    return this.prisma.tableType.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    });
  }

  remove(id: string) {
    return this.prisma.tableType.delete({ where: { id } });
  }

  // ─── Item × TableType pricing ────────────────────────────
  async setItemPrice(tableTypeId: string, itemId: string, price: number, variantId?: string, gstRate?: number | null) {
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a non-negative number');
    }
    if (gstRate != null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) {
      throw new BadRequestException('GST rate must be between 0 and 100');
    }
    const type = await this.prisma.tableType.findUnique({ where: { id: tableTypeId } });
    if (!type) throw new NotFoundException('Table type not found');
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: { subcategory: { include: { category: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.subcategory.category.outletId !== type.outletId) {
      throw new BadRequestException('Item and table type must belong to the same outlet');
    }
    if (variantId) {
      const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
      if (!variant || variant.itemId !== itemId) {
        throw new BadRequestException('Variant does not belong to this item');
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

  async clearItemPrice(tableTypeId: string, itemId: string, variantId?: string) {
    await this.prisma.tableTypePrice.deleteMany({
      where: { tableTypeId, itemId, variantId: variantId ?? null },
    });
    return { success: true };
  }

  // ─── Per-section menu availability ─────────────────────────
  // Returns every menu in the section's business with the join row's
  // isEnabled flag. Default menus include `isLocked: true` so the UI hides
  // their toggle (they're always available regardless of any row).
  async listMenus(tableTypeId: string) {
    const tt = await this.prisma.tableType.findUnique({
      where: { id: tableTypeId },
      include: { outlet: { select: { businessId: true } } },
    });
    if (!tt) throw new NotFoundException('Section not found');

    const [menus, links] = await Promise.all([
      this.prisma.menu.findMany({
        where: { businessId: tt.outlet.businessId },
        orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.tableTypeMenu.findMany({ where: { tableTypeId } }),
    ]);
    const byMenuId = new Map(links.map((l) => [l.menuId, l]));
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      isDefault: m.isDefault,
      isLocked: m.isDefault, // UI hint: hide toggle for default menu
      isEnabled: m.isDefault ? true : (byMenuId.get(m.id)?.isEnabled ?? true),
    }));
  }

  async toggleMenu(tableTypeId: string, menuId: string, isEnabled: boolean) {
    const [tt, menu] = await Promise.all([
      this.prisma.tableType.findUnique({
        where: { id: tableTypeId },
        include: { outlet: { select: { businessId: true } } },
      }),
      this.prisma.menu.findUnique({ where: { id: menuId } }),
    ]);
    if (!tt) throw new NotFoundException('Section not found');
    if (!menu) throw new NotFoundException('Menu not found');
    if (menu.businessId !== tt.outlet.businessId) {
      throw new BadRequestException('Menu does not belong to this section\'s business');
    }
    if (menu.isDefault && !isEnabled) {
      throw new BadRequestException('The default menu cannot be disabled');
    }
    return this.prisma.tableTypeMenu.upsert({
      where: { tableTypeId_menuId: { tableTypeId, menuId } },
      update: { isEnabled },
      create: { tableTypeId, menuId, isEnabled },
    });
  }
}
