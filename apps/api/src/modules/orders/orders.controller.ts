import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { assertResponsibility } from '../../common/permissions/responsibility';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { OrderStatus } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('outlets/:outletId/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  create(
    @Param('outletId') outletId: string,
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.create(outletId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Param('outletId') outletId: string,
    @PreferredLanguage() lang: string | null,
    @CurrentUser() user: any,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'totalAmount' | 'orderNumber' | 'status',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    // slim=true returns the SLIM_LIST_SELECT shape — id, number,
    // status, total, table#, customerName, itemCount. ~60× smaller.
    // Default keeps the fat shape so existing list views (admin SPA
    // expecting items[].item etc.) don't break.
    @Query('slim') slim?: string,
  ) {
    return this.ordersService.findAll(
      outletId,
      { status, page, limit, callerUserId: user?.id, search, sortBy, sortDir, slim: slim === 'true' },
      lang,
    );
  }

  // Postpaid open-order lookup for a given table. Customer-scoped — a
  // table can hold multiple open tabs (one per phone). Customer PWA
  // uses the JWT user as the customer; staff pass ?customerPhone= so
  // they pick the tab belonging to the customer in front of them.
  @UseGuards(JwtAuthGuard)
  @Get('open')
  findOpenForTable(
    @Param('outletId') outletId: string,
    @Query('tableId') tableId: string,
    @Query('customerPhone') customerPhone: string | undefined,
    @CurrentUser('id') userId: string | undefined,
    @PreferredLanguage() lang: string | null,
  ) {
    return this.ordersService.findOpenForTable(
      outletId,
      tableId,
      { userId, customerPhone },
      lang,
    );
  }

  // Append new items to an existing postpaid (open) order.
  @UseGuards(JwtAuthGuard)
  @Post(':id/items')
  appendItems(
    @Param('id') id: string,
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.appendItems(id, dto, userId);
  }

  // Bill Now: stamps billRequestedAt on a postpaid order and freezes
  // further item additions. Payment is collected via the normal flow.
  @UseGuards(JwtAuthGuard)
  @Patch(':id/bill-request')
  requestBill(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.requestBill(id, userId);
  }

  // Cashier flow: look up an order by its printed bill number (orderNumber)
  // so the dispute / refund flow can be started from a paper receipt without
  // first scrolling through the orders list.
  @UseGuards(JwtAuthGuard)
  @Get('by-number/:orderNumber')
  findByNumber(
    @Param('outletId') outletId: string,
    @Param('orderNumber') orderNumber: string,
    @PreferredLanguage() lang: string | null,
  ) {
    return this.ordersService.findByOrderNumber(outletId, orderNumber, lang);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @PreferredLanguage() lang: string | null,
    // slim=true returns just the core fields (status, items as snapshots,
    // outlet/table/customer names, totals). Skips the receipt-shaped
    // graph (item.variant.menu, full address, payments, statusHistory,
    // disputes, couponUsages, reviews+paybackPayment). Receipt-shaped
    // graph is what the print path needs; everything else should opt
    // into slim. Sub-resources expose the pieces individually:
    //   GET /orders/:id/payments
    //   GET /orders/:id/status-history
    //   GET /orders/:id/disputes
    //   GET /orders/:id/coupons
    //   GET /orders/:id/status   (lightweight poll target)
    @Query('slim') slim?: string,
  ) {
    // Public lookup — order IDs are cuids and effectively unguessable.
    // Required so guest customers can track their own orders after placing.
    return slim === 'true'
      ? this.ordersService.findOneSlim(id)
      : this.ordersService.findOne(id, lang);
  }

  // ── Sub-resources for the slim findOne shape ──────────────────
  // Targeted GETs the admin SPA / customer track-order page can fetch
  // on-demand rather than dragging the whole graph through every poll.
  // Same auth gate as the parent (`/orders/:id`) so anonymous customer
  // tracking keeps working for the lightweight status path.

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/status')
  async getOrderStatus(@Param('id') id: string) {
    // Returns ~150 bytes — designed for poll-loop clients (customer
    // track-order screen, kitchen reconcile after a missed socket
    // event). See C3.
    const slim = await this.ordersService.findOneSlim(id);
    if (!slim) return null;
    const history = await this.ordersService.findStatusHistory(id);
    const currentEvent = history.length ? history[history.length - 1] : null;
    return {
      id: slim.id,
      orderNumber: slim.orderNumber,
      status: slim.status,
      updatedAt: slim.updatedAt,
      currentEvent: currentEvent
        ? { status: currentEvent.status, at: currentEvent.createdAt }
        : null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/payments')
  getOrderPayments(@Param('id') id: string) {
    return this.ordersService.findPayments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status-history')
  getOrderStatusHistory(@Param('id') id: string) {
    return this.ordersService.findStatusHistory(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/disputes')
  getOrderDisputes(@Param('id') id: string) {
    return this.ordersService.findDisputes(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/coupons')
  getOrderCoupons(@Param('id') id: string) {
    return this.ordersService.findCouponUsages(id);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateStatus(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancel(id, userId, reason);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @Patch(':id/items/:itemId/status')
  updateItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateItemStatus(id, itemId, dto.status, userId, dto.actedAt);
  }

  // Order log: enriched status history (stage / time / staff). Gated by
  // VIEW_ORDER_LOG so only management roles see who did what.
  @UseGuards(JwtAuthGuard)
  @Get(':id/log')
  async getLog(@Param('id') id: string, @CurrentUser() user: any) {
    assertResponsibility(user, 'VIEW_ORDER_LOG');
    return this.ordersService.getOrderLog(id);
  }

  // Service desk: confirm or strike unverified postpaid lines. Body:
  //   { itemIds?: string[]; action: 'confirm' | 'strike' }
  // Omitting itemIds acts on every PENDING_VERIFICATION line on the order.
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @Patch(':id/verify-items')
  verifyItems(
    @Param('id') id: string,
    @Body() body: { itemIds?: string[]; action: 'confirm' | 'strike' },
    @CurrentUser() user: any,
  ) {
    assertResponsibility(user, 'MANAGE_SERVICE_DESK');
    return this.ordersService.verifyItems(id, body.itemIds, body.action || 'confirm', user?.id);
  }

  // Service desk: adjust the quantity of an individual unverified line
  // while the customer is being verified. Rejected if the line has
  // already gone to the kitchen — at that point qty changes go through
  // the cancel + re-add path so stock + KOT history stay correct.
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @Patch(':id/items/:itemId/quantity')
  updateItemQuantity(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
    @CurrentUser() user: any,
  ) {
    assertResponsibility(user, 'MANAGE_SERVICE_DESK');
    return this.ordersService.updateItemQuantityAtVerify(id, itemId, body?.quantity, user?.id);
  }

  // Service desk dashboard: returns three lanes for this outlet —
  // postpaid orders awaiting verify, self-service awaiting release,
  // table-service awaiting pickup. Parcel orders ride in their own UI.
  @UseGuards(JwtAuthGuard)
  @Get('service-desk/queue')
  serviceDeskQueue(@Param('outletId') outletId: string, @CurrentUser() user: any) {
    assertResponsibility(user, 'VIEW_SERVICE_DESK');
    return this.ordersService.getServiceDeskQueue(outletId);
  }

  // Open tabs view: every postpaid order on this outlet whose payment
  // hasn't completed yet. Stays visible across verify → preparing →
  // ready → served → bill → payment, only disappearing once paid.
  // Client groups by section / table for the working surface.
  @UseGuards(JwtAuthGuard)
  @Get('service-desk/open-tabs')
  openServiceTabs(
    @Param('outletId') outletId: string,
    @CurrentUser() user: any,
    @Query('tableId') tableId?: string,
  ) {
    assertResponsibility(user, 'VIEW_SERVICE_DESK');
    return this.ordersService.getOpenServiceTabs(outletId, tableId);
  }

  // Parcel desk dashboard: two lanes — pack (kitchen done, awaiting
  // packaging) and handover (packed, customer collecting). Returns
  // 403 if the caller lacks VIEW_PARCEL_DESK.
  @UseGuards(JwtAuthGuard)
  @Get('parcel-desk/queue')
  parcelDeskQueue(@Param('outletId') outletId: string, @CurrentUser() user: any) {
    assertResponsibility(user, 'VIEW_PARCEL_DESK');
    return this.ordersService.getParcelDeskQueue(outletId);
  }

  // Course planner: bulk assign items to sequence numbers and rename
  // courses. Body shape:
  //   { items: [{ itemId, sequenceNumber }], labels: { "1": "Starter" } }
  // Either field is optional; labels=null clears them.
  @UseGuards(JwtAuthGuard)
  @Patch(':id/sequences')
  setSequences(
    @Param('id') id: string,
    @Body() body: {
      items?: Array<{ itemId: string; sequenceNumber: number | null }>;
      labels?: Record<string, string> | null;
    },
  ) {
    return this.ordersService.setSequences(id, body);
  }
}
