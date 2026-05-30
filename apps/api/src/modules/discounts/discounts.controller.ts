import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DiscountsService } from './discounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Discounts')
@ApiBearerAuth()
@Controller()
export class DiscountsController {
  constructor(private service: DiscountsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('businesses/:businessId/discounts')
  list(@Param('businessId') businessId: string, @Query('outletId') outletId?: string) {
    return this.service.listForBusiness(businessId, outletId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('businesses/:businessId/discounts')
  create(@Param('businessId') businessId: string, @Body() body: any) {
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
