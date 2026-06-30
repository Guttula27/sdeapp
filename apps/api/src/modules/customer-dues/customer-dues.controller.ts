import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerDuesService } from './customer-dues.service';
import { PrismaService } from '../../config/prisma/prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
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
    private razorpay: RazorpayService,
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

  // ─── Self-settle (customer-driven) ──────────────────────────────
  // The customer pays their own dues from the PWA. Two rails:
  //   1) Razorpay (preferred — server-verifiable signature)
  //   2) UPI deeplink + reported txn id (less trusted; logged for audit)
  //
  // Auth: any JWT-authenticated user can settle THEIR OWN dues. We
  // gate by actor.id === userId; the SETTLE_CUSTOMER_DUES permission
  // is NOT required here because the customer is paying their own
  // money — distinct from the admin path that records a settlement
  // on someone else's behalf.

  /**
   * Step 1 of the Razorpay self-settle path. Creates a Razorpay
   * checkout order for the chosen amount. The PWA opens
   * window.Razorpay() with the returned orderId; the verify endpoint
   * (step 2) writes the settlement once the gateway confirms.
   */
  @Post('me/settle/razorpay-order')
  async selfSettleRazorpayOrder(
    @CurrentUser() actor: any,
    @Param('outletId') outletId: string,
    @Body() body: { amount: number },
  ) {
    if (!actor?.id) throw new ForbiddenException('Authentication required');
    if (!Number.isFinite(body?.amount) || body.amount <= 0) {
      throw new BadRequestException('Amount must be > 0');
    }
    // Re-check balance server-side. Spending more than owed shouldn't
    // create a Razorpay order — we'd have nowhere to credit the surplus.
    const balance = await this.service.getBalance(actor.id, outletId);
    if (balance <= 0) throw new BadRequestException('No dues outstanding at this outlet');
    if (body.amount - balance > 0.01) {
      throw new BadRequestException(`Amount exceeds outstanding balance (₹${balance.toFixed(2)})`);
    }
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const order = await this.razorpay.createOrder({
      amountInRupees: body.amount,
      // Razorpay receipts are <= 40 chars and must be unique-ish;
      // we use 'DUES-<userId-suffix>-<ts>'.
      receipt: `DUES-${actor.id.slice(-6)}-${Date.now()}`.slice(0, 40),
      notes: { userId: actor.id, outletId, kind: 'CUSTOMER_DUES_SETTLE' },
    });
    return {
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID || '',
    };
  }

  /**
   * Step 2: verify the Razorpay signature and write the settlement +
   * CREDIT ledger row. The PWA passes (orderId, paymentId, signature)
   * from the Razorpay handler callback. Signature mismatch → 400; the
   * settlement is never written.
   */
  @Post('me/settle/razorpay-verify')
  async selfSettleRazorpayVerify(
    @CurrentUser() actor: any,
    @Param('outletId') outletId: string,
    @Body() body: {
      amount: number;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    if (!actor?.id) throw new ForbiddenException('Authentication required');
    if (!body?.razorpayOrderId || !body?.razorpayPaymentId || !body?.razorpaySignature) {
      throw new BadRequestException('razorpayOrderId, razorpayPaymentId, razorpaySignature are required');
    }
    const ok = this.razorpay.verifyHandlerSignature(
      body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature,
    );
    if (!ok) throw new BadRequestException('Razorpay signature verification failed');

    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    return this.service.settle({
      userId:     actor.id,
      businessId: outlet.businessId,
      outletId,
      amount:     body.amount,
      paymentMode: 'RAZORPAY',
      reference:  body.razorpayPaymentId,
      notes:      'Self-settle via Razorpay',
      settledBy:  actor.id,
    });
  }

  /**
   * UPI deeplink path. The customer opens their UPI app via a
   * `upi://pay?...` link, completes payment, and reports the txn id
   * back. We DO NOT verify the UPI payment server-side here (no
   * Razorpay signature); the txn id is logged for audit + future
   * reconciliation. Admins can void this settlement from the
   * Receivable tab if the bank reconciliation shows the UPI payment
   * never landed.
   */
  @Post('me/settle/upi-reported')
  async selfSettleUpiReported(
    @CurrentUser() actor: any,
    @Param('outletId') outletId: string,
    @Body() body: { amount: number; upiTxnId: string },
  ) {
    if (!actor?.id) throw new ForbiddenException('Authentication required');
    if (!body?.upiTxnId?.trim()) {
      throw new BadRequestException('UPI transaction id is required');
    }
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { businessId: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    return this.service.settle({
      userId:     actor.id,
      businessId: outlet.businessId,
      outletId,
      amount:     body.amount,
      paymentMode: 'UPI',
      reference:  body.upiTxnId.trim(),
      notes:      'Self-settle via UPI deeplink (customer-reported)',
      settledBy:  actor.id,
    });
  }
}

/**
 * Separate controller for the cross-outlet customer view — kept off
 * the outlet-scoped route so the PWA can render a "my dues across
 * every outlet I've ordered at" screen with one call.
 */
@ApiTags('Customer dues (me)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dues/me')
export class CustomerDuesMeController {
  constructor(private service: CustomerDuesService) {}

  @Get()
  listMy(@CurrentUser() actor: any) {
    if (!actor?.id) throw new ForbiddenException('Authentication required');
    return this.service.listMyDues(actor.id);
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
