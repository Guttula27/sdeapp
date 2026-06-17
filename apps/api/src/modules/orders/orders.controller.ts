import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { assertResponsibility } from '../../common/permissions/responsibility';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { OrderStatus, OrderItemStatus } from '@prisma/client';

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
  ) {
    return this.ordersService.findAll(
      outletId,
      { status, page, limit, callerUserId: user?.id, search, sortBy, sortDir },
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
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    // Public lookup — order IDs are cuids and effectively unguessable.
    // Required so guest customers can track their own orders after placing.
    return this.ordersService.findOne(id, lang);
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
    @Body('status') status: OrderItemStatus,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateItemStatus(id, itemId, status, userId);
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
