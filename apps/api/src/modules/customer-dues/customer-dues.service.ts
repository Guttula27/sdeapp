import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';

/**
 * Customer dues (pay-later) ledger.
 *
 * Double-entry: DEBIT rows record charges (orders placed as pay-later),
 * CREDIT rows record payments. Running balance = SUM(DEBIT) - SUM(CREDIT)
 * over rows where voidedAt IS NULL.
 *
 * Settlements are not order-pegged — a single payment can clear multiple
 * earlier orders. The link from settlement → ledger is via the parent
 * CustomerDuesSettlement; the link from order → ledger is via the
 * DEBIT row's orderId field, used only by the void hook when an order
 * is cancelled or refunded.
 */
@Injectable()
export class CustomerDuesService {
  constructor(private prisma: PrismaService) {}

  // ─── Read paths ─────────────────────────────────────────────────

  /** Outstanding balance for one customer at one outlet. */
  async getBalance(userId: string, outletId: string): Promise<number> {
    const agg = await this.prisma.customerDuesLedger.groupBy({
      by: ['kind'],
      where: { userId, outletId, voidedAt: null },
      _sum: { amount: true },
    });
    let debit = 0;
    let credit = 0;
    for (const row of agg) {
      const n = row._sum.amount ? Number(row._sum.amount) : 0;
      if (row.kind === 'DEBIT') debit = n;
      else if (row.kind === 'CREDIT') credit = n;
    }
    return round2(debit - credit);
  }

  /**
   * Receivables view for the admin "Dues > Receivable" tab. Returns one
   * row per (customer × outlet) with current outstanding balance and
   * three period-bounded aggregates so the admin can answer both
   * "what's still owed" and "what got collected in March".
   *
   *   - currentBalance: running balance NOW (voidedAt IS NULL).
   *   - ordersInRangeTotal: DEBIT sum where the order was placed in
   *     `[ordersFrom, ordersTo]` — what billed during that window.
   *   - settlementsInRangeTotal: CREDIT sum where the settlement
   *     happened in `[settlementsFrom, settlementsTo]` — what got
   *     collected during that window.
   *
   * Returns an array sorted by currentBalance descending so the biggest
   * unpaid customers float to the top. Limited to customers that have
   * ANY ledger activity at the outlet — clean accounts stay off the
   * list to avoid a noisy table.
   */
  async listReceivables(
    outletId: string,
    opts: {
      ordersFrom?: Date;
      ordersTo?: Date;
      settlementsFrom?: Date;
      settlementsTo?: Date;
    } = {},
  ) {
    // Customers with any activity at this outlet — the universe of
    // rows the receivable view considers.
    const activity = await this.prisma.customerDuesLedger.findMany({
      where: { outletId },
      select: { userId: true },
      distinct: ['userId'],
    });
    if (activity.length === 0) return [];

    const userIds = activity.map((a) => a.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        phone: true,
        customerTagAssignments: {
          where: { outletId },
          include: { customerTag: { select: { id: true, name: true, color: true, allowPayLater: true, maxDueAmount: true } } },
        },
      },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    // Build the three sums per (userId, kind) in a single pass each.
    // Period filters short-circuit when both bounds are undefined —
    // the caller wanted "all time" for that column.
    const where = (kindFilter: Prisma.CustomerDuesLedgerWhereInput): Prisma.CustomerDuesLedgerWhereInput => ({
      outletId,
      userId: { in: userIds },
      voidedAt: null,
      ...kindFilter,
    });

    const [currentDebitAgg, currentCreditAgg, ordersInRangeAgg, settlementsInRangeAgg] = await Promise.all([
      this.prisma.customerDuesLedger.groupBy({
        by: ['userId'],
        where: where({ kind: 'DEBIT' }),
        _sum: { amount: true },
      }),
      this.prisma.customerDuesLedger.groupBy({
        by: ['userId'],
        where: where({ kind: 'CREDIT' }),
        _sum: { amount: true },
      }),
      opts.ordersFrom || opts.ordersTo
        ? this.prisma.customerDuesLedger.groupBy({
            by: ['userId'],
            where: where({
              kind: 'DEBIT',
              createdAt: {
                ...(opts.ordersFrom ? { gte: opts.ordersFrom } : {}),
                ...(opts.ordersTo ? { lte: opts.ordersTo } : {}),
              },
            }),
            _sum: { amount: true },
          })
        : Promise.resolve([] as Array<{ userId: string; _sum: { amount: Prisma.Decimal | null } }>),
      opts.settlementsFrom || opts.settlementsTo
        ? this.prisma.customerDuesLedger.groupBy({
            by: ['userId'],
            where: where({
              kind: 'CREDIT',
              createdAt: {
                ...(opts.settlementsFrom ? { gte: opts.settlementsFrom } : {}),
                ...(opts.settlementsTo ? { lte: opts.settlementsTo } : {}),
              },
            }),
            _sum: { amount: true },
          })
        : Promise.resolve([] as Array<{ userId: string; _sum: { amount: Prisma.Decimal | null } }>),
    ]);

    const debitByUser = new Map(currentDebitAgg.map((r) => [r.userId, Number(r._sum.amount ?? 0)]));
    const creditByUser = new Map(currentCreditAgg.map((r) => [r.userId, Number(r._sum.amount ?? 0)]));
    const ordersInRangeByUser = new Map(ordersInRangeAgg.map((r) => [r.userId, Number(r._sum.amount ?? 0)]));
    const settlementsInRangeByUser = new Map(settlementsInRangeAgg.map((r) => [r.userId, Number(r._sum.amount ?? 0)]));

    const rows = userIds.map((uid) => {
      const u = userById.get(uid);
      const debit = debitByUser.get(uid) ?? 0;
      const credit = creditByUser.get(uid) ?? 0;
      const tagRow = u?.customerTagAssignments?.[0]?.customerTag ?? null;
      return {
        userId: uid,
        name: u?.name ?? null,
        phone: u?.phone ?? null,
        tag: tagRow
          ? {
              id: tagRow.id,
              name: tagRow.name,
              color: tagRow.color,
              allowPayLater: tagRow.allowPayLater,
              maxDueAmount: tagRow.maxDueAmount ? Number(tagRow.maxDueAmount) : null,
            }
          : null,
        currentBalance: round2(debit - credit),
        ordersInRangeTotal: round2(ordersInRangeByUser.get(uid) ?? 0),
        settlementsInRangeTotal: round2(settlementsInRangeByUser.get(uid) ?? 0),
      };
    });
    rows.sort((a, b) => b.currentBalance - a.currentBalance);
    return rows;
  }

