import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outlets/:outletId/customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()
  list(@Param('outletId') outletId: string) {
    return this.service.list(outletId);
  }

  @Get(':userId/orders')
  listOrders(
    @Param('outletId') outletId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.listOrders(outletId, userId);
  }

  // Per-outlet aggregate stats for the order-detail recognition pill.
  @Get(':userId/insights')
  insights(
    @Param('outletId') outletId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.insights(outletId, userId);
  }

  @Post()
  add(
    @Param('outletId') outletId: string,
    @Body() body: { name?: string; phone: string },
  ) {
    return this.service.addCustomer(outletId, body);
  }

  @Put(':userId/tag')
  setTag(
    @Param('outletId') outletId: string,
    @Param('userId') userId: string,
    @Body() body: { tagId: string | null },
  ) {
    return this.service.setTag(outletId, userId, body.tagId ?? null);
  }
}
