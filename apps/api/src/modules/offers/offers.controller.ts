import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Offers')
@ApiBearerAuth()
@Controller()
export class OffersController {
  constructor(private service: OffersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('businesses/:businessId/offers')
  list(@Param('businessId') businessId: string, @Query('outletId') outletId?: string) {
    return this.service.listForBusiness(businessId, outletId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('businesses/:businessId/offers')
  create(@Param('businessId') businessId: string, @Body() body: any) {
    return this.service.create(businessId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('offers/:id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('offers/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('offers/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Active offers right now at this outlet (for the cart freebie engine).
  @Get('outlets/:outletId/offers/active')
  active(@Param('outletId') outletId: string) {
    return this.service.activeForOutlet(outletId);
  }
}
