import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMode,
  PaymentStatus,
  Prisma,
  SplitShareStatus,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';

export interface SplitShareInput {
  amount: number;
  customerName?: string;
  customerPhone: string;
}

@Injectable()
export class SplitBillsService {
  constructor(
    private prisma: PrismaService,
    private dispatcher: LifecycleDispatcherService,
  ) {}

  // ─── Operator actions ────────────────────────────────────

  /**
   * Creates N shares against a parent order. Validates:
   *   • order exists, is not in a terminal/refund state
   *   • sum of share amounts <= order's outstanding balance
   *     (under-allocation is allowed — operator can cover the rest
   *      separately as a CASH payment from the regular Pay flow)
   *   • each share has a phone
   *
   * On success: SplitShare rows persisted, Order.splitTotalShares
   * bumped (additive — re-splitting an order with new shares is
   * supported), per-share WhatsApp dispatched via the lifecycle
   * dispatcher. Diner identity (customerId) stays null until the
   * diner authenticates in the customer PWA via OTP.
   */
  async createSplit(
    outletId: string,
    orderId: string,
    shares: SplitShareInput[],
    createdById: string,
  ) {
    if (!shares?.length) {
      throw new BadRequestException('At least one share is required');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, outletId },
      include: {
        outlet: { select: { id: true, name: true } },
        payments: {
          where: { status: PaymentStatus.SUCCESS, isRefund: false },
          select: { amount: true },
        },
        splitShares: {
          where: { status: { notIn: [SplitShareStatus.CANCELLED, SplitShareStatus.EXPIRED] } },
          select: { amount: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found on this outlet');

    const terminal = ['CANCELLED', 'RESOLVED', 'REFUND_COMPLETE'] as const;
    if ((terminal as readonly string[]).includes(order.status)) {
      throw new BadRequestException(`Order is in ${order.status} — cannot split-bill`);
    }

    // Outstanding = totalAmount - paid - currently-active share commitments.
    // Active shares (PENDING/SENT/VIEWED/PAID) are subtracted because the
    // operator may have already created some shares and is now adding more.
    const total = new Prisma.Decimal(order.totalAmount);
    const paidSum = order.payments.reduce(
      (s, p) => s.plus(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );
    const sharedSum = order.splitShares.reduce(
      (s, p) => s.plus(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );
    const outstanding = total.minus(paidSum).minus(sharedSum);

    let incoming = new Prisma.Decimal(0);
    for (const s of shares) {
      if (!s.customerPhone?.trim()) {
        throw new BadRequestException('Every share requires a customerPhone');
      }
      const amt = new Prisma.Decimal(s.amount);
      if (amt.lte(0)) {
        throw new BadRequestException(`Share amount must be > 0 (got ${s.amount})`);
      }
      incoming = incoming.plus(amt);
    }
    // Half-cent tolerance for rounding splits (e.g. ₹100 / 3 = 33.33 × 3).
    if (incoming.gt(outstanding.plus(0.005))) {
      throw new BadRequestException(
        `Shares total ₹${incoming.toFixed(2)} exceeds outstanding ₹${outstanding.toFixed(2)}`,
      );
    }

    // Materialise + dispatch in one transaction so the Order counters
    // reflect what was actually persisted.
    const created = await this.prisma.$transaction(async (tx) => {
      const rows: Array<Awaited<ReturnType<typeof tx.splitShare.create>>> = [];
      for (const s of shares) {
        const row = await tx.splitShare.create({
          data: {
            orderId,
            amount: new Prisma.Decimal(s.amount),
            customerName: s.customerName?.trim() || null,
            customerPhone: s.customerPhone.trim(),
            createdById,
          },
        });
        rows.push(row);
      }
      await tx.order.update({
        where: { id: orderId },
        data: { splitTotalShares: { increment: rows.length } },
      });
      return rows;
    });

    // Fire WhatsApp per share. Best-effort — a failed dispatch leaves
    // the share in PENDING so the operator can hit Resend.
    const shareCount = created.length + order.splitShares.length;
    for (const row of created) {
      void this.dispatchShareDue(
        row.id,
        order.id,
        order.outlet?.name ?? 'Outlet',
        order.orderNumber,
        order.outletId,
        Number(order.totalAmount),
        shareCount,
        row,
      );
    }

    return this.getShareList(orderId);
  }

  /**
   * Resends the WhatsApp for a share — operator clicks "Resend" on
   * the per-share row when the diner hasn't acted.
   */
  async resendShare(shareId: string, _userId: string) {
    const share = await this.shareWithContext(shareId);
    if (share.status === SplitShareStatus.PAID || share.status === SplitShareStatus.CANCELLED) {
      throw new BadRequestException(`Share is ${share.status} — nothing to resend`);
    }
    await this.dispatchShareDue(
      share.id,
      share.orderId,
      share.order.outlet?.name ?? 'Outlet',
      share.order.orderNumber,
      share.order.outletId,
      Number(share.order.totalAmount),
      share.order.splitTotalShares,
      share,
    );
    return share;
  }

  async cancelShare(shareId: string, userId: string, reason?: string) {
    const share = await this.shareWithContext(shareId);
    if (share.status === SplitShareStatus.PAID) {
      throw new BadRequestException('Share is already paid — refund instead of cancel');
    }
    if (share.status === SplitShareStatus.CANCELLED) return share;
    return this.prisma.splitShare.update({
      where: { id: shareId },
      data: {
        status: SplitShareStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: share.notes
          ? `${share.notes}\nCancelled by ${userId}${reason ? `: ${reason}` : ''}`
          : `Cancelled by ${userId}${reason ? `: ${reason}` : ''}`,
      },
    });
  }

  /**
   * "Mark cash" — operator collects cash from the diner directly
   * (their phone is dead, no UPI, etc). Creates a CASH Payment row
   * against the order tagged to the share, settles the share, and
   * runs the same counter-bump path as a real customer payment.
   */
  async markShareCash(shareId: string, userId: string, notes?: string) {
    const share = await this.shareWithContext(shareId);
    if (share.status === SplitShareStatus.PAID) {
      throw new BadRequestException('Share is already paid');
    }
    if (share.status === SplitShareStatus.CANCELLED) {
      throw new BadRequestException('Cancelled share cannot be marked paid — recreate the share instead');
    }
    // Find the operator's active cashier shift (Sprint 1) so the
    // CASH counts on their drawer reconciliation. Null is fine —
    // payment is recorded outside any shift.
    const drawer = await this.prisma.cashierShift.findFirst({
      where: { outletId: share.order.outletId, cashierId: userId, status: 'ACTIVE' },
      select: { id: true },
    });
    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          orderId: share.orderId,
          amount: share.amount,
          mode: PaymentMode.CASH,
          status: PaymentStatus.SUCCESS,
          isRefund: false,
          cashierShiftId: drawer?.id ?? null,
        },
      });
      await this.applyShareSettled(tx, share, p.id, notes ?? 'Cash collected by operator');
      return p;
    });
    return payment;
  }

