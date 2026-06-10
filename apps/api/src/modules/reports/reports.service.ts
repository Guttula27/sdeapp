import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import * as dayjs from 'dayjs';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getRevenueReport(outletId: string, from: Date, to: Date) {
    const orders = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const [total, payments, distinctCustomers, allOrdersCount] = await Promise.all([
      this.prisma.order.aggregate({
        where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
        _sum: { totalAmount: true, taxAmount: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      // SUCCESS payments inside the range, grouped by mode. Sum on payments
      // (not orders) so partial/multi-tender payments are counted correctly.
      this.prisma.payment.groupBy({
        by: ['mode'],
        where: {
          status: 'SUCCESS',
          createdAt: { gte: from, lte: to },
          order: { outletId },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Distinct customers who placed *any* order (not only SERVED) in the
      // range — gives a truer footfall number for the period.
      this.prisma.order.findMany({
        where: { outletId, createdAt: { gte: from, lte: to }, customerId: { not: null } },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
      // Total orders placed in the range regardless of status (the totalOrders
      // above is SERVED-only). Surface both so the UI can show throughput vs.
      // realised revenue separately.
      this.prisma.order.count({
        where: { outletId, createdAt: { gte: from, lte: to } },
      }),
    ]);

    const paymentSplit: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      WALLET: { amount: 0, count: 0 },
      NET_BANKING: { amount: 0, count: 0 },
    };
    payments.forEach((p) => {
      paymentSplit[p.mode] = { amount: Number(p._sum.amount || 0), count: p._count.id };
    });

    return {
      orders,
      summary: {
        totalRevenue: total._sum.totalAmount || 0,
        totalTax: total._sum.taxAmount || 0,
        // totalOrders kept as SERVED-only for revenue context; totalOrdersAll
        // includes every status (cancellations, in-progress, etc.) for throughput.
        totalOrders: total._count.id,
        totalOrdersAll: allOrdersCount,
        totalCustomers: distinctCustomers.length,
        avgOrderValue: total._avg.totalAmount || 0,
        paymentSplit,
      },
    };
  }

  async getItemSalesReport(outletId: string, from: Date, to: Date) {
    return this.prisma.orderItem.groupBy({
      by: ['itemId'],
      where: { order: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20,
    });
  }

  async getKitchenReport(outletId: string, from: Date, to: Date) {
    const orders = await this.prisma.order.findMany({
      where: { outletId, createdAt: { gte: from, lte: to }, status: 'SERVED' },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
    });

    const preparationTimes: number[] = orders.flatMap((order) => {
      const accepted = order.statusHistory.find((h) => h.status === 'QUEUED');
      const ready = order.statusHistory.find((h) => h.status === 'READY');
      if (!accepted || !ready) return [];
      return [dayjs(ready.createdAt).diff(dayjs(accepted.createdAt), 'minute')];
    });

    const avgTime = preparationTimes.length
      ? preparationTimes.reduce((a, b) => a + b, 0) / preparationTimes.length
      : 0;

    return { avgPreparationMinutes: Math.round(avgTime), sampleSize: preparationTimes.length };
  }

  async getHourlyOrders(outletId: string, date: Date) {
    const start = dayjs(date).startOf('day').toDate();
    const end = dayjs(date).endOf('day').toDate();

    const orders = await this.prisma.order.findMany({
      where: { outletId, createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalAmount: true },
    });

    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      orders: 0,
      revenue: 0,
    }));

    orders.forEach((o) => {
      const hour = dayjs(o.createdAt).hour();
      hourly[hour].orders++;
      hourly[hour].revenue += Number(o.totalAmount);
    });

    return hourly;
  }

  async getPlatformSummary(date: Date) {
    const start = dayjs(date).startOf('day').toDate();
    const end   = dayjs(date).endOf('day').toDate();

    const [
      totalBusinesses, activeBusinesses, totalOutlets,
      todayTotals, activeOrders, topBusinesses, distinctCustomers,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.business.count({ where: { status: 'ACTIVE' } }),
      this.prisma.outlet.count(),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
        _count: { id: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: { status: { in: ['CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE'] } },
      }),
      this.prisma.order.groupBy({
        by: ['outletId'],
        where: { status: 'SERVED', createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5,
      }),
      // Distinct customers across the entire platform for the selected date.
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end }, customerId: { not: null } },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
    ]);

    const outletIds = topBusinesses.map(r => r.outletId);
    const outlets = outletIds.length
      ? await this.prisma.outlet.findMany({
          where: { id: { in: outletIds } },
          select: { id: true, name: true, business: { select: { name: true } } },
        })
      : [];
    const outletMap = new Map(outlets.map(o => [o.id, o]));

    return {
      totalBusinesses,
      activeBusinesses,
      totalOutlets,
      todayOrders:    todayTotals._count.id,
      todayCustomers: distinctCustomers.length,
      todayRevenue:   Number(todayTotals._sum.totalAmount || 0),
      avgOrderValue:  Number(todayTotals._avg.totalAmount || 0),
      activeOrders,
      topOutlets: topBusinesses.map(r => ({
        outletId: r.outletId,
        outletName:   outletMap.get(r.outletId)?.name || 'Unknown',
        businessName: outletMap.get(r.outletId)?.business?.name || '',
        revenue: Number(r._sum.totalAmount || 0),
        orders: r._count.id,
      })),
    };
  }

  /**
   * GST report for the given outlet + date range. Returns three views:
   *
   *   - `total`:        gross subtotal + total CGST + total SGST + total
   *                     IGST + total tax + grand total across the period.
   *                     Drives the headline cards on the GST tab and the
   *                     numbers an accountant copies into the GSTR-1.
   *   - `byRate`:       breakdown of taxable + tax amount per GST rate
   *                     slab (5%, 12%, 18%, 28%). Required because Indian
   *                     GST filing groups by rate.
   *   - `dailyTotals`:  one row per calendar day in the range with
   *                     subtotal + tax + grand total. Drives the
   *                     time-series chart and a CSV export.
   *
   * Numbers come from order items (not the parent order) so the slab
   * breakdown is exact even on mixed-rate carts. Only SERVED orders
   * are counted — refunds and in-progress are excluded.
   */
  async getGstReport(outletId: string, from: Date, to: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        status: { not: 'CANCELLED' },
        order: {
          outletId,
          status: 'SERVED',
          createdAt: { gte: from, lte: to },
        },
      },
      select: {
        gstRate: true, gstAmount: true, totalPrice: true,
        order: { select: { createdAt: true, totalAmount: true, cgstAmount: true, sgstAmount: true } },
      },
    });

    // Per-rate accumulator. Stores taxable (line totals before tax) and
    // tax amount keyed by rate. The split into CGST + SGST is half-of-tax
    // for intra-state; IGST gets the full amount when the order had
    // cgst=0 — same rule the receipt uses.
    type Bucket = { taxable: number; tax: number };
    const byRate = new Map<number, Bucket>();
    let totalTaxable = 0;
    let totalTax = 0;

    for (const it of items) {
      const rate = Number(it.gstRate);
      const taxable = Math.max(0, Number(it.totalPrice) - Number(it.gstAmount));
      const tax = Number(it.gstAmount);
      const bucket = byRate.get(rate) ?? { taxable: 0, tax: 0 };
      bucket.taxable += taxable;
      bucket.tax += tax;
      byRate.set(rate, bucket);
      totalTaxable += taxable;
      totalTax += tax;
    }

    // Order-level aggregates for the headline cards.
    const orderAgg = await this.prisma.order.aggregate({
      where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
      _sum: { subtotal: true, taxAmount: true, totalAmount: true, cgstAmount: true, sgstAmount: true, discountAmount: true },
      _count: { id: true },
    });

    // Total IGST is whatever tax wasn't accounted for in CGST + SGST.
    // For orders that stored cgst=0 with non-zero taxAmount we treat the
    // remainder as IGST.
    const cgst = Number(orderAgg._sum.cgstAmount || 0);
    const sgst = Number(orderAgg._sum.sgstAmount || 0);
    const tax  = Number(orderAgg._sum.taxAmount || 0);
    const igst = Math.max(0, tax - cgst - sgst);

    // Daily series. Bucket the orders into a per-day map so the
    // time-series chart can render at one point per day.
    const daily = new Map<string, { date: string; subtotal: number; tax: number; total: number; orders: number }>();
    const dailyOrders = await this.prisma.order.findMany({
      where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
      select: { createdAt: true, subtotal: true, taxAmount: true, totalAmount: true },
    });
    for (const o of dailyOrders) {
      const day = dayjs(o.createdAt).format('YYYY-MM-DD');
      const row = daily.get(day) ?? { date: day, subtotal: 0, tax: 0, total: 0, orders: 0 };
      row.subtotal += Number(o.subtotal);
      row.tax      += Number(o.taxAmount);
      row.total    += Number(o.totalAmount);
      row.orders   += 1;
      daily.set(day, row);
    }
    const dailyTotals = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      total: {
        subtotal:     Number(orderAgg._sum.subtotal || 0),
        cgst, sgst, igst,
        totalTax:     tax,
        discount:     Number(orderAgg._sum.discountAmount || 0),
        grandTotal:   Number(orderAgg._sum.totalAmount || 0),
        orders:       orderAgg._count.id,
      },
      byRate: Array.from(byRate.entries())
        .map(([rate, b]) => ({
          rate,
          taxable: round2(b.taxable),
          cgst:    round2(b.tax / 2),
          sgst:    round2(b.tax / 2),
          totalTax:round2(b.tax),
        }))
        .sort((a, b) => a.rate - b.rate),
      dailyTotals: dailyTotals.map((d) => ({
        date: d.date,
        subtotal: round2(d.subtotal),
        tax:      round2(d.tax),
        total:    round2(d.total),
        orders:   d.orders,
      })),
    };
  }

  /**
   * Category-level sales breakdown — items rolled up to their
   * subcategory, subcategory rolled up to its category. Returns the
   * full two-level tree with totals at each level so the UI can show
   * a category chart with sub-bars.
   */
  async getCategorySalesReport(outletId: string, from: Date, to: Date) {
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        status: { not: 'CANCELLED' },
        order: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
      },
      select: {
        quantity: true, totalPrice: true,
        item: {
          select: {
            id: true, name: true,
            subcategory: {
              select: {
                id: true, name: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Two-level rollup: category → subcategory → totals.
    const tree = new Map<string, {
      categoryId: string; categoryName: string;
      quantity: number; revenue: number;
      subcategories: Map<string, { id: string; name: string; quantity: number; revenue: number }>;
    }>();

    for (const it of orderItems) {
      const sub = it.item?.subcategory;
      const cat = sub?.category;
      if (!cat) continue; // legacy items without a category get skipped
      const catRow = tree.get(cat.id) ?? {
        categoryId: cat.id, categoryName: cat.name,
        quantity: 0, revenue: 0, subcategories: new Map(),
      };
      const subRow = catRow.subcategories.get(sub.id) ?? {
        id: sub.id, name: sub.name, quantity: 0, revenue: 0,
      };
      const qty = Number(it.quantity);
      const rev = Number(it.totalPrice);
      catRow.quantity += qty;
      catRow.revenue  += rev;
      subRow.quantity += qty;
      subRow.revenue  += rev;
      catRow.subcategories.set(sub.id, subRow);
      tree.set(cat.id, catRow);
    }

    return Array.from(tree.values())
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        quantity: c.quantity,
        revenue: round2(c.revenue),
        subcategories: Array.from(c.subcategories.values())
          .map((s) => ({ ...s, revenue: round2(s.revenue) }))
          .sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Customer analytics for the outlet over the range. Returns:
   *   - top customers by spend (top 20)
   *   - new vs. repeat split (a customer is "new" if their FIRST order
   *     ever falls inside the range, "repeat" otherwise — same
   *     definition restaurants typically use for retention)
   *   - segments by lifetime spend (₹0-500 / 500-2k / 2k-10k / >10k)
   */
  async getCustomerAnalytics(outletId: string, from: Date, to: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        outletId, status: 'SERVED',
        createdAt: { gte: from, lte: to },
        customerId: { not: null },
      },
      select: {
        customerId: true, totalAmount: true, createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    const map = new Map<string, {
      id: string; name: string | null; phone: string | null;
      orders: number; spend: number;
    }>();
    for (const o of orders) {
      const id = o.customerId!;
      const row = map.get(id) ?? {
        id, name: o.customer?.name ?? null, phone: o.customer?.phone ?? null,
        orders: 0, spend: 0,
      };
      row.orders += 1;
      row.spend  += Number(o.totalAmount);
      map.set(id, row);
    }

    // New vs. repeat: a customer is "new" if their first-ever order
    // falls inside [from, to]. Skip customers who only had cancelled
    // orders inside the window (they're not in `map`).
    const ids = Array.from(map.keys());
    const firstOrderRows = ids.length
      ? await this.prisma.order.groupBy({
          by: ['customerId'],
          where: { customerId: { in: ids } },
          _min: { createdAt: true },
        })
      : [];
    let newCount = 0;
    let repeatCount = 0;
    for (const r of firstOrderRows) {
      const first = r._min.createdAt;
      if (first && first >= from) newCount++;
      else repeatCount++;
    }

    // Lifetime spend segments — lifetime is across all the user's SERVED
    // orders at this outlet, not just the window.
    const lifetimeSpend = ids.length
      ? await this.prisma.order.groupBy({
          by: ['customerId'],
          where: { customerId: { in: ids }, outletId, status: 'SERVED' },
          _sum: { totalAmount: true },
        })
      : [];
    const segments = { '0-500': 0, '500-2000': 0, '2000-10000': 0, '10000+': 0 };
    for (const r of lifetimeSpend) {
      const amt = Number(r._sum.totalAmount || 0);
      if      (amt < 500)   segments['0-500']++;
      else if (amt < 2000)  segments['500-2000']++;
      else if (amt < 10000) segments['2000-10000']++;
      else                  segments['10000+']++;
    }

    return {
      topCustomers: Array.from(map.values())
        .map((c) => ({
          id: c.id, name: c.name, phone: c.phone,
          orders: c.orders, spend: round2(c.spend),
          avgOrderValue: round2(c.spend / c.orders),
        }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 20),
      totalUniqueCustomers: ids.length,
      newCount, repeatCount,
      segments,
    };
  }

  /**
   * Discount + reward + coupon utilization for the period. Tells the
   * operator how much money went out the door as concessions.
   */
  async getDiscountUtilization(outletId: string, from: Date, to: Date) {
    const [orderAgg, couponUsages, rewardRedeems] = await Promise.all([
      this.prisma.order.aggregate({
        where: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } },
        _sum: { discountAmount: true, totalAmount: true },
        _count: { id: true },
      }),
      // Per-coupon breakdown for the period.
      this.prisma.couponUsage.findMany({
        where: { order: { outletId, status: 'SERVED', createdAt: { gte: from, lte: to } } },
        select: {
          discountAmount: true,
          coupon: { select: { code: true, name: true } },
        },
      }),
      // Reward redemptions matched to the same orders.
      this.prisma.rewardTransaction.findMany({
        where: {
          type: 'REDEEM',
          outletId,
          createdAt: { gte: from, lte: to },
        },
        select: { points: true, amountValue: true },
      }),
    ]);

    // Aggregate coupons by code.
    const couponMap = new Map<string, { code: string; name: string; count: number; amount: number }>();
    for (const u of couponUsages) {
      const code = u.coupon?.code ?? 'UNKNOWN';
      const row = couponMap.get(code) ?? {
        code,
        name: u.coupon?.name ?? code,
        count: 0,
        amount: 0,
      };
      row.count += 1;
      row.amount += Number(u.discountAmount);
      couponMap.set(code, row);
    }
    const couponTotal  = Array.from(couponMap.values()).reduce((s, r) => s + r.amount, 0);
    const rewardTotal  = rewardRedeems.reduce((s, r) => s + Number(r.amountValue ?? 0), 0);
    const rewardPoints = rewardRedeems.reduce((s, r) => s + Math.abs(r.points), 0);

    const totalDiscount = Number(orderAgg._sum.discountAmount || 0);
    // Auto-discount (bill / category / item-level) is the leftover.
    const autoDiscount = Math.max(0, totalDiscount - couponTotal - rewardTotal);

    return {
      totals: {
        servedOrders: orderAgg._count.id,
        servedRevenue: Number(orderAgg._sum.totalAmount || 0),
        totalDiscount: round2(totalDiscount),
        couponDiscount: round2(couponTotal),
        rewardDiscount: round2(rewardTotal),
        rewardPoints,
        autoDiscount: round2(autoDiscount),
        discountPctOfRevenue:
          orderAgg._sum.totalAmount && Number(orderAgg._sum.totalAmount) > 0
            ? round2((totalDiscount / Number(orderAgg._sum.totalAmount)) * 100)
            : 0,
      },
      coupons: Array.from(couponMap.values())
        .map((c) => ({ ...c, amount: round2(c.amount) }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  async getPlatformHourly(date: Date) {
    const start = dayjs(date).startOf('day').toDate();
    const end   = dayjs(date).endOf('day').toDate();

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalAmount: true },
    });

    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h, orders: 0, revenue: 0,
    }));
    orders.forEach(o => {
      const h = dayjs(o.createdAt).hour();
      hourly[h].orders++;
      hourly[h].revenue += Number(o.totalAmount);
    });
    return hourly;
  }
}
