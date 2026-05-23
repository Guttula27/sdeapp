import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService, UpsertReviewDto, ReplyDto, PaybackDto } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  // ── Customer ──────────────────────────────────────────────
  @Post('order-items/:orderItemId/review')
  upsert(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: UpsertReviewDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reviews.upsertReview(orderItemId, userId, dto);
  }

  @Delete('order-items/:orderItemId/review')
  remove(
    @Param('orderItemId') orderItemId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.reviews.deleteReview(orderItemId, userId);
  }

  @Get('users/me/reviews')
  mine(@CurrentUser('id') userId: string) {
    return this.reviews.myReviews(userId);
  }

  // ── Owner / manager inbox ─────────────────────────────────
  // GET /outlets/:outletId/reviews?withCommentOnly=true
  @Get('outlets/:outletId/reviews')
  listForOutlet(
    @Param('outletId') outletId: string,
    @Query('withCommentOnly') withCommentOnly?: string,
  ) {
    return this.reviews.listForOutlet(outletId, {
      withCommentOnly: withCommentOnly === 'true' || withCommentOnly === '1',
    });
  }

  @Post('reviews/:id/reply')
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reviews.reply(id, userId, dto);
  }

  @Post('reviews/:id/payback')
  payback(
    @Param('id') id: string,
    @Body() dto: PaybackDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reviews.initiatePayback(id, userId, dto);
  }
}
