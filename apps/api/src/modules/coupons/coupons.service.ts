import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { UserLookupService } from '../../config/crypto/user-lookup.service';

// ─── DTOs ──────────────────────────────────────────────────────────

// Cart line shape the customer-side quote needs for ALLOWANCE coupons.
// itemId/subcategoryId/categoryId are all required because the coupon's
// scope rows match against any one of them (OR). unitPrice is the
// post-line-discount price the customer would pay per unit, which is
// what the coupon discounts against.
export interface QuoteCartLine {
  itemId: string;
  subcategoryId: string;
  categoryId: string;
  qty: number;
  unitPrice: number;
}

export type CouponKind = 'STANDARD' | 'ALLOWANCE';
export type ResetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type CouponTargetType = 'ALL' | 'SPECIFIC' | 'TAG';
export type CouponScopeKind = 'ITEM' | 'CATEGORY' | 'SUBCATEGORY';

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
  targetType?: CouponTargetType;
  targetUserIds?: string[];
  targetTagIds?: string[];
  isActive?: boolean;

  // ALLOWANCE fields (ignored for STANDARD).
  kind?: CouponKind;
  resetPeriod?: ResetPeriod | null;
  perPeriodQuota?: number | null;
  scope?: Array<{ kind: CouponScopeKind; refId: string }>;
};

