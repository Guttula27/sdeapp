import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferredLanguage } from '../../common/language/preferred-language';
import { OrderStatus, OrderItemStatus } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('outlets/:outletId/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
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
  ) {
    return this.ordersService.findAll(outletId, { status, page, limit, callerUserId: user?.id }, lang);
  }

  // Postpaid open-order lookup for a given table. Returns the single open
  // postpaid order (no billRequestedAt, not cancelled) on the table or null.
  @UseGuards(JwtAuthGuard)
  @Get('open')
  findOpenForTable(
    @Param('outletId') outletId: string,
    @Query('tableId') tableId: string,
    @PreferredLanguage() lang: string | null,
  ) {
    return this.ordersService.findOpenForTable(outletId, tableId, lang);
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

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    // Public lookup — order IDs are cuids and effectively unguessable.
    // Required so guest customers can track their own orders after placing.
    return this.ordersService.findOne(id, lang);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateStatus(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancel(id, userId, reason);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/items/:itemId/status')
  updateItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('status') status: OrderItemStatus,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateItemStatus(id, itemId, status, userId);
  }
}
