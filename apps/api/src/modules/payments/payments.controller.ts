import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentMode } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@Body() body: { orderId: string; mode: PaymentMode; amount: number }) {
    return this.service.initiatePayment(body.orderId, body.mode, body.amount);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body('gatewayRef') gatewayRef: string) {
    return this.service.confirmPayment(id, gatewayRef);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  getByOrder(@Param('orderId') orderId: string) {
    return this.service.getPaymentsByOrder(orderId);
  }

  @Public()
  @Post('webhooks/razorpay')
  razorpayWebhook(@Body() payload: any) {
    const signature = '';
    return this.service.handleRazorpayWebhook(payload, signature);
  }
}