type QuoteResult = {
  coupon: any;
  discountAmount: number;
  // ALLOWANCE-only — undefined for STANDARD.
  itemUnits?: number;
  perLine?: Array<{ itemId: string; units: number; discount: number }>;
};

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private userLookup: UserLookupService,
  ) {}

  // ─── Admin: list / CRUD scoped to a business ────────────────────
  // Visibility rules (matches discounts / offers):
  //   - outletId undefined → "business view" → only business-wide
  //     coupons (outletId IS NULL). Outlet-owned coupons are hidden so
  //     the business owner manages their pool without noise from each
  //     outlet's promos.
  //   - outletId provided    → "outlet view" → business-wide PLUS that
  //     outlet's own coupons (applied to orders placed at that outlet).
  //     Other outlets' coupons remain hidden.
  async listForBusiness(businessId: string, outletId?: string) {
    const where: any = outletId === undefined
      ? { businessId, outletId: null }
      : { businessId, OR: [{ outletId: null }, { outletId }] };
    return this.prisma.coupon.findMany({
      where,
      include: {
        targetCustomers: { include: { user: { select: { id: true, name: true, phone: true } } } },
        targetTags: { include: { customerTag: { select: { id: true, name: true, color: true } } } },
        scopes: true,
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
        targetTags: { include: { customerTag: { select: { id: true, name: true, color: true } } } },
        scopes: true,
        _count: { select: { usages: true } },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(businessId: string, dto: CouponWriteDto) {
    await this.validate(dto);
    const validFrom = new Date(dto.validFrom);
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= validFrom) throw new BadRequestException('validUntil must be after validFrom');

    const kind: CouponKind = dto.kind ?? 'STANDARD';
    const targetType: CouponTargetType = dto.targetType ?? 'ALL';
    const userIds = targetType === 'SPECIFIC' ? (dto.targetUserIds ?? []) : [];
    const tagIds = targetType === 'TAG' ? (dto.targetTagIds ?? []) : [];

    // ALLOWANCE: maxUsesPerCustomer / minBillAmount are meaningless
    // (per-period quota replaces the rate limit; bill-min doesn't make
    // sense on an item-local entitlement). Force them off so the admin
    // form can't accidentally seed unreachable state.
    const maxUsesPerCustomer = kind === 'ALLOWANCE' ? 0 : (dto.maxUsesPerCustomer ?? 1);
    const minBillAmount = kind === 'ALLOWANCE' ? null : (dto.minBillAmount ?? null);

    return this.prisma.coupon.create({
      data: {
        businessId,
        outletId: dto.outletId ?? null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description ?? null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minBillAmount,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        validFrom,
        validUntil,
        maxUsesPerCustomer,
        maxTotalUses: dto.maxTotalUses ?? null,
        targetType,
        isActive: dto.isActive ?? true,
        kind,
        resetPeriod: kind === 'ALLOWANCE' ? dto.resetPeriod! : null,
        perPeriodQuota: kind === 'ALLOWANCE' ? dto.perPeriodQuota! : null,
        targetCustomers: userIds.length
          ? { create: userIds.map((userId) => ({ userId })) }
          : undefined,
        targetTags: tagIds.length
          ? { create: tagIds.map((customerTagId) => ({ customerTagId })) }
          : undefined,
        scopes:
          kind === 'ALLOWANCE' && dto.scope?.length
            ? { create: dto.scope.map((s) => ({ kind: s.kind, refId: s.refId })) }
            : undefined,
      },
      include: { targetCustomers: true, targetTags: true, scopes: true },
    });
  }

  async update(id: string, dto: Partial<CouponWriteDto>) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    // Apply incoming overrides to a working copy so validate sees the
    // post-update shape, not the partial diff. Otherwise switching kind
    // STANDARD → ALLOWANCE in an update would bypass validate's
    // ALLOWANCE-required-field checks.
    const merged: CouponWriteDto = {
      code: dto.code ?? existing.code,
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description ?? undefined,
      outletId: dto.outletId ?? existing.outletId,
      discountType: (dto.discountType ?? existing.discountType) as any,
      discountValue: dto.discountValue ?? Number(existing.discountValue),
      minBillAmount: dto.minBillAmount ?? (existing.minBillAmount ? Number(existing.minBillAmount) : null),
      maxDiscountAmount: dto.maxDiscountAmount ?? (existing.maxDiscountAmount ? Number(existing.maxDiscountAmount) : null),
      validFrom: dto.validFrom ?? existing.validFrom,
      validUntil: dto.validUntil ?? existing.validUntil,
      maxUsesPerCustomer: dto.maxUsesPerCustomer ?? existing.maxUsesPerCustomer,
      maxTotalUses: dto.maxTotalUses ?? existing.maxTotalUses,
      targetType: (dto.targetType ?? existing.targetType) as CouponTargetType,
      isActive: dto.isActive ?? existing.isActive,
      kind: (dto.kind ?? existing.kind) as CouponKind,
      resetPeriod: (dto.resetPeriod ?? existing.resetPeriod) as ResetPeriod | null,
      perPeriodQuota: dto.perPeriodQuota ?? existing.perPeriodQuota,
      targetUserIds: dto.targetUserIds,
      targetTagIds: dto.targetTagIds,
      scope: dto.scope,
    };
    await this.validate(merged);

    const targetType: CouponTargetType = merged.targetType ?? 'ALL';
    const userIds = dto.targetUserIds;
    const tagIds = dto.targetTagIds;
    const scope = dto.scope;
    const kind = merged.kind ?? 'STANDARD';

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
          ...(dto.minBillAmount !== undefined ? { minBillAmount: kind === 'ALLOWANCE' ? null : dto.minBillAmount } : {}),
          ...(dto.maxDiscountAmount !== undefined ? { maxDiscountAmount: dto.maxDiscountAmount } : {}),
          ...(dto.validFrom !== undefined ? { validFrom: new Date(dto.validFrom) } : {}),
          ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
          ...(dto.maxUsesPerCustomer !== undefined ? { maxUsesPerCustomer: kind === 'ALLOWANCE' ? 0 : dto.maxUsesPerCustomer } : {}),
          ...(dto.maxTotalUses !== undefined ? { maxTotalUses: dto.maxTotalUses } : {}),
          ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
          ...(dto.resetPeriod !== undefined ? { resetPeriod: kind === 'ALLOWANCE' ? dto.resetPeriod : null } : {}),
          ...(dto.perPeriodQuota !== undefined ? { perPeriodQuota: kind === 'ALLOWANCE' ? dto.perPeriodQuota : null } : {}),
        },
      });

      // Child-row replacement — only when explicitly provided in the
      // DTO. Absence means "don't touch", to avoid accidentally
      // wiping targets / scope on a non-targeting field edit.
      if (userIds !== undefined) {
        await tx.couponCustomer.deleteMany({ where: { couponId: id } });
        if (targetType === 'SPECIFIC' && userIds.length) {
          await tx.couponCustomer.createMany({
            data: userIds.map((userId) => ({ couponId: id, userId })),
            skipDuplicates: true,
          });
        }
      }
      if (tagIds !== undefined) {
        await tx.couponTargetTag.deleteMany({ where: { couponId: id } });
        if (targetType === 'TAG' && tagIds.length) {
          await tx.couponTargetTag.createMany({
            data: tagIds.map((customerTagId) => ({ couponId: id, customerTagId })),
            skipDuplicates: true,
          });
        }
      }
      if (scope !== undefined) {
        await tx.couponScope.deleteMany({ where: { couponId: id } });
        if (kind === 'ALLOWANCE' && scope.length) {
          await tx.couponScope.createMany({
            data: scope.map((s) => ({ couponId: id, kind: s.kind, refId: s.refId })),
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
        targetTags: { select: { customerTagId: true } },
        scopes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve the caller's tag-at-this-outlet once if needed.
    let userTagId: string | null = null;
    if (userId) {
      const assignment = await this.prisma.customerTagAssignment.findUnique({
        where: { userId_outletId: { userId, outletId } },
        select: { customerTagId: true },
      });
      userTagId = assignment?.customerTagId ?? null;
    }

    const visible: any[] = [];
    for (const c of coupons) {
      if (c.targetType === 'SPECIFIC') {
        if (!userId) continue;
        if (!c.targetCustomers.some((t) => t.userId === userId)) continue;
      } else if (c.targetType === 'TAG') {
        if (!userTagId) continue;
        if (!c.targetTags.some((t) => t.customerTagId === userTagId)) continue;
      }
      if (c.maxTotalUses !== null && c.usesCount >= c.maxTotalUses) continue;

      if (c.kind === 'ALLOWANCE') {
        // Soft hint: if the period quota is already exhausted, hide
        // it from the available list so the customer doesn't try to
        // apply a non-applicable coupon. quote() re-checks definitively.
        if (userId) {
          const periodStart = startOfPeriod(now, c.resetPeriod as ResetPeriod);
          const consumed = await this.prisma.couponUsage.aggregate({
            where: {
              couponId: c.id,
              userId,
              voidedAt: null,
              appliedAt: { gte: periodStart },
            },
            _sum: { itemUnits: true },
          });
          const used = consumed._sum.itemUnits ?? 0;
          if (used >= (c.perPeriodQuota ?? 0)) continue;
        }
      } else if (userId) {
        // STANDARD: existing per-customer max-uses gate.
        const usedByUser = await this.prisma.couponUsage.count({
          where: { couponId: c.id, userId, voidedAt: null },
        });
        if (usedByUser >= c.maxUsesPerCustomer) continue;
      }

      const { targetCustomers, targetTags, ...rest } = c;
      void targetCustomers;
      void targetTags;
      visible.push(rest);
    }
    return visible;
  }

  // Quote a coupon against a hypothetical bill — returns the discount it
  // would apply, or rejects with reason. Used by the customer-side checkout
  // and by PricingService.quoteCart at order placement.
  //
  // For STANDARD coupons `cart` is ignored. For ALLOWANCE coupons `cart`
  // is required: the discount is computed per eligible line, capped by
  // the customer's remaining quota for the current period.
  async quote(
    couponId: string,
    userId: string,
    billSubtotal: number,
    cart?: QuoteCartLine[],
    outletId?: string,
  ): Promise<QuoteResult> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        targetCustomers: { select: { userId: true } },
        targetTags: { select: { customerTagId: true } },
        scopes: true,
      },
    });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Coupon not available');

    const now = new Date();
    if (coupon.validFrom > now || coupon.validUntil < now) {
      throw new BadRequestException('Coupon not within its validity window');
    }
    if (coupon.maxTotalUses !== null && coupon.usesCount >= coupon.maxTotalUses) {
      throw new BadRequestException('Coupon fully redeemed');
    }

    // Targeting check — same for both kinds.
    if (coupon.targetType === 'SPECIFIC') {
      if (!coupon.targetCustomers.some((t) => t.userId === userId)) {
        throw new BadRequestException('Coupon not available for this account');
      }
    } else if (coupon.targetType === 'TAG') {
      // TAG requires the coupon to be outlet-scoped. The caller may
      // supply outletId; otherwise fall back to the coupon's own.
      const ctxOutlet = outletId ?? coupon.outletId;
      if (!ctxOutlet) throw new BadRequestException('Coupon target requires an outlet context');
      const assignment = await this.prisma.customerTagAssignment.findUnique({
        where: { userId_outletId: { userId, outletId: ctxOutlet } },
        select: { customerTagId: true },
      });
      const tagId = assignment?.customerTagId;
      if (!tagId || !coupon.targetTags.some((t) => t.customerTagId === tagId)) {
        throw new BadRequestException('Coupon not available for this account');
      }
    }

    if (coupon.kind === 'ALLOWANCE') {
      return this.quoteAllowance(coupon as any, userId, cart);
    }
    return this.quoteStandard(coupon, userId, billSubtotal);
  }

  // ─── STANDARD branch (unchanged behaviour) ──────────────────────
  private async quoteStandard(coupon: any, userId: string, billSubtotal: number): Promise<QuoteResult> {
    if (coupon.minBillAmount && billSubtotal < Number(coupon.minBillAmount)) {
      throw new BadRequestException(`Minimum bill ₹${coupon.minBillAmount} not met`);
    }
    const userUses = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id, userId, voidedAt: null },
    });
    if (userUses >= coupon.maxUsesPerCustomer) {
      throw new BadRequestException('You have already used this coupon');
    }

    let discount =
      coupon.discountType === 'PERCENT'
        ? (billSubtotal * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
    discount = Math.min(discount, billSubtotal);
    return { coupon, discountAmount: round2(discount) };
  }

  // ─── ALLOWANCE branch ───────────────────────────────────────────
  // Per-period item-unit entitlement. Reads the consumed sum since
  // the current period boundary, walks eligible cart lines lowest-
  // price-first, discounting up to `remaining` units. See
  // docs/coupon-allowance-design.md §2 for the behavioural spec.
  private async quoteAllowance(coupon: any, userId: string, cart?: QuoteCartLine[]): Promise<QuoteResult> {
    if (!cart || !cart.length) {
      throw new BadRequestException('Cart required to apply an allowance coupon');
    }
    if (!coupon.resetPeriod || !coupon.perPeriodQuota) {
      throw new BadRequestException('Allowance coupon is misconfigured (missing reset period or quota)');
    }

    const now = new Date();
    const periodStart = startOfPeriod(now, coupon.resetPeriod as ResetPeriod);
    const consumedAgg = await this.prisma.couponUsage.aggregate({
      where: {
        couponId: coupon.id,
        userId,
        voidedAt: null,
        appliedAt: { gte: periodStart },
      },
      _sum: { itemUnits: true },
    });
    const consumed = consumedAgg._sum.itemUnits ?? 0;
    const remainingStart = Number(coupon.perPeriodQuota) - consumed;
    if (remainingStart <= 0) {
      throw new BadRequestException(`Allowance exhausted — resets ${describeNextReset(coupon.resetPeriod)}`);
    }

    // Build the per-unit eligibility list. Each cart line contributes
    // qty units at unitPrice if it matches any scope row.
    const scopeItems    = new Set<string>();
    const scopeCategories    = new Set<string>();
    const scopeSubcategories = new Set<string>();
    for (const s of coupon.scopes as Array<{ kind: string; refId: string }>) {
      if (s.kind === 'ITEM') scopeItems.add(s.refId);
      else if (s.kind === 'CATEGORY') scopeCategories.add(s.refId);
      else if (s.kind === 'SUBCATEGORY') scopeSubcategories.add(s.refId);
    }
    const isEligible = (line: QuoteCartLine) =>
      scopeItems.has(line.itemId) ||
      scopeSubcategories.has(line.subcategoryId) ||
      scopeCategories.has(line.categoryId);

    type Unit = { itemId: string; unitPrice: number };
    const eligibleUnits: Unit[] = [];
    for (const line of cart) {
      if (!isEligible(line)) continue;
      for (let i = 0; i < line.qty; i++) {
        eligibleUnits.push({ itemId: line.itemId, unitPrice: line.unitPrice });
      }
    }
    if (eligibleUnits.length === 0) {
      throw new BadRequestException('No items in the cart are eligible for this coupon');
    }

    // Cheapest-first — spreads the entitlement across more items
    // when quota is the binding constraint. See design doc §2.5.
    eligibleUnits.sort((a, b) => a.unitPrice - b.unitPrice);

    const perLineMap = new Map<string, { units: number; discount: number }>();
    let totalDiscount = 0;
    let unitsTaken = 0;

    const discountForUnit = (unitPrice: number): number => {
      const raw = coupon.discountType === 'PERCENT'
        ? (unitPrice * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
      return Math.min(raw, unitPrice); // employee pays at least 0
    };

    for (const u of eligibleUnits) {
      if (unitsTaken >= remainingStart) break;
      const d = discountForUnit(u.unitPrice);
      totalDiscount += d;
      unitsTaken += 1;
      const prev = perLineMap.get(u.itemId) ?? { units: 0, discount: 0 };
      perLineMap.set(u.itemId, { units: prev.units + 1, discount: prev.discount + d });
    }

    if (coupon.maxDiscountAmount) {
      totalDiscount = Math.min(totalDiscount, Number(coupon.maxDiscountAmount));
    }

    const perLine = Array.from(perLineMap.entries()).map(([itemId, v]) => ({
      itemId,
      units: v.units,
      discount: round2(v.discount),
    }));

    return {
      coupon,
      discountAmount: round2(totalDiscount),
      itemUnits: unitsTaken,
      perLine,
    };
  }

  // Helper for admin UI: resolve phone numbers → user ids so the operator
  // can target a coupon by phone without first looking up customer ids.
  async lookupByPhones(phones: string[]) {
    const map = await this.userLookup.findByPhones(phones);
    return Array.from(map.values()).map((u) => ({ id: u.id, name: u.name, phone: u.phone }));
  }

  // ─── Validation ─────────────────────────────────────────────────
  private async validate(dto: CouponWriteDto) {
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

    const kind: CouponKind = dto.kind ?? 'STANDARD';
    const targetType: CouponTargetType = dto.targetType ?? 'ALL';

    if (targetType === 'TAG') {
      if (!dto.outletId) {
        throw new BadRequestException('TAG targeting requires an outlet-scoped coupon (tags are outlet-scoped)');
      }
      if (dto.targetTagIds !== undefined && dto.targetTagIds.length === 0) {
        throw new BadRequestException('TAG targeting requires at least one tag');
      }
      // Confirm every chosen tag belongs to the same outlet.
      if (dto.targetTagIds?.length) {
        const tags = await this.prisma.customerTag.findMany({
          where: { id: { in: dto.targetTagIds } },
          select: { id: true, outletId: true },
        });
        if (tags.length !== dto.targetTagIds.length) {
          throw new BadRequestException('One or more target tags not found');
        }
        const wrong = tags.find((t) => t.outletId !== dto.outletId);
        if (wrong) {
          throw new BadRequestException('Target tags must belong to the coupon\'s outlet');
        }
      }
    }

    if (kind === 'ALLOWANCE') {
      if (!dto.resetPeriod || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(dto.resetPeriod)) {
        throw new BadRequestException('Allowance coupon requires resetPeriod (DAILY | WEEKLY | MONTHLY)');
      }
      if (!dto.perPeriodQuota || dto.perPeriodQuota <= 0) {
        throw new BadRequestException('Allowance coupon requires perPeriodQuota > 0');
      }
      if (dto.scope !== undefined && dto.scope.length === 0) {
        throw new BadRequestException('Allowance coupon requires at least one scope row');
      }
      if (dto.scope) {
        for (const s of dto.scope) {
          if (!['ITEM', 'CATEGORY', 'SUBCATEGORY'].includes(s.kind)) {
            throw new BadRequestException(`Invalid scope kind: ${s.kind}`);
          }
          if (!s.refId?.trim()) {
            throw new BadRequestException('Scope refId is required');
          }
        }
      }
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

// UTC-aligned period boundaries. Outlet-timezone-aware boundaries are
// a follow-up — see docs/coupon-allowance-design.md §10.
function startOfPeriod(now: Date, period: ResetPeriod): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (period === 'DAILY') {
    return new Date(Date.UTC(y, m, d, 0, 0, 0));
  }
  if (period === 'MONTHLY') {
    return new Date(Date.UTC(y, m, 1, 0, 0, 0));
  }
  // WEEKLY — ISO week starts Monday. Sunday is JS day 0; treat it as
  // day 7 so the subtraction lands on the previous Monday.
  const day = now.getUTCDay() || 7;
  return new Date(Date.UTC(y, m, d - (day - 1), 0, 0, 0));
}

function describeNextReset(period: string): string {
  if (period === 'DAILY')   return 'tomorrow at 00:00 UTC';
  if (period === 'WEEKLY')  return 'next Monday at 00:00 UTC';
  if (period === 'MONTHLY') return 'on the 1st of next month at 00:00 UTC';
  return 'at the next reset';
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
