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
  offerFreebies: { offerId: string; offerName: string; getItemId: string | null; getItemName: string; quantity: number }[];
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

    // 1. Resolve lines → price + category + subcategory. Bundles are just
    //    items where isBundle=true, so the same lookup covers both — the
    //    parent Item.basePrice is the bundle price.
    //    Quote is a preview, so we skip stock + topping math here — those are
    //    enforced server-side when the order is actually created.
    const lines: (QuoteLine & { categoryId?: string; subcategoryId?: string; gstRate: number })[] = [];
    for (const l of input.lines) {
      if (!l.itemId) throw new BadRequestException('Each line needs an itemId');
      const item = await this.prisma.item.findUnique({
        where: { id: l.itemId },
        select: {
          id: true, name: true, basePrice: true, gstRate: true,
          subcategoryId: true, subcategory: { select: { categoryId: true } },
        },
      });
      if (!item) throw new BadRequestException('Item not found');
      let unit = Number(item.basePrice);
      if (l.variantId) {
        const v = await this.prisma.variant.findUnique({ where: { id: l.variantId }, select: { price: true } });
        if (v) unit = Number(v.price);
      }
      lines.push({
        itemId: item.id,
        variantId: l.variantId,
        quantity: l.quantity,
        name: item.name,
        unitPrice: unit,
        totalPrice: unit * l.quantity,
        gstRate: gstOn ? Number(item.gstRate ?? outletDefaultPct) : 0,
        categoryId: item.subcategory?.categoryId,
        subcategoryId: item.subcategoryId,
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

    for (const offer of activeOffers) {
      if (offer.triggerType === 'MIN_BILL') {
        if (rawSubtotal >= Number(offer.minBillAmount ?? 0) && offer.getItemId) {
          offerFreebies.push({
            offerId: offer.id,
            offerName: offer.name,
            getItemId: offer.getItemId,
            getItemName: offer.getItem?.name ?? 'Free item',
            quantity: offer.getQuantity ?? 1,
          });
        }
      } else if (offer.triggerType === 'BUY_X_GET_Y') {
        const buyQty = lines
          .filter((l) => l.itemId === offer.buyItemId)
          .reduce((s, l) => s + l.quantity, 0);
        if (offer.buyQuantity && buyQty >= offer.buyQuantity && offer.getItemId) {
          const multiples = Math.floor(buyQty / offer.buyQuantity);
          const freebieQty = multiples * (offer.getQuantity ?? 1);
          offerFreebies.push({
            offerId: offer.id,
            offerName: offer.name,
            getItemId: offer.getItemId,
            getItemName: offer.getItem?.name ?? 'Free item',
            quantity: freebieQty,
          });
        }
      }
    }

    // 6. Parcel charge — flat per the outlet config when isParcel = true.
    const parcelAmount = input.isParcel && outlet.parcelChargeEnabled
      ? Number(outlet.defaultParcelCharge ?? 0)
      : 0;

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
    const totalAfterReward = Math.max(0, totalAfterCoupon - (rewardPromo?.amount ?? 0));

    const totalAutoDiscount = autoDiscounts.reduce((s, d) => s + d.amount, 0);
    const totalPromoDiscount = (couponPromo?.amount ?? 0) + (rewardPromo?.amount ?? 0);

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
      totalAmount: this.round2(totalAfterReward),
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
