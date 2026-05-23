import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerAlertsService } from './customer-alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Customer Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customer-alerts')
export class CustomerAlertsController {
  constructor(private service: CustomerAlertsService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.service.list(user.id, {
      unreadOnly: unread === '1' || unread === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.service.unreadCount(user.id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: any) {
    return this.service.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }
}
