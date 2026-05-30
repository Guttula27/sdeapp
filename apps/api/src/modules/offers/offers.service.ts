import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

type OfferWriteDto = {
  name: string;
  description?: string | null;
  outletId?: string | null;
  triggerType: 'MIN_BILL' | 'BUY_X_GET_Y';
  minBillAmount?: number | null;
  buyItemId?: string | null;
  buyVariantId?: string | null;
  buyQuantity?: number | null;
  getItemId?: string | null;
  getVariantId?: string | null;
  getQuantity?: number | null;
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

  listForBusiness(businessId: string, outletId?: string) {
    return this.prisma.offer.findMany({
      where: { businessId, ...(outletId === undefined ? {} : { outletId }) },
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

  create(businessId: string, dto: OfferWriteDto) {
    this.validate(dto);
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
        getItemId: dto.getItemId ?? null,
        getVariantId: dto.getVariantId ?? null,
        getQuantity: dto.getQuantity ?? 1,
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
        getItem: { select: { id: true, name: true } },
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

  private validate(dto: OfferWriteDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Offer name is required');
    if (!['MIN_BILL', 'BUY_X_GET_Y'].includes(dto.triggerType)) {
      throw new BadRequestException('triggerType must be MIN_BILL or BUY_X_GET_Y');
    }
    if (dto.triggerType === 'MIN_BILL') {
      if (!(dto.minBillAmount && dto.minBillAmount > 0)) {
        throw new BadRequestException('minBillAmount required for MIN_BILL');
      }
      if (!dto.getItemId) throw new BadRequestException('getItemId required for MIN_BILL freebie');
    }
    if (dto.triggerType === 'BUY_X_GET_Y') {
      if (!dto.buyItemId || !dto.getItemId) {
        throw new BadRequestException('buyItemId and getItemId required for BUY_X_GET_Y');
      }
      if (!(dto.buyQuantity && dto.buyQuantity > 0)) {
        throw new BadRequestException('buyQuantity must be > 0');
      }
    }
  }
}
