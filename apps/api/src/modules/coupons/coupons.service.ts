import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

type CouponWriteDto = {
  code: string;
  name: string;
  description?: string;
  outletId?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minBillAmount?: number | null;
  maxDiscountAmount?: number | null;
  validFrom: string | Date;
  validUntil: string | Date;
  maxUsesPerCustomer?: number;
  maxTotalUses?: number | null;
  targetType?: 'ALL' | 'SPECIFIC';
  targetUserIds?: string[];
  isActive?: boolean;
};

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: list / CRUD scoped to a business ────────────────────
  async listForBusiness(businessId: string, outletId?: string) {
    return this.prisma.coupon.findMany({
      where: {
        businessId,
        ...(outletId === undefined ? {} : { outletId }),
      },
      include: {
        targetCustomers: { include: { user: { select: { id: true, name: true, phone: true } } } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        targetCustomers: { include: { user: { select: { id: true, name: true, phone: true } } } },
        _count: { select: { usages: true } },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(businessId: string, dto: CouponWriteDto) {
    this.validate(dto);
    const validFrom = new Date(dto.validFrom);
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= validFrom) throw new BadRequestException('validUntil must be after validFrom');

    const targetType = dto.targetType ?? 'ALL';
    const userIds = targetType === 'SPECIFIC' ? (dto.targetUserIds ?? []) : [];

    return this.prisma.coupon.create({
      data: {
        businessId,
        outletId: dto.outletId ?? null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description ?? null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minBillAmount: dto.minBillAmount ?? null,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        validFrom,
        validUntil,
        maxUsesPerCustomer: dto.maxUsesPerCustomer ?? 1,
        maxTotalUses: dto.maxTotalUses ?? null,
        targetType,
        isActive: dto.isActive ?? true,
        targetCustomers: userIds.length
          ? { create: userIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: { targetCustomers: true },
    });
  }

  async update(id: string, dto: Partial<CouponWriteDto>) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const targetType = dto.targetType ?? (existing.targetType as 'ALL' | 'SPECIFIC');
    const userIds = dto.targetUserIds;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.coupon.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.outletId !== undefined ? { outletId: dto.outletId } : {}),
          ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
          ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue } : {}),
          ...(dto.minBillAmount !== undefined ? { minBillAmount: dto.minBillAmount } : {}),
          ...(dto.maxDiscountAmount !== undefined ? { maxDiscountAmount: dto.maxDiscountAmount } : {}),
          ...(dto.validFrom !== undefined ? { validFrom: new Date(dto.validFrom) } : {}),
          ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
          ...(dto.maxUsesPerCustomer !== undefined ? { maxUsesPerCustomer: dto.maxUsesPerCustomer } : {}),
          ...(dto.maxTotalUses !== undefined ? { maxTotalUses: dto.maxTotalUses } : {}),
          ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      if (userIds !== undefined) {
        await tx.couponCustomer.deleteMany({ where: { couponId: id } });
        if (targetType === 'SPECIFIC' && userIds.length) {
          await tx.couponCustomer.createMany({
            data: userIds.map((userId) => ({ couponId: id, userId })),
            skipDuplicates: true,
          });
        }
      }
      return updated;
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.coupon.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.delete({ where: { id } });
  }

  // ─── Customer: list coupons available for a given outlet/user ────
  async availableFor(outletId: string, userId?: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        businessId: outlet.businessId,
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
        OR: [{ outletId: null }, { outletId }],
      },
      include: {
        targetCustomers: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const visible: any[] = [];
    for (const c of coupons) {
      if (c.targetType === 'SPECIFIC') {
        if (!userId) continue;
        if (!c.targetCustomers.some((t) => t.userId === userId)) continue;
      }
      if (c.maxTotalUses !== null && c.usesCount >= c.maxTotalUses) continue;
      if (userId) {
        const usedByUser = await this.prisma.couponUsage.count({
          where: { couponId: c.id, userId },
        });
        if (usedByUser >= c.maxUsesPerCustomer) continue;
      }
      const { targetCustomers, ...rest } = c;
      visible.push(rest);
    }
    return visible;
  }

  // Quote a coupon against a hypothetical bill — returns the discount it
  // would apply, or rejects with reason. Used by the customer-side checkout.
  async quote(couponId: string, userId: string, billSubtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Coupon not available');

    const now = new Date();
    if (coupon.validFrom > now || coupon.validUntil < now) {
      throw new BadRequestException('Coupon not within its validity window');
    }
    if (coupon.minBillAmount && billSubtotal < Number(coupon.minBillAmount)) {
      throw new BadRequestException(`Minimum bill ₹${coupon.minBillAmount} not met`);
    }
    if (coupon.maxTotalUses !== null && coupon.usesCount >= coupon.maxTotalUses) {
      throw new BadRequestException('Coupon fully redeemed');
    }
    const userUses = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUses >= coupon.maxUsesPerCustomer) {
      throw new BadRequestException('You have already used this coupon');
    }
    if (coupon.targetType === 'SPECIFIC') {
      const targeted = await this.prisma.couponCustomer.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId } },
      });
      if (!targeted) throw new BadRequestException('Coupon not available for this account');
    }

    let discount =
      coupon.discountType === 'PERCENT'
        ? (billSubtotal * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
    discount = Math.min(discount, billSubtotal);
    return { coupon, discountAmount: Number(discount.toFixed(2)) };
  }

  // Helper for admin UI: resolve phone numbers → user ids so the operator
  // can target a coupon by phone without first looking up customer ids.
  async lookupByPhones(phones: string[]) {
    const cleaned = phones.map((p) => p.trim()).filter(Boolean);
    if (!cleaned.length) return [];
    return this.prisma.user.findMany({
      where: { phone: { in: cleaned } },
      select: { id: true, name: true, phone: true },
    });
  }

  private validate(dto: CouponWriteDto) {
    if (!dto.code?.trim()) throw new BadRequestException('Coupon code is required');
    if (!dto.name?.trim()) throw new BadRequestException('Coupon name is required');
    if (dto.discountType !== 'PERCENT' && dto.discountType !== 'FIXED') {
      throw new BadRequestException('discountType must be PERCENT or FIXED');
    }
    if (dto.discountValue === undefined || dto.discountValue <= 0) {
      throw new BadRequestException('discountValue must be > 0');
    }
    if (dto.discountType === 'PERCENT' && dto.discountValue > 100) {
      throw new BadRequestException('percent discount cannot exceed 100');
    }
  }
}
