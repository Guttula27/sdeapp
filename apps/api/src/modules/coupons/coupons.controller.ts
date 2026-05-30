import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller()
export class CouponsController {
  constructor(private service: CouponsService) {}

  // ─── Admin: business-scoped CRUD ────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('businesses/:businessId/coupons')
  list(@Param('businessId') businessId: string, @Query('outletId') outletId?: string) {
    return this.service.listForBusiness(businessId, outletId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('businesses/:businessId/coupons')
  create(@Param('businessId') businessId: string, @Body() body: any) {
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
  @Post('coupons/:id/quote')
  quote(
    @Param('id') id: string,
    @Body() body: { userId: string; billSubtotal: number },
  ) {
    return this.service.quote(id, body.userId, body.billSubtotal);
  }
}
