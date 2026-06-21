import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
import { MenuService } from '../menu/menu.service';

@Injectable()
export class CustomerTagsService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
    // Used to bump the outlet's menu-tree version after price-override
    // writes — without this, the admin's re-fetch hits the cached tree
    // and sees the old override.
    private menu: MenuService,
  ) {}

  async list(outletId: string, lang?: string | null) {
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

  async create(outletId: string, data: { name: string; color?: string }) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Tag name is required');
    const exists = await this.prisma.customerTag.findUnique({
      where: { outletId_name: { outletId, name } },
    });
    if (exists) throw new BadRequestException('A tag with that name already exists');
    const tag = await this.prisma.customerTag.create({
      data: { outletId, name, color: data.color || '#f97316' },
    });
    await this.translations.upsertAll('CustomerTag', tag.id, { name: tag.name });
    return tag;
  }

  async update(id: string, data: { name?: string; color?: string }) {
    const tag = await this.prisma.customerTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    if (data.name) {
      const clash = await this.prisma.customerTag.findFirst({
        where: { outletId: tag.outletId, name: data.name.trim(), NOT: { id } },
      });
      if (clash) throw new BadRequestException('A tag with that name already exists');
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

  async remove(id: string) {
    return this.prisma.customerTag.delete({ where: { id } });
  }

  async setItemPrice(tagId: string, itemId: string, price: number, variantId?: string, gstRate?: number | null) {
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a non-negative number');
    }
    if (gstRate != null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) {
      throw new BadRequestException('GST rate must be between 0 and 100');
    }
    const tag = await this.prisma.customerTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: { subcategory: { include: { category: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.subcategory.category.outletId !== tag.outletId) {
      throw new BadRequestException('Item and tag must belong to the same outlet');
    }
    if (variantId) {
      const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
      if (!variant || variant.itemId !== itemId) {
        throw new BadRequestException('Variant does not belong to this item');
      }
    }

    // Manual upsert because nullable variantId can't be part of a Prisma unique input directly
    const existing = await this.prisma.customerTagPrice.findFirst({
      where: { itemId, customerTagId: tagId, variantId: variantId ?? null },
    });
    let result;
    if (existing) {
      result = await this.prisma.customerTagPrice.update({
        where: { id: existing.id },
        data: { price, ...(gstRate !== undefined ? { gstRate } : {}) },
      });
    } else {
      result = await this.prisma.customerTagPrice.create({
        data: {
          itemId,
          customerTagId: tagId,
          variantId: variantId ?? null,
          price,
          gstRate: gstRate ?? null,
        },
      });
    }
    // Bust the outlet's menu-tree cache so the admin re-fetch (and the
    // customer menu) reflect the new override on the next read.
    await this.menu.invalidateOutlet(tag.outletId);
    return result;
  }

  async clearItemPrice(tagId: string, itemId: string, variantId?: string) {
    const tag = await this.prisma.customerTag.findUnique({ where: { id: tagId }, select: { outletId: true } });
    await this.prisma.customerTagPrice.deleteMany({
      where: { customerTagId: tagId, itemId, variantId: variantId ?? null },
    });
    if (tag) await this.menu.invalidateOutlet(tag.outletId);
    return { success: true };
  }
}
