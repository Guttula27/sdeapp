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
  // manual-print button). Pass ?itemId=<orderItemId> to get a single-line
  // receipt for just that order item — used by the kitchen card's per-
  // item print button so staff can hand off a token-tagged slip for any
  // line, not only ones flagged printSeparately. Returns [] if the
  // filter matches nothing.
  @Get('order/:orderId')
  forOrder(
    @Param('orderId') orderId: string,
    @Query('stationId') stationId?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.printers.buildKitchenReceipts(orderId, { stationId, itemId });
  }
}
