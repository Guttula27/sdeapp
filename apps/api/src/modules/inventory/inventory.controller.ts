import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get('materials')
  getMaterials(@Query('businessId') businessId: string) {
    return this.service.getMaterials(businessId);
  }

  @Post('materials')
  createMaterial(@Query('businessId') businessId: string, @Body() body: any) {
    return this.service.createMaterial(businessId, body);
  }

  @Get('materials/low-stock')
  getLowStock(@Query('businessId') businessId: string) {
    return this.service.getLowStockAlerts(businessId);
  }

  @Post('materials/:id/consume')
  logConsumption(@Param('id') id: string, @Body() body: any) {
    return this.service.logConsumption(id, body);
  }

  @Get('purchase-orders')
  getPOs(@Query('businessId') businessId: string) {
    return this.service.getPurchaseOrders(businessId);
  }

  @Post('purchase-orders')
  createPO(@Body() body: any) {
    return this.service.createPurchaseOrder(body);
  }

  @Patch('purchase-orders/:id/receive')
  receivePO(@Param('id') id: string) {
    return this.service.receivePurchaseOrder(id);
  }
}