  // ─── Customer-side reads ─────────────────────────────────

  /**
   * Customer PWA fetches a share by id. The caller (auth'd User)
   * must be the share's customer — either already resolved on
   * customerId, or matching by phone. First successful auth'd read
   * also persists customerId and marks the share VIEWED.
   */
  async getShareForCustomer(shareId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true },
    });
    if (!user) throw new NotFoundException('Customer not found');
    const share = await this.prisma.splitShare.findUnique({
      where: { id: shareId },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, totalAmount: true,
            splitTotalShares: true, splitPaidShares: true, splitPaidAmount: true,
            outlet: { select: { id: true, name: true, logoUrl: true } },
            items: {
              include: {
                item: { select: { name: true } },
                variant: { select: { name: true } },
              },
            },
            payments: { where: { isRefund: false } },
          },
        },
      },
    });
    if (!share) throw new NotFoundException('Share not found');

    const matches = share.customerId === user.id || share.customerPhone === user.phone;
    if (!matches) throw new ForbiddenException('This share is for a different customer');

    // Stamp the link + VIEWED on first auth'd read.
    const patch: Prisma.SplitShareUpdateInput = {};
    if (!share.customerId) patch.customer = { connect: { id: user.id } };
    if (share.status === SplitShareStatus.PENDING || share.status === SplitShareStatus.SENT) {
      patch.status = SplitShareStatus.VIEWED;
      patch.viewedAt = new Date();
    }
    if (Object.keys(patch).length > 0) {
      await this.prisma.splitShare.update({ where: { id: shareId }, data: patch });
    }
    return share;
  }

  /** Customer PWA "My Bills" list — all the shares assigned to this user's phone. */
  async listMySharesForCustomer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return this.prisma.splitShare.findMany({
      where: {
        OR: [
          { customerId: user.id },
          { customerPhone: user.phone },
        ],
      },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, totalAmount: true,
            outlet: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Read helpers for operators ──────────────────────────

  getShareList(orderId: string) {
    return this.prisma.splitShare.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Hook called from PaymentsService.confirmPayment ─────

  /**
   * Called from PaymentsService when a Payment confirms with
   * splitShareId set. Updates the share row + bumps Order counters
   * + fires SPLIT_ALL_PAID when the final share lands.
   *
   * Runs in the caller's transaction so race conditions between
   * webhook-driven payment confirmation and operator mark-cash are
   * resolved by the DB's @@unique on Payment.splitShareId.
   */
  async applyShareSettled(
    tx: Prisma.TransactionClient,
    share: { id: string; orderId: string; amount: Prisma.Decimal | string | number },
    paymentId: string,
    notes?: string,
  ) {
    const amount = new Prisma.Decimal(share.amount);
    await tx.splitShare.update({
      where: { id: share.id },
      data: {
        status: SplitShareStatus.PAID,
        paidAt: new Date(),
        paymentId,
        ...(notes ? { notes } : {}),
      },
    });
    const updated = await tx.order.update({
      where: { id: share.orderId },
      data: {
        splitPaidShares: { increment: 1 },
        splitPaidAmount: { increment: amount },
      },
      select: { splitPaidShares: true, splitTotalShares: true, totalAmount: true, orderNumber: true, outletId: true },
    });
    // Last share — fire SPLIT_ALL_PAID to every participant.
    if (updated.splitPaidShares >= updated.splitTotalShares && updated.splitTotalShares > 0) {
      void this.fireAllPaid(share.orderId);
    }
  }

  private async fireAllPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        outlet: { select: { id: true, name: true, businessId: true } },
        splitShares: { where: { status: SplitShareStatus.PAID } },
      },
    });
    if (!order) return;
    for (const share of order.splitShares) {
      if (!share.customerId) continue; // un-linked diner; can't push without User
      try {
        await this.dispatcher.fire('SPLIT_ALL_PAID', {
          customerId: share.customerId,
          customerName: share.customerName,
          customerPhone: share.customerPhone,
          outletId: order.outletId,
          outletName: order.outlet?.name ?? null,
          businessId: order.outlet?.businessId ?? null,
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderTotal: Number(order.totalAmount),
        });
      } catch { /* best-effort */ }
    }
  }

  // ─── Internal helpers ────────────────────────────────────

  private async shareWithContext(shareId: string) {
    const share = await this.prisma.splitShare.findUnique({
      where: { id: shareId },
      include: {
        order: {
          select: {
            id: true, orderNumber: true, outletId: true, totalAmount: true,
            splitTotalShares: true,
            outlet: { select: { id: true, name: true, businessId: true } },
          },
        },
      },
    });
    if (!share) throw new NotFoundException('Share not found');
    return share;
  }

  private async dispatchShareDue(
    shareId: string,
    orderId: string,
    outletName: string,
    orderNumber: string,
    outletId: string,
    orderTotal: number,
    shareCount: number,
    share: { customerName: string | null; customerPhone: string; amount: Prisma.Decimal | string | number; customerId: string | null },
  ) {
    // Deep-link target — customer PWA URL. The CUSTOMER_URL env var
    // is the same one used by CORS in main.ts; using it here keeps the
    // hosted link consistent with where the customer PWA actually
    // lives in this environment.
    const baseUrl = (process.env.CUSTOMER_URL || '').replace(/\/$/, '');
    const shareLink = `${baseUrl}/bills/${shareId}`;
    try {
      // dispatcher.fire requires customerId. When the diner hasn't
      // got a User row yet we mint one from the phone so we can fan
      // out the alert + persist a CustomerAlert row for them.
      // First-tap auth flow will reconcile the same User on login.
      const customerId = share.customerId ?? (await this.ensureUserByPhone(share.customerPhone, share.customerName));
      await this.dispatcher.fire('SPLIT_SHARE_DUE', {
        customerId,
        customerName: share.customerName,
        customerPhone: share.customerPhone,
        outletId,
        outletName,
        orderId,
        orderNumber,
        shareAmount: Number(share.amount),
        orderTotal,
        shareCount,
        shareLink,
      });
      // Mark the share SENT now that WhatsApp went out.
      await this.prisma.splitShare.update({
        where: { id: shareId },
        data: {
          status: SplitShareStatus.SENT,
          sentAt: new Date(),
          ...(share.customerId ? {} : { customer: { connect: { id: customerId } } }),
        },
      });
    } catch (e: any) {
      // Don't bubble — the operator already has the option to Resend
      // from the OrdersPage detail when the dispatch genuinely fails.
      // eslint-disable-next-line no-console
      console.warn(`[split-bills] SPLIT_SHARE_DUE dispatch failed for ${shareId}: ${e?.message}`);
    }
  }

  /**
   * Looks up or creates a minimal User by phone. Used when a share is
   * dispatched to a phone that hasn't authenticated yet — we still
   * want a User row so the alerts feed + the future OTP login can
   * land on a consistent identity.
   */
  private async ensureUserByPhone(phone: string, name: string | null): Promise<string> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) return existing.id;
    const created = await this.prisma.user.create({
      data: { phone, name: name ?? 'Guest', status: 'ACTIVE' },
    });
    return created.id;
  }
}
