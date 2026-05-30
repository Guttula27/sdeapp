import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
  ) {}

  private async hydrateOrders(orders: any[], lang: string | null | undefined) {
    if (!lang || orders.length === 0) return;
    const items = orders.flatMap((o) => (o.items || []).map((oi: any) => oi.item).filter(Boolean));
    const variants = orders.flatMap((o) =>
      (o.items || []).map((oi: any) => oi.variant).filter(Boolean),
    );
    const outlets = orders.map((o) => o.outlet).filter(Boolean);
    await Promise.all([
      this.translations.hydrate('Item', items, ['name', 'description', 'shortDescription'], lang),
      this.translations.hydrate('Variant', variants, ['name'], lang),
      this.translations.hydrate('Outlet', outlets, ['name', 'description', 'address'], lang),
    ]);
  }

  async create(data: { name: string; phone: string; email?: string; password: string; roleId?: string; businessId?: string; outletId?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new ConflictException('Phone already registered');
    const { password, ...rest } = data;
    const passwordHash = await bcrypt.hash(password, 12);
    return this.prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, name: true, phone: true, email: true, status: true, role: { select: { id: true, name: true } } },
    });
  }

  async findAll(businessId?: string, outletId?: string, page?: number, limit?: number) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const where = { ...(businessId && { businessId }), ...(outletId && { outletId }) };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, phone: true, email: true, status: true, createdAt: true, role: { select: { id: true, name: true } }, outlet: { select: { id: true, name: true } } },
        skip: (p - 1) * l,
        take: l,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page: p, limit: l };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, phone: true, email: true, status: true,
        role: { include: { responsibilities: { include: { responsibility: true } } } },
        business: true, outlet: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(
    id: string,
    data: {
      name?: string; email?: string; phone?: string;
      roleId?: string; outletId?: string;
      preferredUpiApp?: string | null;
      profileImageUrl?: string | null;
      alertRingtone?: string | null;
      alertVolume?: number | null;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, phone: true, email: true, status: true,
        preferredUpiApp: true, profileImageUrl: true, alertRingtone: true, alertVolume: true,
        updatedAt: true,
      },
    });
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.passwordHash) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new ConflictException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: false },
    });
    return { message: 'Password updated' };
  }

  async getOrderHistory(userId: string, page?: number, limit?: number, lang?: string | null) {
    const p = Number(page) || 1;
    const l = Number(limit) || 10;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: userId },
        include: {
          items: {
            include: {
              item: { select: { id: true, name: true, imageUrl: true } },
              variant: { select: { id: true, name: true } },
              // Include the review (id + rating) so the home-page prompt can
              // tell which items still need rating without an extra round trip.
              review: { select: { id: true, rating: true } },
            },
          },
          outlet: { select: { id: true, name: true, logoUrl: true } },
          payments: { select: { id: true, mode: true, status: true, amount: true } },
          // Cluster context — populated only for child orders of a cluster
          // checkout. HomePage uses this to group sibling orders under a
          // single "Food court order" header.
          clusterOrder: {
            select: {
              id: true,
              clusterOrderNumber: true,
              paymentStatus: true,
              clusterBusiness: { select: { id: true, name: true, logoUrl: true, publicCode: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      this.prisma.order.count({ where: { customerId: userId } }),
    ]);

    await this.hydrateOrders(orders as any[], lang);

    const stats = await this.prisma.order.aggregate({
      where: { customerId: userId, status: 'SERVED' },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    return {
      orders,
      total,
      page: p,
      limit: l,
      stats: {
        totalOrders: total,
        completedOrders: stats._count.id,
        totalSpent: stats._sum.totalAmount || 0,
      },
    };
  }

  async getCustomerStats(userId: string, from?: Date, to?: Date, lang?: string | null) {
    const end = to || new Date();
    const start = from || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: { customerId: userId, createdAt: { gte: start, lte: end } },
      select: {
        id: true, orderNumber: true, tokenNumber: true, status: true,
        totalAmount: true, createdAt: true, outletId: true,
        outlet: { select: { id: true, name: true, logoUrl: true } },
        items: { select: { quantity: true, item: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.hydrateOrders(orders as any[], lang);

    // Daily aggregation
    const daily: Record<string, { date: string; orders: number; value: number }> = {};
    const hourly: { hour: number; orders: number; value: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, value: 0 }));
    let totalValue = 0;
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      if (!daily[day]) daily[day] = { date: day, orders: 0, value: 0 };
      daily[day].orders++;
      daily[day].value += Number(o.totalAmount);
      const h = o.createdAt.getHours();
      hourly[h].orders++;
      hourly[h].value += Number(o.totalAmount);
      totalValue += Number(o.totalAmount);
    }

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totalOrders: orders.length,
      totalValue,
      daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
      hourly,
      orders,
    };
  }

  // ─── Promotions visible to this customer ──────────────────
  // Aggregates the customer's "known" outlets — anywhere they've ordered or
  // been explicitly linked via OutletCustomer — and pulls each outlet's
  // active coupons (ALL or this customer in SPECIFIC), auto-applying
  // discounts, and offers. Grouped by outlet so the customer UI can render
  // a per-outlet card list without further client-side joining.
  async getCustomerPromotions(userId: string) {
    const orderOutlets = await this.prisma.order.findMany({
      where: { customerId: userId },
      distinct: ['outletId'],
      select: { outletId: true },
    });
    const linkedOutlets = await this.prisma.outletCustomer.findMany({
      where: { userId },
      select: { outletId: true },
    });
    const outletIds = Array.from(new Set([
      ...orderOutlets.map((o) => o.outletId),
      ...linkedOutlets.map((o) => o.outletId),
    ]));
    if (outletIds.length === 0) return { outlets: [] };

    const outlets = await this.prisma.outlet.findMany({
      where: { id: { in: outletIds } },
      select: {
        id: true, name: true, logoUrl: true, primaryImageUrl: true,
        businessId: true,
        business: { select: { id: true, name: true, logoUrl: true } },
      },
    });

    const now = new Date();
    const isoDow = ((now.getDay() + 6) % 7) + 1;
    const minute = now.getHours() * 60 + now.getMinutes();

    const inScheduleNow = (row: any) => {
      if (row.validFrom && new Date(row.validFrom) > now) return false;
      if (row.validUntil && new Date(row.validUntil) < now) return false;
      if (row.daysOfWeek) {
        const days = String(row.daysOfWeek).split(',').map((s: string) => parseInt(s.trim(), 10));
        if (days.length && !days.includes(isoDow)) return false;
      }
      if (row.startMinute != null && row.endMinute != null) {
        if (minute < row.startMinute || minute > row.endMinute) return false;
      }
      return true;
    };

    // One bulk query per resource, scoped to the customer's businesses. We
    // filter further in-memory by outlet (the businessId set is usually
    // small for a given customer — handful of outlets across a few
    // businesses — so an in-memory walk is cheap and the SQL stays simple).
    const businessIds = Array.from(new Set(outlets.map((o) => o.businessId)));

    const [allCoupons, allDiscounts, allOffers] = await Promise.all([
      this.prisma.coupon.findMany({
        where: {
          businessId: { in: businessIds },
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
        include: { targetCustomers: { select: { userId: true } } },
      }),
      this.prisma.discount.findMany({
        where: {
          businessId: { in: businessIds },
          isActive: true,
          isManualOnly: false,
        },
        include: {
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          item: { select: { id: true, name: true } },
        },
      }),
      this.prisma.offer.findMany({
        where: {
          businessId: { in: businessIds },
          isActive: true,
        },
        include: {
          buyItem: { select: { id: true, name: true } },
          getItem: { select: { id: true, name: true } },
        },
      }),
    ]);

    const grouped = outlets.map((o) => {
      const couponMatch = (c: any) =>
        c.businessId === o.businessId &&
        (c.outletId === null || c.outletId === o.id) &&
        (c.maxTotalUses == null || c.usesCount < c.maxTotalUses) &&
        (c.targetType === 'ALL' || c.targetCustomers.some((t: any) => t.userId === userId));
      const scopeMatch = (row: any) =>
        row.businessId === o.businessId &&
        (row.outletId === null || row.outletId === o.id) &&
        inScheduleNow(row);

      return {
        outlet: {
          id: o.id,
          name: o.name,
          logoUrl: o.logoUrl,
          businessName: o.business?.name,
        },
        coupons: allCoupons
          .filter(couponMatch)
          .map(({ targetCustomers, ...rest }) => rest),
        discounts: allDiscounts.filter(scopeMatch),
        offers: allOffers.filter(scopeMatch),
      };
    });

    // Sort: outlets with the most live promotions first so the customer's
    // dashboard surface lands on what matters.
    grouped.sort((a, b) => {
      const aN = a.coupons.length + a.discounts.length + a.offers.length;
      const bN = b.coupons.length + b.discounts.length + b.offers.length;
      return bN - aN;
    });

    return { outlets: grouped };
  }

  // ─── Favourites ──────────────────────────────────────────
  async addFavorite(userId: string, itemId: string) {
    return this.prisma.favorite.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId },
      update: {},
    });
  }

  async removeFavorite(userId: string, itemId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, itemId } });
    return { success: true };
  }

  async listFavorites(userId: string, lang?: string | null) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        item: {
          include: {
            variants: true,
            subcategory: { include: { category: { include: { outlet: { select: { id: true, name: true } } } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lang && favorites.length) {
      const items = favorites.map((f) => f.item).filter(Boolean);
      const variants = favorites.flatMap((f) => f.item?.variants ?? []);
      const subcategories = favorites.map((f) => f.item?.subcategory).filter(Boolean);
      const categories = favorites.map((f) => f.item?.subcategory?.category).filter(Boolean);
      const outlets = favorites.map((f) => f.item?.subcategory?.category?.outlet).filter(Boolean);
      await Promise.all([
        this.translations.hydrate('Item', items as any, ['name', 'description', 'shortDescription'], lang),
        this.translations.hydrate('Variant', variants as any, ['name'], lang),
        this.translations.hydrate('Subcategory', subcategories as any, ['name', 'description'], lang),
        this.translations.hydrate('Category', categories as any, ['name', 'description'], lang),
        this.translations.hydrate('Outlet', outlets as any, ['name'], lang),
      ]);
    }

    return favorites;
  }

  async setPreferredLanguage(userId: string, code: string) {
    if (!code) throw new ConflictException('Language code is required');
    const lang = await this.prisma.language.findUnique({ where: { code } });
    if (!lang || !lang.isEnabled) {
      throw new ConflictException('Language is not available');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: code },
      select: { id: true, preferredLanguage: true },
    });
  }

  async toggleStatus(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
    });
  }
}
