import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DiscountsService } from './discounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Outlet operators always scope to their own outlet — server-enforced
// regardless of what the query string says.
function effectiveOutletId(actor: any, queryOutletId?: string): string | undefined {
  if (actor?.outletId) return actor.outletId;
  return queryOutletId;
}

@ApiTags('Discounts')
@ApiBearerAuth()
@Controller()
export class DiscountsController {
  constructor(private service: DiscountsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('businesses/:businessId/discounts')
  list(
    @CurrentUser() actor: any,
    @Param('businessId') businessId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.service.listForBusiness(businessId, effectiveOutletId(actor, outletId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('businesses/:businessId/discounts')
  create(
    @CurrentUser() actor: any,
    @Param('businessId') businessId: string,
    @Body() body: any,
  ) {
    if (actor?.outletId) body = { ...body, outletId: actor.outletId };
    return this.service.create(businessId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('discounts/:id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('discounts/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('discounts/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Auto-applying discounts active right now at this outlet (for pricing).
  @Get('outlets/:outletId/discounts/active')
  active(@Param('outletId') outletId: string) {
    return this.service.activeAutoForOutlet(outletId);
  }

  // Preconfigured counter discounts the cashier can pick from.
  @UseGuards(JwtAuthGuard)
  @Get('outlets/:outletId/discounts/manual')
  manual(@Param('outletId') outletId: string) {
    return this.service.manualForOutlet(outletId);
  }
}
