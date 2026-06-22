import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PreferredLanguage } from '../../common/language/preferred-language';

// Staff browse paths — heavy read endpoints that admins poll while
// running service. The global 100/min bucket would penalise a busy
// service-desk operator hopping between tabs; Phase 5 will give these
// their own bucket. For now skip — JwtAuthGuard already gates access.
@SkipThrottle()
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
    @Query('search')     search?: string,
    @Query('sortBy')     sortBy?: 'createdAt' | 'totalAmount' | 'orderNumber' | 'status',
    @Query('sortDir')    sortDir?: 'asc' | 'desc',
  ) {
    return this.ordersService.findAllScoped(
      { businessId, outletId, status, page, limit, search, sortBy, sortDir },
      lang,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @PreferredLanguage() lang: string | null) {
    return this.ordersService.findOne(id, lang);
  }
}