  /** Full ledger trail for one customer — for a drill-down modal. */
  async listLedger(userId: string, outletId: string, limit = 50) {
    return this.prisma.customerDuesLedger.findMany({
      where: { userId, outletId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        settlement: {
          select: { id: true, amount: true, paymentMode: true, reference: true, settledBy: true, createdAt: true },
        },
      },
    });
  }

  // ─── Write paths ────────────────────────────────────────────────

  /**
   * Called by OrdersService when an order is placed with payLater=true.
   * Idempotent on retry — the (orderId, kind=DEBIT) pair is unique by
   * construction so a duplicate write throws and the caller retries
   * the read.
   *
   * Caller is responsible for permission + tag-allows-pay-later check
   * + ceiling check; this method just persists. Runs inside the
   * caller's transaction so a failed order roll doesn't leave a
   * ledger row stranded.
   */
  async recordOrderDebit(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      businessId: string;
      outletId: string;
      orderId: string;
      amount: number;
      notes?: string;
    },
  ) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Pay-later amount must be > 0');
    }
    return tx.customerDuesLedger.create({
      data: {
        userId: params.userId,
        businessId: params.businessId,
        outletId: params.outletId,
        orderId: params.orderId,
        kind: 'DEBIT',
        amount: params.amount,
        notes: params.notes ?? null,
      },
    });
  }

  /**
   * Void any DEBIT rows tied to an order — called when the order is
   * cancelled / refunded. Idempotent on `voidedAt IS NULL`. Mirrors
   * the CouponUsage void hook (same trigger sites in
   * OrdersService.updateStatus).
   */
  async voidOrderDebit(tx: Prisma.TransactionClient, orderId: string) {
    return tx.customerDuesLedger.updateMany({
      where: { orderId, kind: 'DEBIT', voidedAt: null },
      data: { voidedAt: new Date() },
    });
  }

  /**
   * Settle (partial or full) a customer's dues at an outlet. Writes
   * a parent CustomerDuesSettlement + a CREDIT ledger row of the same
   * amount inside one transaction. Returns the settlement.
   *
   * Caller MUST have already verified the SETTLE_CUSTOMER_DUES
   * responsibility (controller does this). We re-check that the amount
   * doesn't exceed the current outstanding balance so the ledger
   * doesn't go negative — a "credit" larger than the debt would mean
   * we owe the customer money, which is not what this endpoint models.
   */
  async settle(params: {
    userId: string;
    businessId: string;
    outletId: string;
    amount: number;
    paymentMode: string;
    reference?: string;
    notes?: string;
    settledBy?: string;
  }) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Settlement amount must be > 0');
    }
    const mode = (params.paymentMode || '').toUpperCase();
    if (!['CASH', 'UPI', 'CARD', 'RAZORPAY', 'OTHER'].includes(mode)) {
      throw new BadRequestException('paymentMode must be CASH | UPI | CARD | RAZORPAY | OTHER');
    }
    const balance = await this.getBalance(params.userId, params.outletId);
    if (balance <= 0) {
      throw new BadRequestException('Customer has no outstanding dues at this outlet');
    }
    if (params.amount - balance > 0.01) {
      throw new BadRequestException(`Settlement (₹${params.amount}) exceeds outstanding balance (₹${balance.toFixed(2)})`);
    }

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.customerDuesSettlement.create({
        data: {
          userId: params.userId,
          businessId: params.businessId,
          outletId: params.outletId,
          amount: params.amount,
          paymentMode: mode,
          reference: params.reference ?? null,
          notes: params.notes ?? null,
          settledBy: params.settledBy ?? null,
        },
      });
      await tx.customerDuesLedger.create({
        data: {
          userId: params.userId,
          businessId: params.businessId,
          outletId: params.outletId,
          kind: 'CREDIT',
          amount: params.amount,
          settlementId: settlement.id,
          notes: params.notes ?? null,
        },
      });
      return settlement;
    });
  }

  // ─── Ceiling check (called from the orders flow) ───────────────

  /**
   * Look up the tag the customer holds at the outlet AND verify that
   * (a) the tag exists and allows pay-later, and (b) adding
   * `nextOrderAmount` to the current balance wouldn't exceed the
   * tag's maxDueAmount ceiling (if any).
   *
   * Returns { tag, currentBalance } on success; throws
   * BadRequestException with a customer-readable message on failure.
   * Used by OrdersService before persisting a pay-later order.
   */
  async assertCanPayLater(userId: string, outletId: string, nextOrderAmount: number) {
    const assignment = await this.prisma.customerTagAssignment.findUnique({
      where: { userId_outletId: { userId, outletId } },
      include: {
        customerTag: { select: { id: true, name: true, allowPayLater: true, maxDueAmount: true } },
      },
    });
    if (!assignment || !assignment.customerTag.allowPayLater) {
      throw new BadRequestException('Pay-later is not enabled for this customer');
    }
    const balance = await this.getBalance(userId, outletId);
    const ceiling = assignment.customerTag.maxDueAmount;
    if (ceiling != null) {
      const cap = Number(ceiling);
      if (balance + nextOrderAmount - cap > 0.01) {
        throw new BadRequestException(
          `This order would push the customer over the ₹${cap.toFixed(2)} dues ceiling (current balance ₹${balance.toFixed(2)})`,
        );
      }
    }
    return { tag: assignment.customerTag, currentBalance: balance };
  }

  /**
   * Customer-facing "My Dues" data — one row per outlet where the
   * customer has any pay-later activity. Returns current balance,
   * outlet display fields (name + UPI ID for the deeplink target),
   * and the tag context. Skips outlets with a non-positive balance
   * (already settled) so the PWA list isn't padded with zeros.
   */
  async listMyDues(userId: string) {
    const ledgerOutlets = await this.prisma.customerDuesLedger.findMany({
      where: { userId, voidedAt: null },
      select: { outletId: true },
      distinct: ['outletId'],
    });
    if (ledgerOutlets.length === 0) return [];

    const outletIds = ledgerOutlets.map((r) => r.outletId);
    const outlets = await this.prisma.outlet.findMany({
      where: { id: { in: outletIds } },
      select: {
        id: true, name: true, upiId: true, businessId: true,
        business: { select: { name: true } },
      },
    });
    const outletById = new Map(outlets.map((o) => [o.id, o]));

    // Pull tag info per (user, outlet) for the display chip.
    const assignments = await this.prisma.customerTagAssignment.findMany({
      where: { userId, outletId: { in: outletIds } },
      include: { customerTag: { select: { id: true, name: true, color: true, allowPayLater: true, maxDueAmount: true } } },
    });
    const tagByOutlet = new Map(assignments.map((a) => [a.outletId, a.customerTag]));

    const rows: any[] = [];
    for (const oid of outletIds) {
      const balance = await this.getBalance(userId, oid);
      if (balance <= 0) continue;
      const o = outletById.get(oid);
      const tag = tagByOutlet.get(oid);
      rows.push({
        outletId: oid,
        outletName: o?.name ?? null,
        businessName: o?.business?.name ?? null,
        outletUpiId: o?.upiId ?? null,
        currentBalance: balance,
        tag: tag
          ? {
              id: tag.id,
              name: tag.name,
              color: tag.color,
              allowPayLater: tag.allowPayLater,
              maxDueAmount: tag.maxDueAmount ? Number(tag.maxDueAmount) : null,
            }
          : null,
      });
    }
    rows.sort((a, b) => b.currentBalance - a.currentBalance);
    return rows;
  }

  // Lookup helper used by the customer PWA to decide whether to show
  // the "Pay later?" prompt at checkout. Cheap, single-row read.
  async lookupPayLater(userId: string, outletId: string) {
    const a = await this.prisma.customerTagAssignment.findUnique({
      where: { userId_outletId: { userId, outletId } },
      include: {
        customerTag: { select: { allowPayLater: true, maxDueAmount: true, name: true } },
      },
    });
    if (!a?.customerTag.allowPayLater) {
      return { allowPayLater: false, currentBalance: 0, ceiling: null as number | null, tagName: null as string | null };
    }
    const currentBalance = await this.getBalance(userId, outletId);
    return {
      allowPayLater: true,
      currentBalance,
      ceiling: a.customerTag.maxDueAmount != null ? Number(a.customerTag.maxDueAmount) : null,
      tagName: a.customerTag.name,
    };
  }
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
