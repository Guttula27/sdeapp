import { Controller, Post, Get, Param, Body, Headers, Req, UseGuards } from '@nestjs/common';
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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('razorpay/order')
  razorpayOrder(@Body('paymentId') paymentId: string) {
    return this.service.createRazorpayOrder(paymentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('razorpay/verify')
  razorpayVerify(@Body() body: {
    paymentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    return this.service.verifyRazorpayPayment(body);
  }

  @Public()
  @Post('webhooks/razorpay')
  razorpayWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: any,
  ) {
    const raw = req?.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(payload);
    return this.service.handleRazorpayWebhook(payload, signature || '', raw);
  }
}
