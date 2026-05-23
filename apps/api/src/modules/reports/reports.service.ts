import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import * as dayjs from 'dayjs';

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
