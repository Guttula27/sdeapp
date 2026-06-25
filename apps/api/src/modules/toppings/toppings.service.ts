import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
import { MenuService } from '../menu/menu.service';

type ToppingOptionDto = { name: string; priceAdd?: number };

@Injectable()
export class ToppingsService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
    // Used to bust the outlet's menu-tree cache after item-topping
    // writes (itemToppings live in the cached tree).
    private menu: MenuService,
  ) {}

  async list(outletId: string, lang?: string | null) {
    const toppings = await this.prisma.topping.findMany({
      where: { outletId },
      orderBy: { createdAt: 'asc' },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    await this.translations.hydrate('Topping', toppings, ['name'], lang);
    for (const t of toppings) {
      await this.translations.hydrate('ToppingOption', t.options as any[], ['name'], lang);
    }
    return toppings;
  }

  async create(outletId: string, data: {
    name: string;
    basePriceAdd?: number;
    options?: ToppingOptionDto[];
  }) {
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Topping name is required');
    const exists = await this.prisma.topping.findUnique({
      where: { outletId_name: { outletId, name } },
    });
    if (exists) throw new BadRequestException('A topping with that name already exists');

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

  async update(id: string, data: {
    name?: string;
    basePriceAdd?: number;
    options?: ToppingOptionDto[];
  }) {
    const topping = await this.prisma.topping.findUnique({ where: { id } });
    if (!topping) throw new NotFoundException('Topping not found');

    // Optional: replace options if a new list is provided
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

  remove(id: string) {
    return this.prisma.topping.delete({ where: { id } });
  }

  // ─── Item ↔ Topping links ────────────────────────────────
  async setItemToppings(itemId: string, links: { toppingId: string; priceAdd?: number; isRequired?: boolean }[]) {
    const result = await this.prisma.$transaction(async (tx) => {
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
    // Bust the menu-tree cache so the next read shows the updated links.
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: { subcategory: { select: { category: { select: { outletId: true } } } } },
    });
    const outletId = item?.subcategory?.category?.outletId;
    if (outletId) await this.menu.invalidateOutlet(outletId);
    return result;
  }
}
