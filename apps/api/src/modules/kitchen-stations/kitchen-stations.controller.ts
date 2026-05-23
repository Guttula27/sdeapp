import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { KitchenStationsService } from './kitchen-stations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('KitchenStations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/kitchen-stations')
export class KitchenStationsController {
  constructor(private service: KitchenStationsService) {}

  @Get()
  list(@Param('outletId') outletId: string) {
    return this.service.list(outletId);
  }

  @Get('staff')
  listStaff(@Param('outletId') outletId: string) {
    return this.service.listOutletStaff(outletId);
  }

  @Get('mine')
  mine(@Param('outletId') outletId: string, @CurrentUser('id') userId: string) {
    return this.service.findMine(outletId, userId);
  }

  @Post()
  create(@Param('outletId') outletId: string, @Body() body: { name: string }) {
    return this.service.create(outletId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; currentWorkerId?: string | null; isMaster?: boolean },
  ) {
    return this.service.update(id, body);
  }

  @Patch(':id/items')
  setItems(@Param('id') id: string, @Body() body: { itemIds: string[] }) {
    return this.service.setItems(id, body.itemIds);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
