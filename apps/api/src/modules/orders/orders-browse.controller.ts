import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PreferredLanguage } from '../../common/language/preferred-language';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersBrowseController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Browse orders across outlets (read-only). Scope via query.' })
  findAll(
    @PreferredLanguage() lang: string | null,
    @Query('businessId') businessId?: string,
    @Query('outletId')   outletId?: string,
    @Query('status')     status?: OrderStatus,
    @Query('page')       page?: number,
    @Query('limit')      limit?: number,
  ) {
    return this.ordersService.findAllScoped({ businessId, outletId, status, page, limit }, lang);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    return this.ordersService.findOne(id, lang);
  }
}
