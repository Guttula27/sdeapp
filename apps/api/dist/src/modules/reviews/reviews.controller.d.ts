import { ReviewsService, UpsertReviewDto, ReplyDto, PaybackDto } from './reviews.service';
export declare class ReviewsController {
    private reviews;
    constructor(reviews: ReviewsService);
    upsert(orderItemId: string, dto: UpsertReviewDto, userId: string): Promise<{
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
    remove(orderItemId: string, userId: string): Promise<{
        success: boolean;
    }>;
    mine(userId: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    listForOutlet(outletId: string, withCommentOnly?: string): Promise<({
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
    reply(id: string, dto: ReplyDto, userId: string): Promise<{
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
    payback(id: string, dto: PaybackDto, userId: string): Promise<{
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
}
