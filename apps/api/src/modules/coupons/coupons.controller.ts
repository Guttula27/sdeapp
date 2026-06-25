import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Outlet operators can only see promotions for their own outlet (server-
// enforced regardless of the query value). Business / platform callers
// honour the query string so they can choose business-view vs a specific
// outlet-view from the scope picker on the admin page.
function effectiveOutletId(actor: any, queryOutletId?: string): string | undefined {
  if (actor?.outletId) return actor.outletId;
  return queryOutletId;
}

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller()
export class CouponsController {
  constructor(private service: CouponsService) {}

  // ─── Admin: business-scoped CRUD ────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('businesses/:businessId/coupons')
  list(
    @CurrentUser() actor: any,
    @Param('businessId') businessId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.service.listForBusiness(businessId, effectiveOutletId(actor, outletId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('businesses/:businessId/coupons')
  create(
    @CurrentUser() actor: any,
    @Param('businessId') businessId: string,
    @Body() body: any,
  ) {
    // Outlet operator can only create promos for their own outlet —
    // override whatever they sent in the body.
    if (actor?.outletId) body = { ...body, outletId: actor.outletId };
    return this.service.create(businessId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('coupons/:id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('coupons/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('coupons/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── Customer: visible coupons for an outlet ────────────────────
  @Get('outlets/:outletId/coupons/available')
  available(@Param('outletId') outletId: string, @Query('userId') userId?: string) {
    return this.service.availableFor(outletId, userId);
  }

  // ─── Admin helper: look up user ids from phone numbers ─────────
  @UseGuards(JwtAuthGuard)
  @Post('coupons/lookup-customers')
  lookupCustomers(@Body() body: { phones: string[] }) {
    return this.service.lookupByPhones(body.phones || []);
  }

  // ─── Customer: quote a coupon against a bill (preview discount) ─
  // ALLOWANCE coupons require `cart` (per-line item/sub/cat ids + qty +
  // unitPrice). `outletId` is also required for ALLOWANCE TAG targeting
  // so the service can look up the caller's tag assignment at the right
  // outlet. STANDARD coupons ignore both.
  @Post('coupons/:id/quote')
  quote(
    @Param('id') id: string,
    @Body() body: {
      userId: string;
      billSubtotal: number;
      outletId?: string;
      cart?: Array<{
        itemId: string;
        subcategoryId: string;
        categoryId: string;
        qty: number;
        unitPrice: number;
      }>;
    },
  ) {
    return this.service.quote(id, body.userId, body.billSubtotal, body.cart, body.outletId);
  }
}
