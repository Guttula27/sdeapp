import { Controller, Get, Patch, Put, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MenusService, TimingSlotInput } from './menus.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Outlet Menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/menus')
export class OutletMenusController {
  constructor(private service: MenusService) {}

  @Get()
  list(@Param('outletId') outletId: string, @Query('tableId') tableId?: string) {
    return this.service.listForOutlet(outletId, tableId);
  }

  // Outlet-admin create: scoped to the outlet's business; auto-enabled here.
  @Post()
  create(
    @Param('outletId') outletId: string,
    @Body() body: { name: string; description?: string; isActive?: boolean },
  ) {
    return this.service.createForOutlet(outletId, body);
  }

  @Patch(':menuId')
  toggle(
    @Param('outletId') outletId: string,
    @Param('menuId') menuId: string,
    @Body() body: { isEnabled?: boolean; overrideTimings?: boolean },
  ) {
    return this.service.toggleOutletMenu(outletId, menuId, body);
  }

  @Put(':menuId/timings')
  replaceTimings(
    @Param('outletId') outletId: string,
    @Param('menuId') menuId: string,
    @Body() body: { slots: TimingSlotInput[] },
  ) {
    return this.service.replaceOutletTimings(outletId, menuId, body?.slots ?? []);
  }

  @Post(':menuId/import')
  import(@Param('outletId') outletId: string, @Param('menuId') menuId: string) {
    return this.service.importMenuToOutlet(outletId, menuId);
  }
}
