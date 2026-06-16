import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

// The freebie "get" pool scope. When null the legacy single-item path
// (uses getItemId) is in effect.
type GetScope = 'ITEM' | 'ALL' | 'CATEGORY' | 'ITEMS';

type OfferWriteDto = {
  name: string;
  description?: string | null;
  outletId?: string | null;
  triggerType: 'MIN_BILL' | 'BUY_X_GET_Y';
  minBillAmount?: number | null;
  buyItemId?: string | null;
  buyVariantId?: string | null;
  buyQuantity?: number | null;
  // Legacy single-item freebie (back-compat). When getScope is set to
  // anything other than 'ITEM' (or 'ITEM' explicitly), the new fields
  // below override.
  getItemId?: string | null;
  getVariantId?: string | null;
  getQuantity?: number | null;
  getScope?: GetScope | null;
  getCategoryId?: string | null;
  getItemIds?: string[] | null;
  validFrom?: string | Date | null;
  validUntil?: string | Date | null;
  daysOfWeek?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
  isActive?: boolean;
};

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  // Visibility rules: business-view (no outletId) → business-wide
  // offers only (outletId IS NULL). Outlet-view (outletId set) →
  // business-wide PLUS that outlet's own offers. Other outlets'
  // offers stay hidden.
  listForBusiness(businessId: string, outletId?: string) {
    const where: any = outletId === undefined
      ? { businessId, outletId: null }
      : { businessId, OR: [{ outletId: null }, { outletId }] };
    return this.prisma.offer.findMany({
      where,
      include: {
        buyItem: { select: { id: true, name: true } },
        getItem: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const o = await this.prisma.offer.findUnique({
      where: { id },
      include: { buyItem: true, getItem: true },
    });
    if (!o) throw new NotFoundException('Offer not found');
    return o;
  }

  async create(businessId: string, dto: OfferWriteDto) {
    await this.validate(businessId, dto);
    const scope = dto.getScope ?? (dto.getItemId ? 'ITEM' : null);
    return this.prisma.offer.create({
      data: {
        businessId,
        outletId: dto.outletId ?? null,
        name: dto.name.trim(),
        description: dto.description ?? null,
        triggerType: dto.triggerType,
        minBillAmount: dto.triggerType === 'MIN_BILL' ? dto.minBillAmount ?? 0 : null,
        buyItemId: dto.triggerType === 'BUY_X_GET_Y' ? dto.buyItemId ?? null : null,
        buyVariantId: dto.triggerType === 'BUY_X_GET_Y' ? dto.buyVariantId ?? null : null,
        buyQuantity: dto.triggerType === 'BUY_X_GET_Y' ? dto.buyQuantity ?? 1 : null,
        // Legacy single-item still persists; the pool fields below
        // describe broader scopes and take precedence on read paths.
        getItemId: scope === 'ITEM' ? (dto.getItemId ?? null) : null,
        getVariantId: scope === 'ITEM' ? (dto.getVariantId ?? null) : null,
        getQuantity: dto.getQuantity ?? 1,
        getScope: scope === 'ITEM' ? null : (scope ?? null),
        getCategoryId: scope === 'CATEGORY' ? (dto.getCategoryId ?? null) : null,
        getItemIds: scope === 'ITEMS' ? (dto.getItemIds as any) : null as any,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        daysOfWeek: dto.daysOfWeek ?? null,
        startMinute: dto.startMinute ?? null,
        endMinute: dto.endMinute ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<OfferWriteDto>) {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Offer not found');
    // If the scope is changing, re-validate the new shape against the
    // existing business. Falls through silently when the caller is
    // only flipping isActive or editing a label.
    if (
      dto.getScope !== undefined
      || dto.getCategoryId !== undefined
      || dto.getItemIds !== undefined
      || dto.getItemId !== undefined
      || dto.triggerType !== undefined
    ) {
      await this.validate(existing.businessId, { ...existing as any, ...dto });
    }
    // When the scope flips, clear the columns that no longer apply
    // so a single offer never carries stale ITEM + CATEGORY + ITEMS
    // data simultaneously.
    const incomingScope: GetScope | null | undefined = dto.getScope;
    const scopePatch: Record<string, any> = {};
    if (incomingScope !== undefined) {
      const s = incomingScope ?? (dto.getItemId !== undefined ? 'ITEM' : null);
      scopePatch.getScope = s === 'ITEM' ? null : s;
      if (s === 'ITEM') {
        scopePatch.getCategoryId = null;
        scopePatch.getItemIds = null;
      } else if (s === 'ALL') {
        scopePatch.getItemId = null;
        scopePatch.getVariantId = null;
        scopePatch.getCategoryId = null;
        scopePatch.getItemIds = null;
      } else if (s === 'CATEGORY') {
        scopePatch.getItemId = null;
        scopePatch.getVariantId = null;
        scopePatch.getItemIds = null;
      } else if (s === 'ITEMS') {
        scopePatch.getItemId = null;
        scopePatch.getVariantId = null;
        scopePatch.getCategoryId = null;
      }
    }
    return this.prisma.offer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.outletId !== undefined ? { outletId: dto.outletId } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.minBillAmount !== undefined ? { minBillAmount: dto.minBillAmount } : {}),
        ...(dto.buyItemId !== undefined ? { buyItemId: dto.buyItemId } : {}),
        ...(dto.buyVariantId !== undefined ? { buyVariantId: dto.buyVariantId } : {}),
        ...(dto.buyQuantity !== undefined ? { buyQuantity: dto.buyQuantity } : {}),
        ...(dto.getItemId !== undefined ? { getItemId: dto.getItemId } : {}),
        ...(dto.getVariantId !== undefined ? { getVariantId: dto.getVariantId } : {}),
        ...(dto.getQuantity !== undefined ? { getQuantity: dto.getQuantity } : {}),
        ...(dto.getCategoryId !== undefined ? { getCategoryId: dto.getCategoryId } : {}),
        ...(dto.getItemIds !== undefined ? { getItemIds: dto.getItemIds as any } : {}),
        ...scopePatch,
        ...(dto.validFrom !== undefined ? { validFrom: dto.validFrom ? new Date(dto.validFrom) : null } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null } : {}),
        ...(dto.daysOfWeek !== undefined ? { daysOfWeek: dto.daysOfWeek } : {}),
        ...(dto.startMinute !== undefined ? { startMinute: dto.startMinute } : {}),
        ...(dto.endMinute !== undefined ? { endMinute: dto.endMinute } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.offer.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Offer not found');
    return this.prisma.offer.delete({ where: { id } });
  }

  // Active offers right now at an outlet — used by the cart engine to detect
  // freebie triggers.
  async activeForOutlet(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const now = new Date();
    const isoDow = ((now.getDay() + 6) % 7) + 1;
    const minute = now.getHours() * 60 + now.getMinutes();

    const candidates = await this.prisma.offer.findMany({
      where: {
        businessId: outlet.businessId,
        isActive: true,
        OR: [{ outletId: null }, { outletId }],
      },
      include: {
        buyItem: { select: { id: true, name: true } },
        getItem: { select: { id: true, name: true, basePrice: true } },
        getCategory: { select: { id: true, name: true } },
      },
    });
    return candidates.filter((o) => this.isActiveNow(o, now, isoDow, minute));
  }

  private isActiveNow(o: any, now: Date, isoDow: number, minute: number) {
    if (o.validFrom && o.validFrom > now) return false;
    if (o.validUntil && o.validUntil < now) return false;
    if (o.daysOfWeek) {
      const days = String(o.daysOfWeek).split(',').map((x: string) => parseInt(x.trim(), 10));
      if (days.length && !days.includes(isoDow)) return false;
    }
    if (o.startMinute !== null && o.endMinute !== null) {
      if (minute < o.startMinute || minute > o.endMinute) return false;
    }
    return true;
  }

  private async validate(businessId: string, dto: OfferWriteDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Offer name is required');
    if (!['MIN_BILL', 'BUY_X_GET_Y'].includes(dto.triggerType)) {
      throw new BadRequestException('triggerType must be MIN_BILL or BUY_X_GET_Y');
    }
    if (dto.triggerType === 'MIN_BILL') {
      if (!(dto.minBillAmount && dto.minBillAmount > 0)) {
        throw new BadRequestException('minBillAmount required for MIN_BILL');
      }
    }
    if (dto.triggerType === 'BUY_X_GET_Y') {
      if (!dto.buyItemId) {
        throw new BadRequestException('buyItemId required for BUY_X_GET_Y');
      }
      if (!(dto.buyQuantity && dto.buyQuantity > 0)) {
        throw new BadRequestException('buyQuantity must be > 0');
      }
    }
    // Freebie pool — exactly one of ITEM / ALL / CATEGORY / ITEMS must
    // be coherent with what was sent. The customer picks `getQuantity`
    // items from this pool at checkout.
    const scope: GetScope = dto.getScope ?? (dto.getItemId ? 'ITEM' : null) as any;
    if (!scope) throw new BadRequestException('getScope (or legacy getItemId) is required');
    if (!(dto.getQuantity && dto.getQuantity > 0)) {
      throw new BadRequestException('getQuantity must be > 0');
    }
    if (scope === 'ITEM') {
      if (!dto.getItemId) throw new BadRequestException('getItemId required when getScope is ITEM');
    } else if (scope === 'ALL') {
      // No extra fields needed — every active item is eligible.
    } else if (scope === 'CATEGORY') {
      if (!dto.getCategoryId) throw new BadRequestException('getCategoryId required when getScope is CATEGORY');
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.getCategoryId },
        select: { businessId: true, outletId: true },
      });
      if (!cat) throw new BadRequestException('getCategoryId does not exist');
      // The category must live under the same business (either as a
      // business-template category or under one of its outlets) so the
      // offer never points across tenants.
      const categoryBusinessId = cat.businessId ?? (cat.outletId
        ? (await this.prisma.outlet.findUnique({ where: { id: cat.outletId }, select: { businessId: true } }))?.businessId
        : null);
      if (categoryBusinessId !== businessId) {
        throw new BadRequestException('getCategoryId does not belong to this business');
      }
    } else if (scope === 'ITEMS') {
      const ids = dto.getItemIds ?? [];
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestException('getItemIds must be a non-empty array when getScope is ITEMS');
      }
      // Every id must belong to a business-template item OR to one of
      // the business's outlets' menus. Cheap join: pull item with its
      // subcategory→category→outlet/business and verify.
      const items = await this.prisma.item.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          subcategory: {
            select: {
              category: {
                select: { businessId: true, outletId: true },
              },
            },
          },
        },
      });
      if (items.length !== ids.length) {
        throw new BadRequestException('One or more getItemIds do not exist');
      }
      for (const it of items) {
        const cat = it.subcategory?.category;
        const itemBiz = cat?.businessId ?? (cat?.outletId
          ? (await this.prisma.outlet.findUnique({ where: { id: cat.outletId }, select: { businessId: true } }))?.businessId
          : null);
        if (itemBiz !== businessId) {
          throw new BadRequestException(`Item ${it.id} does not belong to this business`);
        }
      }
    } else {
      throw new BadRequestException(`Invalid getScope: ${scope}`);
    }
  }
}
