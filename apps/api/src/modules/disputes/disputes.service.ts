import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';

export type DisputeStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'CLOSED';

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
  ) {}

  /* ── Customer: raise a dispute ──────────────────────────── */
  async create(orderId: string, customerId: string | null, data: {
    description: string;
    claimAmount?: number;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { disputes: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Match the OrderStatus enum — there is no DELIVERED state. The
    // customer UI only exposes the dispute button on SERVED orders,
    // and the API enforces the same. RESOLVED is allowed too so a
    // closed dispute on the same order can be re-opened with a fresh
    // dispute (the duplicate-active check below still blocks back-to-
    // back open ones).
    if (!['SERVED', 'RESOLVED'].includes(order.status)) {
      throw new BadRequestException('Disputes can only be raised after the order is served');
    }

    if (order.disputes.some(d => !['CLOSED', 'RESOLVED'].includes(d.status))) {
      throw new BadRequestException('An active dispute already exists for this order');
    }

    // Allow if customer owns the order OR if no customerId (guest)
    if (customerId && order.customerId && order.customerId !== customerId) {
      throw new ForbiddenException('You can only dispute your own orders');
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId,
        description: data.description,
        claimAmount: data.claimAmount,
        status: 'OPEN',
      },
      include: { order: { select: { orderNumber: true, outletId: true, totalAmount: true } } },
    });

    // Fire-and-forget the translation upsert. The provider call can take
    // many seconds per language, and synchronous awaiting was blowing
    // past the customer's axios timeout — surfacing as a network failure
    // even though the dispute had been written to the DB. The follow-up
    // upsert lands asynchronously; the dispute renders in English until
    // it does. Same pattern menu import uses.
    void this.translations
      .upsertAll('Dispute', dispute.id, { description: dispute.description })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[disputes] translate Dispute/${dispute.id} failed`, err);
      });

    // Update order status to DISPUTED. changedBy is a User FK — for
    // anonymous customers (or system actions) it must be NULL, not a
    // literal string, otherwise the FK constraint rejects the insert.
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DISPUTED',
        statusHistory: { create: { status: 'DISPUTED', changedBy: customerId ?? null, notes: 'Dispute raised by customer' } },
      },
    });

    return dispute;
  }

  /* ── Customer: their disputes ───────────────────────────── */
  async findByCustomer(customerId: string, lang?: string | null) {
    const disputes = await this.prisma.dispute.findMany({
      where: { order: { customerId } },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, totalAmount: true, createdAt: true,
            outlet: { select: { id: true, name: true } },
            items: { take: 1, include: { item: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    await this.translations.hydrate('Dispute', disputes, ['description'], lang);
    return disputes;
  }

  /* ── Get single dispute ─────────────────────────────────── */
  async findOne(id: string, lang?: string | null) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: { include: { item: { select: { id: true, name: true } } } },
            outlet: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    await this.translations.hydrate('Dispute', dispute, ['description'], lang);
    return dispute;
  }

  /* ── Outlet: all disputes for an outlet ─────────────────── */
  async findByOutlet(outletId: string, status?: DisputeStatus, lang?: string | null) {
    const where = {
      order: { outletId },
      ...(status && { status }),
    };

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          order: {
            select: {
              id: true, orderNumber: true, totalAmount: true, createdAt: true,
              customer: { select: { id: true, name: true, phone: true } },
              items: { take: 2, include: { item: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    const stats = await this.prisma.dispute.groupBy({
      by: ['status'],
      where: { order: { outletId } },
      _count: { id: true },
    });

    await this.translations.hydrate('Dispute', disputes, ['description'], lang);
    return { disputes, total, stats };
  }

  /* ── Outlet: update dispute status/resolution ───────────── */
  async update(id: string, data: {
    status: DisputeStatus;
    resolution?: string;
    refundRequested?: boolean;
  }) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: { order: true } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    if (dispute.status === 'CLOSED') {
      throw new BadRequestException('Closed disputes cannot be updated');
    }

    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: data.status,
        resolution: data.resolution,
      },
      include: {
        order: { select: { id: true, orderNumber: true, outletId: true } },
      },
    });

    // When resolved or closed, sync the order status:
    //   refundRequested → FOR_REFUND (admin will later mark REFUND_COMPLETE)
    //   otherwise       → RESOLVED
    if (['RESOLVED', 'CLOSED'].includes(data.status)) {
      const orderStatus = data.refundRequested ? 'FOR_REFUND' : 'RESOLVED';
      await this.prisma.order.update({
        where: { id: dispute.orderId },
        data: {
          status: orderStatus,
          statusHistory: {
            create: {
              status: orderStatus,
              // changedBy is a User FK — leave null for system / outlet
              // actions to avoid FK violations. Audit can rely on notes.
              changedBy: null,
              notes: `Dispute ${data.status.toLowerCase()}: ${data.resolution || ''}`,
            },
          },
        },
      });
    }

    return updated;
  }

  /* ── Outlet: dispute stats ──────────────────────────────── */
  async getStats(outletId: string) {
    const [open, reviewing, resolved, closed] = await Promise.all([
      this.prisma.dispute.count({ where: { order: { outletId }, status: 'OPEN' } }),
      this.prisma.dispute.count({ where: { order: { outletId }, status: 'REVIEWING' } }),
      this.prisma.dispute.count({ where: { order: { outletId }, status: 'RESOLVED' } }),
      this.prisma.dispute.count({ where: { order: { outletId }, status: 'CLOSED' } }),
    ]);

    const claimSum = await this.prisma.dispute.aggregate({
      where: { order: { outletId }, status: { in: ['OPEN', 'REVIEWING'] } },
      _sum: { claimAmount: true },
    });

    return {
      open, reviewing, resolved, closed,
      total: open + reviewing + resolved + closed,
      pendingClaimAmount: claimSum._sum.claimAmount || 0,
    };
  }
}
