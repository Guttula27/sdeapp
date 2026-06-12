import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

type DiscountTarget = 'CATEGORY' | 'SUBCATEGORY' | 'ITEM' | 'BILL';

type DiscountWriteDto = {
  name: string;
  outletId?: string | null;
  targetType: DiscountTarget;
  categoryId?: string | null;
  subcategoryId?: string | null;
  itemId?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minBillAmount?: number | null;
  maxDiscountAmount?: number | null;
  validFrom?: string | Date | null;
  validUntil?: string | Date | null;
  daysOfWeek?: string | null;  // CSV "1,2,3"
  startMinute?: number | null;
  endMinute?: number | null;
  isManualOnly?: boolean;
  isActive?: boolean;
};

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  // Visibility rules: business-view (no outletId) returns business-wide
  // only; outlet-view (outletId set) returns business-wide PLUS that
  // outlet's own discounts. Other outlets' discounts are hidden.
  listForBusiness(businessId: string, outletId?: string) {
    const where: any = outletId === undefined
      ? { businessId, outletId: null }
      : { businessId, OR: [{ outletId: null }, { outletId }] };
    return this.prisma.discount.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const d = await this.prisma.discount.findUnique({
      where: { id },
      include: { category: true, subcategory: true, item: true },
    });
    if (!d) throw new NotFoundException('Discount not found');
    return d;
  }

  create(businessId: string, dto: DiscountWriteDto) {
    this.validate(dto);
    return this.prisma.discount.create({
      data: {
        businessId,
        outletId: dto.outletId ?? null,
        name: dto.name.trim(),
        targetType: dto.targetType,
        categoryId: dto.targetType === 'CATEGORY' ? dto.categoryId ?? null : null,
        subcategoryId: dto.targetType === 'SUBCATEGORY' ? dto.subcategoryId ?? null : null,
        itemId: dto.targetType === 'ITEM' ? dto.itemId ?? null : null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minBillAmount: dto.minBillAmount ?? null,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        daysOfWeek: dto.daysOfWeek ?? null,
        startMinute: dto.startMinute ?? null,
        endMinute: dto.endMinute ?? null,
        isManualOnly: dto.isManualOnly ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<DiscountWriteDto>) {
    const existing = await this.prisma.discount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Discount not found');
    if (dto.targetType) this.validate({ ...existing, ...dto } as any);
    return this.prisma.discount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.outletId !== undefined ? { outletId: dto.outletId } : {}),
        ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
        ...(dto.targetType === 'CATEGORY' || (existing.targetType === 'CATEGORY' && dto.categoryId !== undefined)
          ? { categoryId: dto.categoryId ?? null }
          : {}),
        ...(dto.targetType === 'SUBCATEGORY' || (existing.targetType === 'SUBCATEGORY' && dto.subcategoryId !== undefined)
          ? { subcategoryId: dto.subcategoryId ?? null }
          : {}),
        ...(dto.targetType === 'ITEM' || (existing.targetType === 'ITEM' && dto.itemId !== undefined)
          ? { itemId: dto.itemId ?? null }
          : {}),
        ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue } : {}),
        ...(dto.minBillAmount !== undefined ? { minBillAmount: dto.minBillAmount } : {}),
        ...(dto.maxDiscountAmount !== undefined ? { maxDiscountAmount: dto.maxDiscountAmount } : {}),
        ...(dto.validFrom !== undefined ? { validFrom: dto.validFrom ? new Date(dto.validFrom) : null } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null } : {}),
        ...(dto.daysOfWeek !== undefined ? { daysOfWeek: dto.daysOfWeek } : {}),
        ...(dto.startMinute !== undefined ? { startMinute: dto.startMinute } : {}),
        ...(dto.endMinute !== undefined ? { endMinute: dto.endMinute } : {}),
        ...(dto.isManualOnly !== undefined ? { isManualOnly: dto.isManualOnly } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.discount.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Discount not found');
    return this.prisma.discount.delete({ where: { id } });
  }

  // List active auto-applying discounts for an outlet at the current moment.
  // Used by the customer-side pricing engine.
  async activeAutoForOutlet(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const now = new Date();
    const isoDow = ((now.getDay() + 6) % 7) + 1; // ISO 1=Mon..7=Sun
    const minute = now.getHours() * 60 + now.getMinutes();

    const candidates = await this.prisma.discount.findMany({
      where: {
        businessId: outlet.businessId,
        isActive: true,
        isManualOnly: false,
        OR: [{ outletId: null }, { outletId }],
      },
    });
    return candidates.filter((d) => this.isActiveNow(d, now, isoDow, minute));
  }

  // List manual (counter) discounts available to a cashier.
  manualForOutlet(outletId: string) {
    return this.prisma.outlet
      .findUnique({ where: { id: outletId }, select: { businessId: true } })
      .then((o) =>
        o
          ? this.prisma.discount.findMany({
              where: {
                businessId: o.businessId,
                isActive: true,
                isManualOnly: true,
                OR: [{ outletId: null }, { outletId }],
              },
            })
          : [],
      );
  }

  private isActiveNow(d: any, now: Date, isoDow: number, minute: number) {
    if (d.validFrom && d.validFrom > now) return false;
    if (d.validUntil && d.validUntil < now) return false;
    if (d.daysOfWeek) {
      const days = String(d.daysOfWeek).split(',').map((x: string) => parseInt(x.trim(), 10));
      if (days.length && !days.includes(isoDow)) return false;
    }
    if (d.startMinute !== null && d.endMinute !== null) {
      if (minute < d.startMinute || minute > d.endMinute) return false;
    }
    return true;
  }

  private validate(dto: DiscountWriteDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Discount name is required');
    if (!['CATEGORY', 'SUBCATEGORY', 'ITEM', 'BILL'].includes(dto.targetType)) {
      throw new BadRequestException('Invalid targetType');
    }
    if (dto.targetType === 'CATEGORY' && !dto.categoryId) {
      throw new BadRequestException('categoryId required for CATEGORY discount');
    }
    if (dto.targetType === 'SUBCATEGORY' && !dto.subcategoryId) {
      throw new BadRequestException('subcategoryId required for SUBCATEGORY discount');
    }
    if (dto.targetType === 'ITEM' && !dto.itemId) {
      throw new BadRequestException('itemId required for ITEM discount');
    }
    if (!['PERCENT', 'FIXED'].includes(dto.discountType)) {
      throw new BadRequestException('discountType must be PERCENT or FIXED');
    }
    if (!(dto.discountValue > 0)) throw new BadRequestException('discountValue must be > 0');
    if (dto.discountType === 'PERCENT' && dto.discountValue > 100) {
      throw new BadRequestException('percent discount cannot exceed 100');
    }
  }
}
