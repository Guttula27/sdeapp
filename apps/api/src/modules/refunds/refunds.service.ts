import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { EncryptionService } from '../../config/crypto/encryption.service';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Cashier files a refund. Source payment must exist and have
   * SUCCESS status. Amount can be partial — multiple refunds against
   * the same order are allowed up to the total billed amount.
   *
   * Mode defaults to the source payment's mode (UPI customer gets a
   * UPI refund, cash customer gets cash). Caller can override (rare —
   * e.g. when the customer wants cash because the UPI account is
   * gone).
   */
  async initiate(
    orderId: string,
    args: {
      amount: number;
      paymentId?: string;
      mode?: PaymentMode;
      reason?: string;
    },
    initiatedById: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { where: { status: PaymentStatus.SUCCESS, isRefund: false } },
        refunds: { where: { status: { in: [RefundStatus.INITIATED, RefundStatus.APPROVED, RefundStatus.PROCESSING, RefundStatus.COMPLETED] } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.payments.length === 0) {
      throw new BadRequestException('Order has no successful payment to refund');
    }

    // Allow refunds up to the sum of successful payments minus already-
    // claimed refund amounts. The check uses Decimal math so partial
    // refunds don't drift on the boundary.
    const paid = order.payments.reduce(
      (s, p) => s.plus(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );
    const alreadyRefunded = order.refunds.reduce(
      (s, r) => s.plus(new Prisma.Decimal(r.amount)),
      new Prisma.Decimal(0),
    );
    const refundable = paid.minus(alreadyRefunded);
    const amountDec = new Prisma.Decimal(args.amount);
    if (amountDec.lte(0)) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    if (amountDec.gt(refundable)) {
      throw new BadRequestException(
        `Refund amount exceeds refundable balance (₹${refundable.toFixed(2)})`,
      );
    }

    // Source payment: caller-specified or the order's largest
    // successful payment (typical case for single-payment orders).
    let source = args.paymentId
      ? order.payments.find((p) => p.id === args.paymentId)
      : order.payments[0];
    if (!source && args.paymentId) {
      throw new BadRequestException('Source payment not found on this order');
    }
    const mode = args.mode ?? source?.mode ?? PaymentMode.CASH;

    return this.prisma.refund.create({
      data: {
        orderId,
        paymentId: source?.id ?? null,
        amount: amountDec,
        mode,
        reason: args.reason,
        initiatedById,
      },
    });
  }

  /**
   * Approver action. Cash refunds complete here (drawer cash goes out,
   * order status updates). Gateway refunds fire the Razorpay refund API
   * and move to PROCESSING; the webhook completes them.
   */
  async approve(refundId: string, approvedById: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: true, payment: true },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== RefundStatus.INITIATED) {
      throw new BadRequestException(`Refund is in ${refund.status} — cannot approve`);
    }

    // Cash refunds settle immediately at the drawer. The completing
    // cashier (approver) gets the cash-out attributed to their shift.
    if (refund.mode === PaymentMode.CASH) {
      const drawerId = await this.activeCashierShiftId(refund.order.outletId, approvedById);
      const completed = await this.completeWithShift(refund, approvedById, drawerId);
      return completed;
    }

    // Non-cash refunds go through Razorpay. We need the original
    // payment's gateway ref to issue the refund.
    if (!refund.payment) {
      throw new BadRequestException(
        'Cannot refund via gateway — no source payment record. Use a cash refund mode instead.',
      );
    }
    const razorpayPaymentId = this.encryption.decrypt(refund.payment.gatewayRef);
    if (!razorpayPaymentId) {
      throw new BadRequestException(
        'Source payment has no gateway reference — refund manually as cash.',
      );
    }

    // Stamp APPROVED + immediately fire the gateway call. If the
    // gateway call throws, leave the row in APPROVED so the operator
    // can retry; we don't want to roll back the approval (it's an
    // auditable decision).
    const approvedRow = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
      },
    });
    try {
      const r = await this.razorpay.createRefund({
        razorpayPaymentId,
        amountInRupees: Number(refund.amount),
        notes: { refundId: refund.id, orderId: refund.orderId },
      });
      // Store the encrypted gateway ref so the webhook handler can
      // match it back, and flip to PROCESSING.
      return this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.PROCESSING,
          gatewayRef: this.encryption.encrypt(r?.id ?? null),
          gatewayResponse: r as any,
        },
      });
    } catch (e: any) {
      // Razorpay failure — leave row APPROVED + record failure note
      // so the operator can retry or switch to cash.
      this.logger.warn(`Razorpay refund failed for ${refundId}: ${e?.message}`);
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { notes: `Razorpay error: ${e?.message ?? 'unknown'}` },
      });
      throw new BadRequestException(`Gateway refund failed: ${e?.message ?? 'unknown'}`);
    }
    return approvedRow;
  }

  /** Cancels an INITIATED or APPROVED refund (e.g. operator changed mind). */
  async cancel(refundId: string, userId: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status === RefundStatus.COMPLETED) {
      throw new BadRequestException('Completed refunds cannot be cancelled');
    }
    if (refund.status === RefundStatus.PROCESSING) {
      throw new BadRequestException(
        'Gateway refund is already processing — cannot cancel; wait for webhook resolution',
      );
    }
    return this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.CANCELLED,
        notes: refund.notes ? `${refund.notes}\nCancelled by ${userId}` : `Cancelled by ${userId}`,
      },
    });
  }

  /**
   * Webhook handler entry. Razorpay fires refund.processed (or
   * refund.failed) when the money actually moves; this is where we
   * finalize the local Refund + create the sibling Payment row.
   */
  async markCompletedByGatewayRef(razorpayRefundId: string) {
    // Find by matching the encrypted gateway ref. Linear scan is
    // acceptable here — refund volume is low and the status index
    // narrows the candidate set.
    const candidates = await this.prisma.refund.findMany({
      where: { status: RefundStatus.PROCESSING },
    });
    const hit = candidates.find(
      (r) => this.encryption.decrypt(r.gatewayRef) === razorpayRefundId,
    );
    if (!hit) {
      this.logger.warn(`Refund webhook for ${razorpayRefundId} found no matching local row`);
      return;
    }
    await this.completeWithShift(hit, hit.approvedById ?? hit.initiatedById, null);
  }

  /** Marks a refund FAILED. Webhook-driven for gateway flows. */
  async markFailedByGatewayRef(razorpayRefundId: string, errorDescription?: string) {
    const candidates = await this.prisma.refund.findMany({
      where: { status: RefundStatus.PROCESSING },
    });
    const hit = candidates.find(
      (r) => this.encryption.decrypt(r.gatewayRef) === razorpayRefundId,
    );
    if (!hit) return;
    await this.prisma.refund.update({
      where: { id: hit.id },
      data: {
        status: RefundStatus.FAILED,
        notes: hit.notes
          ? `${hit.notes}\nGateway failure: ${errorDescription ?? 'unknown'}`
          : `Gateway failure: ${errorDescription ?? 'unknown'}`,
      },
    });
  }

  // ─── Internal helpers ─────────────────────────────────────

  /**
   * Finalises a refund: stamp COMPLETED + mint a sibling Payment row
   * with isRefund=true (so reports + drawer reconciliation pick it up
   * automatically) + update the order status if the cumulative refund
   * amount equals the order total.
   */
  private async completeWithShift(
    refund: { id: string; orderId: string; amount: Prisma.Decimal; mode: PaymentMode; paymentId: string | null },
    actorId: string,
    cashierShiftId: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const completed = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.COMPLETED,
          completedAt: new Date(),
          cashierShiftId,
        },
      });
      // Sibling Payment row for the financial ledger.
      await tx.payment.create({
        data: {
          orderId: refund.orderId,
          amount: refund.amount,
          mode: refund.mode,
          status: PaymentStatus.SUCCESS,
          isRefund: true,
          cashierShiftId,
        },
      });
      // Roll up the order status. Compare cumulative refunded vs the
      // order's totalAmount.
      const order = await tx.order.findUnique({
        where: { id: refund.orderId },
        include: { refunds: { where: { status: RefundStatus.COMPLETED } } },
      });
      if (order) {
        const refundedSum = order.refunds.reduce(
          (s, r) => s.plus(new Prisma.Decimal(r.amount)),
          new Prisma.Decimal(0),
        );
        const isFullyRefunded = refundedSum.gte(new Prisma.Decimal(order.totalAmount));
        const nextStatus = isFullyRefunded ? OrderStatus.REFUND_COMPLETE : OrderStatus.FOR_REFUND;
        if (order.status !== nextStatus) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: nextStatus,
              statusHistory: {
                create: {
                  status: nextStatus,
                  changedBy: actorId,
                  notes: isFullyRefunded
                    ? `Fully refunded (₹${refundedSum.toFixed(2)})`
                    : `Partial refund of ₹${refund.amount.toFixed(2)} (cumulative ₹${refundedSum.toFixed(2)})`,
                },
              },
            },
          });
        }
      }
      return completed;
    });
  }

  private async activeCashierShiftId(outletId: string, userId: string): Promise<string | null> {
    const drawer = await this.prisma.cashierShift.findFirst({
      where: { outletId, cashierId: userId, status: 'ACTIVE' },
      select: { id: true },
    });
    return drawer?.id ?? null;
  }

  // ─── Read endpoints ───────────────────────────────────────

  listForOutlet(outletId: string, status?: RefundStatus) {
    return this.prisma.refund.findMany({
      where: {
        order: { outletId },
        ...(status ? { status } : {}),
      },
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
        initiatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  listForOrder(orderId: string) {
    return this.prisma.refund.findMany({
      where: { orderId },
      include: {
        initiatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
