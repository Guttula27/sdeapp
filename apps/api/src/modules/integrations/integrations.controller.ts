import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IntegrationChannel } from '@prisma/client';
import { IntegrationsService, UpsertIntegrationDto } from './integrations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}

  // Customer app reads the active payment gateway + per-mode surcharge map
  // before showing the payment picker. Public so unauthenticated customers
  // can still see the surcharge before logging in. Static path declared before
  // the dynamic `:id` route below.
  @Public()
  @Get('payment-gateway/active')
  activePaymentGateway() {
    return this.service.activePaymentGateway();
  }

  @Get()
  list(@Query('channel') channel?: IntegrationChannel) {
    return this.service.list(channel);
  }

  @Post()
  upsert(@Body() dto: UpsertIntegrationDto) {
    return this.service.upsert(dto);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.service.setDefault(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
