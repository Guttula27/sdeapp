import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

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

    // Upsert the user by phone — fill name only if it wasn't set before
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: existing.name ? {} : { name },
          select: { id: true, name: true, phone: true, email: true },
        })
      : await this.prisma.user.create({
          data: { phone, name, status: 'ACTIVE' },
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
