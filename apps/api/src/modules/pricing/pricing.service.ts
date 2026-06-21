import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { DiscountsService } from '../discounts/discounts.service';
import { OffersService } from '../offers/offers.service';
import { RewardsService } from '../rewards/rewards.service';

// Customer-side cart line — always references a real Item (+ optional
// variant). Bundles are also Items (Item.isBundle=true) so the same shape
// covers both. Toppings + notes are not promo-relevant so they're elided
// here; the actual order create path still consumes them via the existing
// OrdersService.resolveOrderItems flow.
export type QuoteLineInput = {
  itemId?: string;
  variantId?: string;
  quantity: number;
};

export type QuoteInput = {
  outletId: string;
  lines: QuoteLineInput[];
  isParcel?: boolean;
  customerId?: string;
  // Dine-in table the cart belongs to. Used to resolve table-type price
  // overrides — the customer sees the section price on the menu, the
  // quote must match. Optional for counter / parcel flows.
  tableId?: string;
  // One coupon at most per the stacking rule the user chose.
  couponId?: string;
  // Reward points the customer wants to burn (gated by min + max%).
  rewardPoints?: number;
};

export type QuoteLine = {
  // Identity for the line
  itemId?: string;
  variantId?: string;
  quantity: number;
  name: string;
  // Per-line money
  unitPrice: number;
  totalPrice: number;
  // Snapshot of the auto discount that was applied to this line (if any).
  // We attach by-line so the receipt can show "Cheese pizza ₹400 - ₹40 lunch
  // discount = ₹360" rather than a vague bill-level reduction.
  lineDiscountAmount?: number;
  lineDiscountName?: string;
};

