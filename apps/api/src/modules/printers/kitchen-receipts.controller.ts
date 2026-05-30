import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('KitchenReceipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kitchen-receipts')
export class KitchenReceiptsController {
  constructor(private printers: PrintersService) {}

  // Returns one receipt per station that has items in this order. Pass
  // ?stationId=… to get just that station's slice (used by the per-station
  // manual-print button). Returns [] if the order has no items routed to
  // any station — caller can show a friendly empty-state.
  @Get('order/:orderId')
  forOrder(@Param('orderId') orderId: string, @Query('stationId') stationId?: string) {
    return this.printers.buildKitchenReceipts(orderId, { stationId });
  }
}
