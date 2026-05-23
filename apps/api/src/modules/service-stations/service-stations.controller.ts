import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServiceStationsService } from './service-stations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('ServiceStations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/service-stations')
export class ServiceStationsController {
  constructor(private service: ServiceStationsService) {}

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
    return this.service.mine(outletId, userId);
  }

  @Get('tables-by-type')
  listTables(
    @Param('outletId') outletId: string,
    @Query('tableTypeId') tableTypeId: string,
  ) {
    return this.service.listTablesForType(outletId, tableTypeId);
  }

  @Post()
  create(
    @Param('outletId') outletId: string,
    @Body() body: { name: string; tableTypeId?: string | null },
  ) {
    return this.service.create(outletId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; tableTypeId?: string | null },
  ) {
    return this.service.update(id, body);
  }

  @Put(':id/workers')
  setWorkers(@Param('id') id: string, @Body() body: { userIds: string[] }) {
    return this.service.setWorkers(id, body.userIds || []);
  }

  @Put(':id/tables')
  setTables(@Param('id') id: string, @Body() body: { tableIds: string[] }) {
    return this.service.setTables(id, body.tableIds || []);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
