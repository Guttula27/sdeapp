"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const client_1 = require("@prisma/client");
let ReviewsService = class ReviewsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upsertReview(orderItemId, customerId, dto) {
        const rating = Number(dto.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new common_1.BadRequestException('Rating must be an integer from 1 to 5');
        }
        const comment = dto.comment?.trim() || null;
        const orderItem = await this.prisma.orderItem.findUnique({
            where: { id: orderItemId },
            include: { order: { select: { id: true, customerId: true, status: true } } },
        });
        if (!orderItem)
            throw new common_1.NotFoundException('Order item not found');
        if (orderItem.order.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only review items on your own orders');
        }
        if (orderItem.status !== 'SERVED' && orderItem.order.status !== client_1.OrderStatus.SERVED) {
            throw new common_1.BadRequestException('Item can only be reviewed once it has been served');
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
    async deleteReview(orderItemId, customerId) {
        const review = await this.prisma.orderItemReview.findUnique({
            where: { orderItemId },
            select: { customerId: true },
        });
        if (!review)
            return { success: true };
        if (review.customerId !== customerId) {
            throw new common_1.ForbiddenException('You can only remove your own reviews');
        }
        await this.prisma.orderItemReview.delete({ where: { orderItemId } });
        return { success: true };
    }
    myReviews(customerId) {
        return this.prisma.orderItemReview.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: {
                item: { select: { id: true, name: true, imageUrl: true } },
                orderItem: { select: { id: true, orderId: true, order: { select: { orderNumber: true, createdAt: true } } } },
            },
        });
    }
    async listForOutlet(outletId, opts = {}) {
        const where = { orderItem: { order: { outletId } } };
        if (opts.withCommentOnly)
            where.comment = { not: null };
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
    async reply(reviewId, userId, dto) {
        const text = dto.replyText?.trim();
        if (!text)
            throw new common_1.BadRequestException('Reply text is required');
        const exists = await this.prisma.orderItemReview.findUnique({
            where: { id: reviewId },
            select: { id: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('Review not found');
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
    async initiatePayback(reviewId, _userId, dto) {
        const amount = Number(dto.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new common_1.BadRequestException('Payback amount must be a positive number');
        }
        if (!dto.mode)
            throw new common_1.BadRequestException('Payment mode is required');
        const review = await this.prisma.orderItemReview.findUnique({
            where: { id: reviewId },
            select: { id: true, paybackPaymentId: true, orderItem: { select: { orderId: true } } },
        });
        if (!review)
            throw new common_1.NotFoundException('Review not found');
        if (review.paybackPaymentId) {
            throw new common_1.BadRequestException('A payback has already been recorded for this review');
        }
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
    async aggregatesFor(itemIds) {
        if (!itemIds.length)
            return {};
        const rows = await this.prisma.orderItemReview.groupBy({
            by: ['itemId'],
            where: { itemId: { in: itemIds } },
            _avg: { rating: true },
            _count: { rating: true },
        });
        const out = {};
        for (const r of rows) {
            out[r.itemId] = {
                avg: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
                count: r._count.rating ?? 0,
            };
        }
        return out;
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map