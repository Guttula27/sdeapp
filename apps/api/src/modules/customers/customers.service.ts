import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { EncryptionService } from '../../config/crypto/encryption.service';
import { UserLookupService } from '../../config/crypto/user-lookup.service';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private userLookup: UserLookupService,
  ) {}

  async list(outletId: string) {
    const [grouped, manualLinks] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { outletId, customerId: { not: null } },
        _count: { id: true },
        _sum: { totalAmount: true },
        _max: { createdAt: true },
      }),
      this.prisma.outletCustomer.findMany({ where: { outletId }, select: { userId: true } }),
    ]);

    const customerIds = new Set<string>();
    grouped.forEach(g => { if (g.customerId) customerIds.add(g.customerId); });
    manualLinks.forEach(l => customerIds.add(l.userId));
    if (customerIds.size === 0) return [];

    const idsArr = [...customerIds];
    const [users, assignments] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, name: true, phone: true, email: true },
      }),
      this.prisma.customerTagAssignment.findMany({
        where: { outletId, userId: { in: idsArr } },
        include: { customerTag: true },
      }),
    ]);

    const userMap = new Map(users.map(u => [u.id, u]));
    const tagMap = new Map(assignments.map(a => [a.userId, a.customerTag]));
    const orderMap = new Map(grouped.filter(g => g.customerId).map(g => [g.customerId!, g]));

    return idsArr.map(uid => {
      const g = orderMap.get(uid);
      return {
        id: uid,
        name:        userMap.get(uid)?.name || 'Unknown',
        phone:       userMap.get(uid)?.phone || '',
        email:       userMap.get(uid)?.email || null,
        orderCount:  g?._count.id ?? 0,
        totalSpend:  Number(g?._sum.totalAmount || 0),
        lastOrderAt: g?._max.createdAt ?? null,
        tag:         tagMap.get(uid) || null,
      };
    }).sort((a, b) => {
      // Customers with orders first, by most recent; then no-order customers by name
      const ta = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : -1;
      const tb = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : -1;
      if (ta !== tb) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }

  async addCustomer(outletId: string, data: { name?: string; phone: string }) {
    const phone = data.phone?.trim();
    if (!phone) throw new BadRequestException('Phone is required');
    const name = data.name?.trim() || `Customer (${phone})`;

    // Upsert the user by phone — fill name only if it wasn't set before.
    // findByPhone wraps the dual-read (hash → legacy plaintext fallback).
    const existing = await this.userLookup.findByPhone(phone);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: existing.name ? {} : { name },
          select: { id: true, name: true, phone: true, email: true },
        })
      : await this.prisma.user.create({
          data: { ...this.encryption.buildPhoneFields(phone), name, status: 'ACTIVE' },
          select: { id: true, name: true, phone: true, email: true },
        });

    await this.prisma.outletCustomer.upsert({
      where: { outletId_userId: { outletId, userId: user.id } },
      create: { outletId, userId: user.id },
      update: {},
    });

    return user;
  }

  /** Orders this customer has placed at this outlet, newest first. */
  async listOrders(outletId: string, userId: string) {
    return this.prisma.order.findMany({
      where: { outletId, customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { item: true, variant: true } },
        table: true,
        payments: true,
      },
    });
  }

  /**
   * Customer-recognition surface: per-outlet aggregate stats for a
   * known customer, plus their most-frequent items. Powers the small
   * "Naren · 14th visit · usual: Manchurian + Coke · ~₹420/visit" pill
   * on order detail. Cheap enough to compute on every detail open —
   * the queries are all indexed (customerId, outletId) and capped to
   * the last 90 days so reads stay tight as history grows.
   */
  async insights(outletId: string, userId: string) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true },
    });
    if (!user) throw new NotFoundException('Customer not found');

    // Aggregates over the customer's non-cancelled orders at this
    // outlet. Lifetime totals (no time bound) so the "14th visit"
    // counter reflects history, not just the 90-day rolling window.
    const lifetime = await this.prisma.order.aggregate({
      where: {
        outletId,
        customerId: userId,
        status: { notIn: ['CANCELLED'] },
      },
      _count: true,
      _sum: { totalAmount: true },
      _max: { createdAt: true },
    });

    // Favourite items — top 3 by quantity ordered in the last 90 days.
    // 90-day window keeps the suggestion fresh (regulars whose taste
    // shifted three years ago don't anchor the pill).
    const topItems = await this.prisma.orderItem.groupBy({
      by: ['itemId'],
      where: {
        order: {
          outletId,
          customerId: userId,
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED'] },
        },
        status: { notIn: ['CANCELLED'] },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 3,
    });
    const itemMeta = topItems.length
      ? await this.prisma.item.findMany({
          where: { id: { in: topItems.map((g) => g.itemId) } },
          select: { id: true, name: true },
        })
      : [];
    const metaById = new Map(itemMeta.map((i) => [i.id, i.name]));
    const favourites = topItems.map((g) => ({
      itemId: g.itemId,
      name: metaById.get(g.itemId) ?? 'Item',
      quantity: g._sum.quantity ?? 0,
    }));

    // Most-used payment mode across this customer's orders at this
    // outlet (SUCCESS only). Single-mode customers see "Always
    // pays UPI" — useful nudge for the staff to default the right
    // tab.
    const modesAgg = await this.prisma.payment.groupBy({
      by: ['mode'],
      where: {
        order: { outletId, customerId: userId },
        status: 'SUCCESS',
        isRefund: false,
      },
      _count: true,
      orderBy: { _count: { mode: 'desc' } },
      take: 1,
    });
    const preferredMode = modesAgg[0]?.mode ?? null;

    const visits = lifetime._count ?? 0;
    const spend = Number(lifetime._sum.totalAmount ?? 0);
    return {
      customer: { id: user.id, name: user.name, phone: user.phone },
      visits,
      lifetimeSpend: spend,
      avgTicket: visits > 0 ? spend / visits : 0,
      lastVisitAt: lifetime._max.createdAt ?? null,
      favourites,
      preferredMode,
    };
  }

  async setTag(outletId: string, userId: string, customerTagId: string | null) {
    if (customerTagId === null) {
      await this.prisma.customerTagAssignment.deleteMany({
        where: { outletId, userId },
      });
      return { success: true, tag: null };
    }
    const tag = await this.prisma.customerTag.findUnique({
      where: { id: customerTagId },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    if (tag.outletId !== outletId) {
      throw new BadRequestException('Tag does not belong to this outlet');
    }
    const assignment = await this.prisma.customerTagAssignment.upsert({
      where: { userId_outletId: { userId, outletId } },
      create: { userId, outletId, customerTagId },
      update: { customerTagId },
      include: { customerTag: true },
    });
    return { success: true, tag: assignment.customerTag };
  }
}
