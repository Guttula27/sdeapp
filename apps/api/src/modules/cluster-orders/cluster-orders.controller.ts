import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ClusterOrdersService } from './cluster-orders.service';
import { CreateClusterOrderDto, VerifyClusterPaymentDto } from './dto/create-cluster-order.dto';

@ApiTags('Cluster Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cluster-orders')
export class ClusterOrdersController {
  constructor(private service: ClusterOrdersService) {}

  // Place a cluster checkout — returns the Razorpay Route order details so
  // the client can open the gateway. In stub / bypass-only test mode the
  // returned `razorpay` block is fake but the cluster order is real.
  // Idempotent: a retried POST with the same Idempotency-Key returns the
  // original cluster order, preventing duplicate child orders.
  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  create(@Body() dto: CreateClusterOrderDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub || req.user?.id);
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post(':id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyClusterPaymentDto) {
    return this.service.verify(id, dto);
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post(':id/bypass')
  bypass(@Param('id') id: string) {
    return this.service.bypass(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Customer-scoped list — used by the orders/active list on the customer
  // app so the user can see all their cluster orders in one place.
  @Get('customer/me')
  listMine(@Req() req: any) {
    return this.service.listForCustomer(req.user?.sub || req.user?.id);
  }
}
