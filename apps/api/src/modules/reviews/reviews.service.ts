import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OrderStatus, PaymentMode } from '@prisma/client';

export interface UpsertReviewDto {
  rating: number;
  comment?: string | null;
}

export interface ReplyDto {
  replyText: string;
}

export interface PaybackDto {
  amount: number;
  mode: PaymentMode; // CASH / UPI / etc.
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Customer rates one of their order items. Order must be SERVED and the
   * caller must own it. Upserts so the customer can edit their rating.
   */
  async upsertReview(orderItemId: string, customerId: string, dto: UpsertReviewDto) {
    const rating = Number(dto.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be an integer from 1 to 5');
    }
    const comment = dto.comment?.trim() || null;

    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { select: { id: true, customerId: true, status: true } } },
    });
    if (!orderItem) throw new NotFoundException('Order item not found');
    if (orderItem.order.customerId !== customerId) {
      throw new ForbiddenException('You can only review items on your own orders');
    }
    // Allow rating as soon as this individual item has been served — the
    // customer doesn't have to wait for the entire order to finish.
    if (orderItem.status !== 'SERVED' && orderItem.order.status !== OrderStatus.SERVED) {
      throw new BadRequestException('Item can only be reviewed once it has been served');
    }

    return this.prisma.orderItemReview.upsert({
      where: { orderItemId },
      create: {
        orderItemId,
        itemId: orderItem.itemId,
        customerId,
        rating,
        comment,
      },
      update: { rating, comment },
    });
  }

  async deleteReview(orderItemId: string, customerId: string) {
    const review = await this.prisma.orderItemReview.findUnique({
      where: { orderItemId },
      select: { customerId: true },
    });
    if (!review) return { success: true };
    if (review.customerId !== customerId) {
      throw new ForbiddenException('You can only remove your own reviews');
    }
    await this.prisma.orderItemReview.delete({ where: { orderItemId } });
    return { success: true };
  }

  /** List reviews left by the caller. Useful for "my reviews" feeds. */
  myReviews(customerId: string) {
    return this.prisma.orderItemReview.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { id: true, name: true, imageUrl: true } },
        orderItem: { select: { id: true, orderId: true, order: { select: { orderNumber: true, createdAt: true } } } },
      },
    });
  }

  // ─── Owner / manager side ──────────────────────────────────

  /** All reviews for items belonging to the given outlet, newest first. */
  async listForOutlet(outletId: string, opts: { withCommentOnly?: boolean } = {}) {
    const where: any = { orderItem: { order: { outletId } } };
    if (opts.withCommentOnly) where.comment = { not: null };
    return this.prisma.orderItemReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        replyBy: { select: { id: true, name: true } },
        paybackPayment: { select: { id: true, mode: true, amount: true, status: true, createdAt: true } },
        orderItem: {
          select: {
            id: true,
            orderId: true,
            order: { select: { orderNumber: true, createdAt: true, totalAmount: true } },
          },
        },
      },
    });
  }

  /** Owner/manager replies to a review. Idempotent: updates if already set. */
  async reply(reviewId: string, userId: string, dto: ReplyDto) {
    const text = dto.replyText?.trim();
    if (!text) throw new BadRequestException('Reply text is required');
    const exists = await this.prisma.orderItemReview.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Review not found');
    return this.prisma.orderItemReview.update({
      where: { id: reviewId },
      data: {
        replyText: text,
        replyByUserId: userId,
        repliedAt: new Date(),
      },
      include: { replyBy: { select: { id: true, name: true } } },
    });
  }

  /**
   * Record a payback against the review. Creates a Payment row marked
   * isRefund=true on the underlying order, then links it from the review.
   * Refuses if a payback already exists for this review.
   */
  async initiatePayback(reviewId: string, _userId: string, dto: PaybackDto) {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payback amount must be a positive number');
    }
    if (!dto.mode) throw new BadRequestException('Payment mode is required');

    const review = await this.prisma.orderItemReview.findUnique({
      where: { id: reviewId },
      select: { id: true, paybackPaymentId: true, orderItem: { select: { orderId: true } } },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.paybackPaymentId) {
      throw new BadRequestException('A payback has already been recorded for this review');
    }

    // Atomic: record-only Payment + back-fill on the review in one transaction.
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: review.orderItem.orderId,
          mode: dto.mode,
          amount,
          status: 'SUCCESS',
          isRefund: true,
        },
      });
      return tx.orderItemReview.update({
        where: { id: reviewId },
        data: {
          paybackAmount: amount,
          paybackPaymentId: payment.id,
        },
        include: {
          paybackPayment: { select: { id: true, mode: true, amount: true, status: true, createdAt: true } },
        },
      });
    });
  }

  /** Aggregate avg rating + count for a set of item ids. Keys are item ids. */
  async aggregatesFor(itemIds: string[]): Promise<Record<string, { avg: number; count: number }>> {
    if (!itemIds.length) return {};
    const rows = await this.prisma.orderItemReview.groupBy({
      by: ['itemId'],
      where: { itemId: { in: itemIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const out: Record<string, { avg: number; count: number }> = {};
    for (const r of rows) {
      out[r.itemId] = {
        avg: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
        count: r._count.rating ?? 0,
      };
    }
    return out;
  }
}
