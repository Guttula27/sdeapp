import { Controller, Get, Post, Patch, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MenusService, TimingSlotInput } from './menus.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MenusController {
  constructor(private service: MenusService) {}

  @Get('businesses/:businessId/menus')
  list(@Param('businessId') businessId: string) {
    return this.service.listForBusiness(businessId);
  }

  // Declared before the generic `menus/:id` PATCH so the literal path wins
  // route matching even if NestJS shuffles registration order in the future.
  @Patch('businesses/:businessId/menus/reorder')
  reorder(
    @Param('businessId') businessId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.service.reorderBusinessMenus(businessId, body?.orderedIds ?? []);
  }

  @Post('businesses/:businessId/menus')
  create(
    @Param('businessId') businessId: string,
    @Body() body: { name: string; description?: string; isActive?: boolean },
  ) {
    return this.service.createForBusiness(businessId, body);
  }

  @Patch('menus/:id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; isActive?: boolean; displayOrder?: number },
  ) {
    return this.service.update(id, body);
  }

  @Delete('menus/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put('menus/:id/timings')
  replaceTimings(@Param('id') id: string, @Body() body: { slots: TimingSlotInput[] }) {
    return this.service.replaceTimings(id, body?.slots ?? []);
  }
}
