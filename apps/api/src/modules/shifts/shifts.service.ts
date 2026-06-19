import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashierShiftStatus,
  OutletShiftStatus,
  PaymentMode,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  // ─── Outlet envelope ──────────────────────────────────────

  /**
   * Active outlet shift for the given outlet (at most one — enforced by
   * the open path, which rejects a second open while an ACTIVE row
   * exists). Used everywhere a write needs to know "is the outlet
   * accepting drawer activity right now?".
   */
  async findActiveOutletShift(outletId: string) {
    return this.prisma.outletShift.findFirst({
      where: { outletId, status: OutletShiftStatus.ACTIVE },
    });
  }

  async openOutletShift(outletId: string, userId: string, note?: string) {
    const existing = await this.findActiveOutletShift(outletId);
    if (existing) {
      throw new BadRequestException(
        'An outlet shift is already active — close it before opening another',
      );
    }
    return this.prisma.outletShift.create({
      data: {
        outletId,
        openedByUserId: userId,
        openNote: note ?? null,
      },
    });
  }

  /**
   * Closes the outlet envelope. Per the user-chosen policy ("allow
   * close — orders auto-roll to next shift"), open postpaid tabs and
   * mid-flight orders are NOT blocked here; they retain their
   * cashierShiftId and any subsequent payments land on whatever shift
   * is active at the time. Cashier shifts under this envelope that
   * are still ACTIVE are auto-closed with their expected/declared
   * variance reset to zero (operator can reconcile later via the per-
   * cashier shift Z report).
   */
  async closeOutletShift(shiftId: string, userId: string, closeNote?: string) {
    const shift = await this.prisma.outletShift.findUnique({
      where: { id: shiftId },
      include: { cashierShifts: true },
    });
    if (!shift) throw new NotFoundException('Outlet shift not found');
    if (shift.status === OutletShiftStatus.CLOSED) {
      throw new BadRequestException('Outlet shift is already closed');
    }
    const closedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Auto-close any cashier shifts the operator left open. We don't
      // declare cash for them — operators must reconcile each cashier
      // shift explicitly before this point. For now we just mark them
      // closed so the envelope is clean.
      const stillOpen = shift.cashierShifts.filter(
        (cs) => cs.status === CashierShiftStatus.ACTIVE,
      );
      for (const cs of stillOpen) {
        const expected = await this.computeExpectedCash(cs.id, tx);
        await tx.cashierShift.update({
          where: { id: cs.id },
          data: {
            status: CashierShiftStatus.CLOSED,
            closedAt,
            expectedCash: expected,
            // No declared cash supplied → variance is "unknown", left null.
            closeNote: 'Auto-closed when outlet shift was closed',
          },
        });
      }
      await tx.outletShift.update({
        where: { id: shiftId },
        data: {
          status: OutletShiftStatus.CLOSED,
          closedAt,
          closedByUserId: userId,
          closeNote: closeNote ?? null,
        },
      });
    });
    return this.findOutletShiftWithSummary(shiftId);
  }

  // ─── Cashier sub-shifts ──────────────────────────────────

  /**
   * Active cashier shift for a specific cashier — there can only ever
   * be one (the open path rejects a second one). Returns null when the
   * cashier hasn't opened their drawer.
   */
  async findActiveCashierShift(outletId: string, cashierId: string) {
    return this.prisma.cashierShift.findFirst({
      where: {
        outletId,
        cashierId,
        status: CashierShiftStatus.ACTIVE,
      },
    });
  }

  async openCashierShift(
    outletId: string,
    cashierId: string,
    openingFloat: number,
    note?: string,
  ) {
    const existing = await this.findActiveCashierShift(outletId, cashierId);
    if (existing) {
      throw new BadRequestException(
        'You already have an active cashier shift — close it before opening another',
      );
    }
    // Auto-create the outlet envelope if none exists. The first
    // cashier opening their drawer at start of day is usually also
    // the manager, so this is a sensible UX — no extra "open outlet"
    // click required for single-cashier outlets.
    let envelope = await this.findActiveOutletShift(outletId);
    if (!envelope) {
      envelope = await this.openOutletShift(outletId, cashierId, 'Auto-opened with cashier shift');
    }
    if (openingFloat < 0) {
      throw new BadRequestException('Opening float cannot be negative');
    }
    return this.prisma.cashierShift.create({
      data: {
        outletShiftId: envelope.id,
        outletId,
        cashierId,
        openingFloat: new Prisma.Decimal(openingFloat),
        openNote: note ?? null,
      },
    });
  }

  async closeCashierShift(
    shiftId: string,
    declaredCash: number,
    closeNote?: string,
  ) {
    const shift = await this.prisma.cashierShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Cashier shift not found');
    if (shift.status === CashierShiftStatus.CLOSED) {
      throw new BadRequestException('Cashier shift is already closed');
    }
    if (declaredCash < 0) {
      throw new BadRequestException('Declared cash cannot be negative');
    }
    const expected = await this.computeExpectedCash(shiftId);
    const variance = new Prisma.Decimal(declaredCash).minus(expected);
    return this.prisma.cashierShift.update({
      where: { id: shiftId },
      data: {
        status: CashierShiftStatus.CLOSED,
        closedAt: new Date(),
        declaredCash: new Prisma.Decimal(declaredCash),
        expectedCash: expected,
        variance,
        closeNote: closeNote ?? null,
      },
    });
  }

  /**
   * Opening float + sum of cash payments confirmed during the shift
   * minus cash refunds, all stamped against this CashierShift.
   * Tolerant of being called inside a transaction — accepts an
   * optional Prisma transaction client so the close path's auto-
   * close loop reads consistent numbers.
   */
  private async computeExpectedCash(
    shiftId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const client = tx ?? this.prisma;
    const shift = await client.cashierShift.findUnique({ where: { id: shiftId } });
    if (!shift) return new Prisma.Decimal(0);
    const cashPayments = await client.payment.aggregate({
      where: {
        cashierShiftId: shiftId,
        mode: PaymentMode.CASH,
        status: PaymentStatus.SUCCESS,
        isRefund: false,
      },
      _sum: { amount: true },
    });
    const cashRefunds = await client.payment.aggregate({
      where: {
        cashierShiftId: shiftId,
        mode: PaymentMode.CASH,
        status: PaymentStatus.SUCCESS,
        isRefund: true,
      },
      _sum: { amount: true },
    });
    const cashIn = cashPayments._sum.amount ?? new Prisma.Decimal(0);
    const cashOut = cashRefunds._sum.amount ?? new Prisma.Decimal(0);
    return new Prisma.Decimal(shift.openingFloat).plus(cashIn).minus(cashOut);
  }

  // ─── Z reports ────────────────────────────────────────────

  /**
   * Cashier-level Z report. Numbers reconcile the drawer:
   *   openingFloat + cashSales - cashRefunds = expectedCash
   * Plus payment-mode split, GST breakdown, and order counts so the
   * cashier (and the manager) can sign off on their session.
   */
  async cashierShiftZReport(shiftId: string) {
    const shift = await this.prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: { cashier: { select: { id: true, name: true } } },
    });
    if (!shift) throw new NotFoundException('Cashier shift not found');

    // Payment-mode split (gross, excluding refunds).
    const paymentsByMode = await this.prisma.payment.groupBy({
      by: ['mode'],
      where: {
        cashierShiftId: shiftId,
        status: PaymentStatus.SUCCESS,
        isRefund: false,
      },
      _sum: { amount: true },
      _count: true,
    });
    const refundsByMode = await this.prisma.payment.groupBy({
      by: ['mode'],
      where: {
        cashierShiftId: shiftId,
        status: PaymentStatus.SUCCESS,
        isRefund: true,
      },
      _sum: { amount: true },
      _count: true,
    });

    // GST + sales aggregates from orders placed during the shift.
    // Order.cashierShiftId is the placement-time stamp, so it
    // captures sales placed-during-shift (the more common report
    // shape for kitchen volume). Revenue-from-payments comes from
    // the paymentsByMode block above.
    const orderAgg = await this.prisma.order.aggregate({
      where: { cashierShiftId: shiftId },
      _sum: {
        subtotal: true,
        taxAmount: true,
        sgstAmount: true,
        cgstAmount: true,
        parcelAmount: true,
        discountAmount: true,
        totalAmount: true,
      },
      _count: true,
    });

    const cancelledCount = await this.prisma.order.count({
      where: { cashierShiftId: shiftId, status: 'CANCELLED' },
    });

    const expectedCash = await this.computeExpectedCash(shiftId);

    return {
      shift,
      paymentsByMode: paymentsByMode.map((p) => ({
        mode: p.mode,
        amount: p._sum.amount ?? new Prisma.Decimal(0),
        count: p._count,
      })),
      refundsByMode: refundsByMode.map((p) => ({
        mode: p.mode,
        amount: p._sum.amount ?? new Prisma.Decimal(0),
        count: p._count,
      })),
      orderAggregates: {
        ordersCount: orderAgg._count,
        cancelledCount,
        subtotal: orderAgg._sum.subtotal ?? new Prisma.Decimal(0),
        tax: orderAgg._sum.taxAmount ?? new Prisma.Decimal(0),
        sgst: orderAgg._sum.sgstAmount ?? new Prisma.Decimal(0),
        cgst: orderAgg._sum.cgstAmount ?? new Prisma.Decimal(0),
        discounts: orderAgg._sum.discountAmount ?? new Prisma.Decimal(0),
        parcel: orderAgg._sum.parcelAmount ?? new Prisma.Decimal(0),
        total: orderAgg._sum.totalAmount ?? new Prisma.Decimal(0),
      },
      cash: {
        openingFloat: shift.openingFloat,
        expectedCash,
        declaredCash: shift.declaredCash,
        variance: shift.variance,
      },
    };
  }

  /**
   * Outlet-level Z report — sums every cashier shift's totals into
   * one outlet-wide view. The manager reads this at end of day.
   */
  async outletShiftZReport(outletShiftId: string) {
    const shift = await this.prisma.outletShift.findUnique({
      where: { id: outletShiftId },
      include: {
        cashierShifts: { include: { cashier: { select: { id: true, name: true } } } },
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });
    if (!shift) throw new NotFoundException('Outlet shift not found');

    // Roll up cashier-shift Z reports under one umbrella.
    const cashierReports = await Promise.all(
      shift.cashierShifts.map((cs) => this.cashierShiftZReport(cs.id)),
    );
    return { shift, cashierReports };
  }

  async findOutletShiftWithSummary(outletShiftId: string) {
    return this.outletShiftZReport(outletShiftId);
  }
}
