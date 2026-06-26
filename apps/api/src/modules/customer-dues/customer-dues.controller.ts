import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerDuesService } from './customer-dues.service';
import { PrismaService } from '../../config/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertResponsibility } from '../../common/permissions/responsibility';

/**
 * Customer dues admin surface. All routes are JWT-protected; settle is
 * additionally gated by the SETTLE_CUSTOMER_DUES responsibility (money-
 * handling action, deserves its own audit trail).
 */
@ApiTags('Customer dues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/dues')
export class CustomerDuesController {
  constructor(
    private service: CustomerDuesService,
    private prisma: PrismaService,
  ) {}

  /** Customer's outstanding balance at this outlet. */
  @Get('balance/:userId')
  balance(@Param('outletId') outletId: string, @Param('userId') userId: string) {
    return this.service.getBalance(userId, outletId).then((amount) => ({ amount }));
  }

  /**
   * Receivables view. Accepts two independent date windows:
   *   - ordersFrom / ordersTo: aggregates DEBITs (charges) in range
   *   - settlementsFrom / settlementsTo: aggregates CREDITs (payments) in range
   * Both are optional; omitting a pair yields 0 for that column.
   *
   * currentBalance is always "now"; period filters never affect it.
   */
  @Get('receivable')
  receivable(
    @Param('outletId') outletId: string,
    @Query('ordersFrom')      ordersFrom?: string,
    @Query('ordersTo')        ordersTo?: string,
    @Query('settlementsFrom') settlementsFrom?: string,
    @Query('settlementsTo')   settlementsTo?: string,
  ) {
    return this.service.listReceivables(outletId, {
      ordersFrom:      parseDate(ordersFrom),
      ordersTo:        parseDate(ordersTo, true),
      settlementsFrom: parseDate(settlementsFrom),
      settlementsTo:   parseDate(settlementsTo, true),
    });
  }

  /** Drill-down: full ledger trail for one customer at this outlet. */
  @Get('ledger/:userId')
  ledger(
    @Param('outletId') outletId: string,
    @Param('userId')   userId: string,
    @Query('limit')    limit?: string,
  ) {
    return this.service.listLedger(userId, outletId, limit ? Number(limit) : 50);
  }

  /**
   * Settle dues for a customer. Permission-gated. Caller may pass less
   * than the outstanding balance (partial settle is supported); the
   * service rejects amounts greater than balance to keep the ledger
   * non-negative.
   */
  @Post('settle')
  async settle(
    @CurrentUser() actor: any,
    @Param('outletId') outletId: string,
    @Body() body: {
      userId: string;
      amount: number;
      paymentMode: string;
      reference?: string;
      notes?: string;
    },
  ) {
    assertResponsibility(actor, 'SETTLE_CUSTOMER_DUES');
    if (!body?.userId)      throw new BadRequestException('userId is required');
    if (!body?.paymentMode) throw new BadRequestException('paymentMode is required');
    // Look up the outlet's business id so the ledger row carries it
    // (used by business-level reporting later — avoids a join on every
    // receivables query).
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    return this.service.settle({
      userId:     body.userId,
      businessId: outlet.businessId,
      outletId,
      amount:     body.amount,
      paymentMode: body.paymentMode,
      reference:  body.reference,
      notes:      body.notes,
      settledBy:  actor?.id,
    });
  }

  /**
   * Customer-facing lookup used by the PWA to decide whether to show
   * the "Pay later?" prompt at checkout. Returns shape:
   *   { allowPayLater, currentBalance, ceiling, tagName }
   * Always JWT-required — caller must be the authenticated customer.
   */
  @Get('me/:userId')
  lookupForCustomer(@Param('outletId') outletId: string, @Param('userId') userId: string) {
    return this.service.lookupPayLater(userId, outletId);
  }
}

// Local helper: parse a YYYY-MM-DD query into a Date. When `endOfDay`
// is true, advance to 23:59:59.999 so the inclusive filter covers
// the whole day. Returns undefined for missing / invalid input
// (which the service treats as "no bound").
function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}
