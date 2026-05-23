import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('revenue')
  revenue(
    @Query('outletId') outletId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getRevenueReport(outletId, new Date(from), new Date(to));
  }

  @Get('item-sales')
  itemSales(
    @Query('outletId') outletId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getItemSalesReport(outletId, new Date(from), new Date(to));
  }

  @Get('kitchen')
  kitchen(
    @Query('outletId') outletId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getKitchenReport(outletId, new Date(from), new Date(to));
  }

  @Get('hourly')
  hourly(@Query('outletId') outletId: string, @Query('date') date: string) {
    return this.service.getHourlyOrders(outletId, new Date(date));
  }

  @Get('platform-summary')
  platformSummary(@Query('date') date?: string) {
    return this.service.getPlatformSummary(date ? new Date(date) : new Date());
  }

  @Get('platform-hourly')
  platformHourly(@Query('date') date?: string) {
    return this.service.getPlatformHourly(date ? new Date(date) : new Date());
  }
}