export type Quote = {
  outletId: string;
  lines: QuoteLine[];
  // Sums
  subtotal: number;            // sum of line totals AFTER item/category discounts
  rawSubtotal: number;         // sum of line totals BEFORE auto-discounts (useful for "you save" UI)
  taxAmount: number;
  parcelAmount: number;
  // Promotions
  autoDiscounts: { id: string; name: string; amount: number; level: 'BILL' | 'LINE' }[];
  // Eligible freebies the customer can pick at checkout. Each entry
  // carries a pool descriptor — scope ITEM = single fixed item (legacy);
  // ALL / CATEGORY / ITEMS = customer picks `pickQuantity` items from
  // the eligible pool. The legacy `getItemId` / `getItemName` /
  // `quantity` fields stay populated for the ITEM scope to keep
  // existing customer banners working without changes.
  offerFreebies: Array<{
    offerId: string;
    offerName: string;
    pickQuantity: number;
    pool:
      | { scope: 'ITEM'; itemId: string; itemName: string }
      | { scope: 'ALL'; items: Array<{ id: string; name: string; basePrice: number }> }
      | { scope: 'CATEGORY'; categoryId: string; categoryName: string; items: Array<{ id: string; name: string; basePrice: number }> }
      | { scope: 'ITEMS'; items: Array<{ id: string; name: string; basePrice: number }> };
    // Back-compat shims for older clients.
    getItemId: string | null;
    getItemName: string;
    quantity: number;
  }>;
  coupon?: { id: string; code: string; name: string; amount: number };
  reward?: { points: number; amount: number };
  // Totals
  totalAutoDiscount: number;
  totalPromoDiscount: number;  // coupon + reward
  totalAmount: number;
};

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private coupons: CouponsService,
    private discounts: DiscountsService,
    private offers: OffersService,
    private rewards: RewardsService,
  ) {}

  // Customer-facing quote — runs the full pricing waterfall and returns the
  // breakdown without persisting anything. The /cart/quote endpoint calls
  // this and the customer UI re-renders the bill.
  async quoteCart(input: QuoteInput): Promise<Quote> {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: input.outletId },
      select: {
        id: true, gstApplicable: true, gstPercent: true, priceIncludesGst: true,
        parcelChargeEnabled: true, defaultParcelCharge: true,
        acceptRewardRedemption: true, businessId: true,
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const gstOn = !!outlet.gstApplicable;
    const outletDefaultPct = gstOn ? Number(outlet.gstPercent ?? 0) : 0;

    // Resolve viewer's customer tag (for tag-price overrides) and the
    // table's type (for section-price overrides). Identical to what
    // OrdersService.create does — without these the quote total wouldn't
    // match the order total and the customer would be charged the wrong
    // amount via Razorpay.
    let viewerTagId: string | null = null;
    if (input.customerId) {
      const a = await this.prisma.customerTagAssignment.findUnique({
        where: { userId_outletId: { userId: input.customerId, outletId: input.outletId } },
      });
      viewerTagId = a?.customerTagId ?? null;
    }
    let tableTypeId: string | null = null;
    if (input.tableId) {
      const t = await this.prisma.table.findUnique({
        where: { id: input.tableId },
        select: { tableTypeId: true, outletId: true },
      });
      if (t?.outletId === input.outletId) tableTypeId = t.tableTypeId;
    }

    // 1. Resolve lines → price + category + subcategory. Bundles are just
    //    items where isBundle=true, so the same lookup covers both — the
    //    parent Item.basePrice is the bundle price.
    //    Quote is a preview, so we skip stock + topping math here — those are
    //    enforced server-side when the order is actually created.
    const lines: (QuoteLine & {
      categoryId?: string;
      subcategoryId?: string;
      gstRate: number;
      useCustomParcelCharge?: boolean;
      parcelCharge?: number | null;
    })[] = [];
    for (const l of input.lines) {
      if (!l.itemId) throw new BadRequestException('Each line needs an itemId');
      const item = await this.prisma.item.findUnique({
        where: { id: l.itemId },
        select: {
          id: true, name: true, basePrice: true, gstRate: true,
          subcategoryId: true, subcategory: { select: { categoryId: true } },
          // Parcel fields needed below for the parcel-charge calc — keep
          // in lock-step with OrdersService.computeParcelCharge.
          useCustomParcelCharge: true, parcelCharge: true,
          customerTagPrices: viewerTagId
            ? { where: { customerTagId: viewerTagId } }
            : false,
          tableTypePrices: tableTypeId
            ? { where: { tableTypeId } }
            : false,
        },
      });
      if (!item) throw new BadRequestException('Item not found');
      let unit = Number(item.basePrice);
      if (l.variantId) {
        const v = await this.prisma.variant.findUnique({ where: { id: l.variantId }, select: { price: true } });
        if (v) unit = Number(v.price);
      }
      // Price-override precedence (same as resolveOrderItems): CustomerTag
      // > TableType > variant > basePrice. A tagged customer sees their
      // tag price on the menu; the quote must match.
      const ctPrice = viewerTagId
        ? (item as any).customerTagPrices?.find(
            (p: any) =>
              p.customerTagId === viewerTagId &&
              (l.variantId ? p.variantId === l.variantId : !p.variantId),
          )
        : null;
      const ttPrice = tableTypeId
        ? (item as any).tableTypePrices?.find(
            (p: any) =>
              p.tableTypeId === tableTypeId &&
              (l.variantId ? p.variantId === l.variantId : !p.variantId),
          )
        : null;
      if (ctPrice?.price != null) unit = Number(ctPrice.price);
      else if (ttPrice?.price != null) unit = Number(ttPrice.price);

      // GST rate: TableType > CustomerTag > item default > outlet fallback
      // (mirrors resolveOrderItems).
      let gstRate = 0;
      if (gstOn) {
        if (ttPrice?.gstRate != null) gstRate = Number(ttPrice.gstRate);
        else if (ctPrice?.gstRate != null) gstRate = Number(ctPrice.gstRate);
        else if (item.gstRate != null) gstRate = Number(item.gstRate);
        else gstRate = outletDefaultPct;
      }

      lines.push({
        itemId: item.id,
        variantId: l.variantId,
        quantity: l.quantity,
        name: item.name,
        unitPrice: unit,
        totalPrice: unit * l.quantity,
        gstRate,
        categoryId: item.subcategory?.categoryId,
        subcategoryId: item.subcategoryId,
        useCustomParcelCharge: (item as any).useCustomParcelCharge,
        parcelCharge: (item as any).parcelCharge != null ? Number((item as any).parcelCharge) : null,
      });
    }

    // 2. Active auto-discounts (ITEM / SUBCATEGORY / CATEGORY / BILL).
    const activeDiscounts = await this.discounts.activeAutoForOutlet(input.outletId);

    const autoDiscounts: Quote['autoDiscounts'] = [];

    // 2a. Line-level discounts — apply at most one per line (highest-amount wins).
    for (const line of lines) {
      const candidates = activeDiscounts.filter((d) => {
        if (d.targetType === 'ITEM') return d.itemId === line.itemId;
        if (d.targetType === 'SUBCATEGORY') return d.subcategoryId === line.subcategoryId;
        if (d.targetType === 'CATEGORY') return d.categoryId === line.categoryId;
        return false;
      });
      if (!candidates.length) continue;

      let best: { d: any; amount: number } | null = null;
      for (const d of candidates) {
        const amt = this.computeDiscount(d, line.totalPrice);
        if (amt > 0 && (!best || amt > best.amount)) best = { d, amount: amt };
      }
      if (best) {
        line.lineDiscountAmount = best.amount;
        line.lineDiscountName = best.d.name;
        line.totalPrice = line.totalPrice - best.amount;
        autoDiscounts.push({ id: best.d.id, name: best.d.name, amount: best.amount, level: 'LINE' });
      }
    }

    // 3. Subtotal + tax. Mirrors the OrdersService.create logic — when the
    //    outlet's prices already include GST, we back the tax out so the
    //    receipt math is consistent.
    let rawSubtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    let runningSubtotal = lines.reduce((s, l) => s + l.totalPrice, 0);
    let taxAmount = 0;

    if (gstOn) {
      if (outlet.priceIncludesGst) {
        // Each line totalPrice is gross — pull GST out using its own rate.
        taxAmount = lines.reduce((s, l) => {
          const r = l.gstRate / 100;
          return s + (l.totalPrice - l.totalPrice / (1 + r));
        }, 0);
        runningSubtotal = runningSubtotal - taxAmount;
      } else {
        taxAmount = lines.reduce((s, l) => s + l.totalPrice * (l.gstRate / 100), 0);
      }
    }

    // 4. Bill-level auto-discount — at most one (largest qualifying).
    const billDiscounts = activeDiscounts.filter((d) => d.targetType === 'BILL');
    let bestBill: { d: any; amount: number } | null = null;
    for (const d of billDiscounts) {
      if (d.minBillAmount && Number(d.minBillAmount) > runningSubtotal) continue;
      const amt = this.computeDiscount(d, runningSubtotal);
      if (amt > 0 && (!bestBill || amt > bestBill.amount)) bestBill = { d, amount: amt };
    }
    if (bestBill) {
      runningSubtotal = runningSubtotal - bestBill.amount;
      autoDiscounts.push({ id: bestBill.d.id, name: bestBill.d.name, amount: bestBill.amount, level: 'BILL' });
    }

    // 5. Offer freebies — detected against the raw cart (pre-coupon),
    //    surfaced separately so the UI can show "1× Sweet (complimentary)".
    const activeOffers = await this.offers.activeForOutlet(input.outletId);
    const offerFreebies: Quote['offerFreebies'] = [];

    // Resolve an offer's pool descriptor. ITEM = legacy single item;
    // ALL / CATEGORY / ITEMS = customer-pick at checkout. ITEMS pool
    // hydrates names/prices for the modal in one go so the client
    // doesn't fan out per-id lookups.
    const buildPool = async (offer: any): Promise<Quote['offerFreebies'][number]['pool'] | null> => {
      const scope: string | null = offer.getScope ?? (offer.getItemId ? 'ITEM' : null);
      if (scope === 'ITEM') {
        if (!offer.getItemId) return null;
        return { scope: 'ITEM', itemId: offer.getItemId, itemName: offer.getItem?.name ?? 'Free item' };
      }
      // For ALL / CATEGORY / ITEMS we resolve the pool to concrete
      // items here so the customer picker renders without an extra
      // round-trip. Cap ALL at 200 items so a sprawling menu doesn't
      // bloat the quote response.
      if (scope === 'ALL') {
        const items = await this.prisma.item.findMany({
          where: {
            isAvailable: true,
            isDisplayed: true,
            subcategory: { category: { outletId: input.outletId } },
          },
          select: { id: true, name: true, basePrice: true },
          orderBy: { name: 'asc' },
          take: 200,
        });
        return {
          scope: 'ALL',
          items: items.map((it) => ({ id: it.id, name: it.name, basePrice: Number(it.basePrice) })),
        };
      }
      if (scope === 'CATEGORY') {
        if (!offer.getCategoryId) return null;
        const items = await this.prisma.item.findMany({
          where: {
            isAvailable: true,
            isDisplayed: true,
            subcategory: { categoryId: offer.getCategoryId },
          },
          select: { id: true, name: true, basePrice: true },
          orderBy: { name: 'asc' },
        });
        return {
          scope: 'CATEGORY',
          categoryId: offer.getCategoryId,
          categoryName: offer.getCategory?.name ?? 'Category',
          items: items.map((it) => ({ id: it.id, name: it.name, basePrice: Number(it.basePrice) })),
        };
      }
      if (scope === 'ITEMS') {
        const ids: string[] = Array.isArray(offer.getItemIds) ? offer.getItemIds : [];
        if (ids.length === 0) return null;
        const items = await this.prisma.item.findMany({
          where: { id: { in: ids }, isAvailable: true },
          select: { id: true, name: true, basePrice: true },
        });
        return {
          scope: 'ITEMS',
          items: items.map((it) => ({ id: it.id, name: it.name, basePrice: Number(it.basePrice) })),
        };
      }
      return null;
    };

    for (const offer of activeOffers) {
      // Resolve the offer's eligible-pool descriptor first; if it's
      // misconfigured (e.g. ITEMS with empty list), skip silently
      // rather than letting the customer pick from nothing.
      const pool = await buildPool(offer);
      if (!pool) continue;

      // Legacy fields the existing customer banner reads.
      const legacy = pool.scope === 'ITEM'
        ? { getItemId: pool.itemId, getItemName: pool.itemName }
        : { getItemId: null, getItemName: pool.scope === 'CATEGORY'
            ? `Pick from ${pool.categoryName}`
            : pool.scope === 'ITEMS'
              ? `Pick ${offer.getQuantity ?? 1} from ${pool.items.length} options`
              : 'Pick your free item' };

      if (offer.triggerType === 'MIN_BILL') {
        if (rawSubtotal >= Number(offer.minBillAmount ?? 0)) {
          offerFreebies.push({
            offerId: offer.id,
            offerName: offer.name,
            pickQuantity: offer.getQuantity ?? 1,
            pool,
            ...legacy,
            quantity: offer.getQuantity ?? 1,
          });
        }
      } else if (offer.triggerType === 'BUY_X_GET_Y') {
        const buyQty = lines
          .filter((l) => l.itemId === offer.buyItemId)
          .reduce((s, l) => s + l.quantity, 0);
        if (offer.buyQuantity && buyQty >= offer.buyQuantity) {
          const multiples = Math.floor(buyQty / offer.buyQuantity);
          const freebieQty = multiples * (offer.getQuantity ?? 1);
          offerFreebies.push({
            offerId: offer.id,
            offerName: offer.name,
            pickQuantity: freebieQty,
            pool,
            ...legacy,
            quantity: freebieQty,
          });
        }
      }
    }

    // 6. Parcel charge. Mirrors OrdersService.computeParcelCharge so the
    //    customer-facing /pricing/quote preview always matches the actual
    //    charge the order will incur:
    //      - If ANY line has a per-item override
    //        (useCustomParcelCharge && parcelCharge != null) the items'
    //        charge × qty REPLACES the outlet flat for the whole bill.
    //        Lines without their own override contribute 0.
    //      - Else outlet.defaultParcelCharge flat (when enabled).
    //      - Else 0.
    let parcelAmount = 0;
    if (input.isParcel) {
      let itemOverrideTotal = 0;
      let anyOverride = false;
      for (const line of lines) {
        if (line.useCustomParcelCharge && line.parcelCharge != null) {
          itemOverrideTotal += Number(line.parcelCharge) * line.quantity;
          anyOverride = true;
        }
      }
      if (anyOverride) {
        parcelAmount = itemOverrideTotal;
      } else if (outlet.parcelChargeEnabled) {
        parcelAmount = Number(outlet.defaultParcelCharge ?? 0);
      }
    }

    // Running total ahead of the customer-driven promotions.
    const preCustomerTotal = runningSubtotal + taxAmount + parcelAmount;

    // 7. Coupon — one per bill, customer-selected.
    let couponPromo: Quote['coupon'] | undefined;
    if (input.couponId) {
      if (!input.customerId) throw new BadRequestException('Customer required to apply a coupon');
      const { coupon, discountAmount } = await this.coupons.quote(
        input.couponId,
        input.customerId,
        preCustomerTotal,
      );
      couponPromo = {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        amount: discountAmount,
      };
    }
    const totalAfterCoupon = Math.max(0, preCustomerTotal - (couponPromo?.amount ?? 0));

    // 8. Reward redemption — customer-chosen point amount.
    let rewardPromo: Quote['reward'] | undefined;
    if (input.rewardPoints && input.rewardPoints > 0) {
      if (!input.customerId) throw new BadRequestException('Customer required to redeem points');
      const q = await this.rewards.quoteRedeem(
        input.customerId,
        totalAfterCoupon,
        input.rewardPoints,
        input.outletId,
      );
      rewardPromo = { points: q.pointsRequested, amount: q.applied };
    }
    // `totalAfterCoupon` / `totalAfterReward` chain was used by the old
    // (GST-on-gross) flow. Removed — the final totalAmount is now derived
    // from the net-tax recompute below so coupons + rewards reduce both
    // the taxable subtotal AND the GST proportionally.

    const totalAutoDiscount = autoDiscounts.reduce((s, d) => s + d.amount, 0);
    const totalPromoDiscount = (couponPromo?.amount ?? 0) + (rewardPromo?.amount ?? 0);

    // ─── GST on the *net* (post-discount) taxable amount ────────────
    // Indian convention: discounts first, GST after. Per-line GST rates
    // are preserved by allocating the total discount proportionally to
    // each line's pre-tax gross share, then computing each line's tax
    // on its allocated net. Sum gives the new aggregate taxAmount.
    if (gstOn) {
      // `runningSubtotal` here is already (gross − line discounts − bill discount).
      // `taxAmount` was computed earlier on the pre-bill-discount amount;
      // we override it below with the net-based recompute so the bill,
      // coupon, and reward discounts also reduce tax (not just line ones).
      const customerDiscount = (couponPromo?.amount ?? 0) + (rewardPromo?.amount ?? 0);
      const taxableSubtotal = Math.max(0, runningSubtotal - customerDiscount);
      const preTaxBase = lines.reduce((s, l) => s + l.totalPrice, 0); // post line-discount
      if (preTaxBase > 0) {
        const netRatio = taxableSubtotal / preTaxBase;
        taxAmount = lines.reduce(
          (s, l) => s + (l.totalPrice * netRatio) * (l.gstRate / 100),
          0,
        );
      } else {
        taxAmount = 0;
      }
      runningSubtotal = taxableSubtotal;
    }
    const totalAmount = Math.max(0, runningSubtotal + parcelAmount + taxAmount);

    const finalLines: QuoteLine[] = lines.map((l) => ({
      itemId: l.itemId,
      variantId: l.variantId,
      quantity: l.quantity,
      name: l.name,
      unitPrice: this.round2(l.unitPrice),
      totalPrice: this.round2(l.totalPrice),
      lineDiscountAmount: l.lineDiscountAmount ? this.round2(l.lineDiscountAmount) : undefined,
      lineDiscountName: l.lineDiscountName,
    }));

    return {
      outletId: input.outletId,
      lines: finalLines,
      rawSubtotal: this.round2(rawSubtotal),
      subtotal: this.round2(runningSubtotal),
      taxAmount: this.round2(taxAmount),
      parcelAmount: this.round2(parcelAmount),
      autoDiscounts: autoDiscounts.map((d) => ({ ...d, amount: this.round2(d.amount) })),
      offerFreebies,
      coupon: couponPromo ? { ...couponPromo, amount: this.round2(couponPromo.amount) } : undefined,
      reward: rewardPromo ? { ...rewardPromo, amount: this.round2(rewardPromo.amount) } : undefined,
      totalAutoDiscount: this.round2(totalAutoDiscount),
      totalPromoDiscount: this.round2(totalPromoDiscount),
      // `totalAmount` now comes from the net-tax recompute above, not
      // from the running subtract-discount-from-pre-tax-total chain.
      // The old `totalAfterReward` is dead but retained as a local so
      // the diff is readable; same number when all discounts are line-
      // level (no behaviour change for the simple case).
      totalAmount: this.round2(totalAmount),
    };
  }

  private computeDiscount(d: any, base: number): number {
    let amount = d.discountType === 'PERCENT'
      ? (base * Number(d.discountValue)) / 100
      : Number(d.discountValue);
    if (d.maxDiscountAmount) amount = Math.min(amount, Number(d.maxDiscountAmount));
    amount = Math.min(amount, base);
    return amount > 0 ? amount : 0;
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }
}
