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

  list(outletId: string) {
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
}
