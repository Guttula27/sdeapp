import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentMode, RefundStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RefundsService } from './refunds.service';

@ApiTags('Refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/refunds')
export class RefundsController {
  constructor(private service: RefundsService) {}

  // Initiate against an order. The order-id lives in the body so this
  // endpoint can sit at the per-outlet base; saves a separate route
  // shape and keeps audit trails grouped under the outlet.
  @Post()
  initiate(
    @Body() body: { orderId: string; amount: number; paymentId?: string; mode?: PaymentMode; reason?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.initiate(
      body.orderId,
      { amount: body.amount, paymentId: body.paymentId, mode: body.mode, reason: body.reason },
      userId,
    );
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.approve(id, userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.cancel(id, userId);
  }

  @Get()
  list(
    @Param('outletId') outletId: string,
    @Query('status') status?: RefundStatus,
  ) {
    return this.service.listForOutlet(outletId, status);
  }

  @Get('order/:orderId')
  listForOrder(@Param('orderId') orderId: string) {
    return this.service.listForOrder(orderId);
  }
}
