import { PrismaService } from '../../config/prisma/prisma.service';
import { PaymentMode } from '@prisma/client';
export interface UpsertReviewDto {
    rating: number;
    comment?: string | null;
}
export interface ReplyDto {
    replyText: string;
}
export interface PaybackDto {
    amount: number;
    mode: PaymentMode;
}
export declare class ReviewsService {
    private prisma;
    constructor(prisma: PrismaService);
    upsertReview(orderItemId: string, customerId: string, dto: UpsertReviewDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        itemId: string;
        orderItemId: string;
        rating: number;
        comment: string | null;
        replyText: string | null;
        replyByUserId: string | null;
        repliedAt: Date | null;
        paybackAmount: import("@prisma/client/runtime/library").Decimal | null;
        paybackPaymentId: string | null;
    }>;
    deleteReview(orderItemId: string, customerId: string): Promise<{
        success: boolean;
    }>;
    myReviews(customerId: string): import(".prisma/client").Prisma.PrismaPromise<({
        item: {
            name: string;
            id: string;
            imageUrl: string | null;
        };
        orderItem: {
            order: {
                createdAt: Date;
                orderNumber: string;
            };
            id: string;
            orderId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        itemId: string;
        orderItemId: string;
        rating: number;
        comment: string | null;
        replyText: string | null;
        replyByUserId: string | null;
        repliedAt: Date | null;
        paybackAmount: import("@prisma/client/runtime/library").Decimal | null;
        paybackPaymentId: string | null;
    })[]>;
    listForOutlet(outletId: string, opts?: {
        withCommentOnly?: boolean;
    }): Promise<({
        item: {
            name: string;
            id: string;
        };
        orderItem: {
            order: {
                createdAt: Date;
                orderNumber: string;
                totalAmount: import("@prisma/client/runtime/library").Decimal;
            };
            id: string;
            orderId: string;
        };
        customer: {
            name: string;
            phone: string;
            id: string;
        };
        replyBy: {
            name: string;
            id: string;
        } | null;
        paybackPayment: {
            id: string;
            status: import(".prisma/client").$Enums.PaymentStatus;
            createdAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            mode: import(".prisma/client").$Enums.PaymentMode;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        itemId: string;
        orderItemId: string;
        rating: number;
        comment: string | null;
        replyText: string | null;
        replyByUserId: string | null;
        repliedAt: Date | null;
        paybackAmount: import("@prisma/client/runtime/library").Decimal | null;
        paybackPaymentId: string | null;
    })[]>;
    reply(reviewId: string, userId: string, dto: ReplyDto): Promise<{
        replyBy: {
            name: string;
            id: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        itemId: string;
        orderItemId: string;
        rating: number;
        comment: string | null;
        replyText: string | null;
        replyByUserId: string | null;
        repliedAt: Date | null;
        paybackAmount: import("@prisma/client/runtime/library").Decimal | null;
        paybackPaymentId: string | null;
    }>;
    initiatePayback(reviewId: string, _userId: string, dto: PaybackDto): Promise<{
        paybackPayment: {
            id: string;
            status: import(".prisma/client").$Enums.PaymentStatus;
            createdAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            mode: import(".prisma/client").$Enums.PaymentMode;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        itemId: string;
        orderItemId: string;
        rating: number;
        comment: string | null;
        replyText: string | null;
        replyByUserId: string | null;
        repliedAt: Date | null;
        paybackAmount: import("@prisma/client/runtime/library").Decimal | null;
        paybackPaymentId: string | null;
    }>;
    aggregatesFor(itemIds: string[]): Promise<Record<string, {
        avg: number;
        count: number;
    }>>;
}
