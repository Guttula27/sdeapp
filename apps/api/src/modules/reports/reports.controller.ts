import { BadRequestException, Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { scopeFor } from '../../common/permissions/scope';

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Default range: last 30 days inclusive of today. Either bound is overridable.
function defaultRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return {
    from: parseDate(from) ?? start,
    to: parseDate(to) ?? now,
  };
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('revenue')
  revenue(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getRevenueReport(outletId, r.from, r.to);
  }

  @Get('item-sales')
  itemSales(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getItemSalesReport(outletId, r.from, r.to);
  }

  @Get('kitchen')
  kitchen(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getKitchenReport(outletId, r.from, r.to);
  }

  @Get('hourly')
  hourly(@Query('outletId') outletId: string, @Query('date') date?: string) {
    if (!outletId) throw new BadRequestException('outletId is required');
    return this.service.getHourlyOrders(outletId, parseDate(date) ?? new Date());
  }

  // ── GST report (CGST/SGST/IGST + per-rate slab + daily totals). The
  // output is the source of truth for filling out GSTR-1 — UI also
  // exposes a CSV export from this same response.
  @Get('gst')
  gst(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getGstReport(outletId, r.from, r.to);
  }

  // ── Category-level sales: category → subcategory → quantity / revenue.
  @Get('category-sales')
  categorySales(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getCategorySalesReport(outletId, r.from, r.to);
  }

  // ── Top customers by spend + new vs. repeat + lifetime-spend buckets.
  @Get('customers')
  customers(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getCustomerAnalytics(outletId, r.from, r.to);
  }

  // ── Discount + coupon + reward redemption totals for the period.
  @Get('discounts')
  discounts(
    @Query('outletId') outletId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!outletId) throw new BadRequestException('outletId is required');
    const r = defaultRange(from, to);
    return this.service.getDiscountUtilization(outletId, r.from, r.to);
  }

  // Platform-wide reports must not leak through to business/outlet/kitchen
  // tokens. A full responsibility-check layer isn't built yet; gate on
  // JWT scope (the seed defines VIEW_PLATFORM_REPORTS as platform-only).
  @Get('platform-summary')
  platformSummary(@CurrentUser() user: any, @Query('date') date?: string) {
    if (scopeFor(user).kind !== 'platform') {
      throw new ForbiddenException('Platform reports are restricted to platform admins');
    }
    return this.service.getPlatformSummary(parseDate(date) ?? new Date());
  }

  @Get('platform-hourly')
  platformHourly(@CurrentUser() user: any, @Query('date') date?: string) {
    if (scopeFor(user).kind !== 'platform') {
      throw new ForbiddenException('Platform reports are restricted to platform admins');
    }
    return this.service.getPlatformHourly(parseDate(date) ?? new Date());
  }
}
