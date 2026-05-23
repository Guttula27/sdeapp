import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TableTypesService } from './table-types.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('TableTypes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/table-types')
export class TableTypesController {
  constructor(private service: TableTypesService) {}

  @Get()
  list(@Param('outletId') outletId: string) {
    return this.service.list(outletId);
  }

  @Post()
  create(@Param('outletId') outletId: string, @Body() body: { name: string; color?: string }) {
    return this.service.create(outletId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; color?: string }) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Put(':tableTypeId/prices/:itemId')
  setItemPrice(
    @Param('tableTypeId') tableTypeId: string,
    @Param('itemId') itemId: string,
    @Query('variantId') variantId: string | undefined,
    @Body() body: { price: number; gstRate?: number | null },
  ) {
    const gst = body.gstRate === undefined ? undefined : body.gstRate === null ? null : Number(body.gstRate);
    return this.service.setItemPrice(tableTypeId, itemId, Number(body.price), variantId, gst);
  }

  @Delete(':tableTypeId/prices/:itemId')
  clearItemPrice(
    @Param('tableTypeId') tableTypeId: string,
    @Param('itemId') itemId: string,
    @Query('variantId') variantId: string | undefined,
  ) {
    return this.service.clearItemPrice(tableTypeId, itemId, variantId);
  }

  @Post(':tableTypeId/tables')
  addTable(
    @Param('outletId') outletId: string,
    @Param('tableTypeId') tableTypeId: string,
    @Body() body: { number: string; capacity?: number },
  ) {
    return this.service.addTable(outletId, tableTypeId, body);
  }

  @Delete('tables/:tableId')
  removeTable(@Param('tableId') tableId: string) {
    return this.service.removeTable(tableId);
  }
}
