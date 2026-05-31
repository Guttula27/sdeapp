import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  @Public()
  @Get('plans')
  getPlans() {
    return this.service.getPlans();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('plans')
  createPlan(@Body() body: any) {
    return this.service.createPlan(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@Body() body: { businessId: string; planId: string; billing: 'MONTHLY' | 'ANNUAL' }) {
    return this.service.subscribe(body.businessId, body.planId, body.billing);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('business/:businessId')
  getSubscription(@Param('businessId') businessId: string) {
    return this.service.getBusinessSubscription(businessId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('invoices')
  getInvoices(@CurrentUser() user: any, @Query('businessId') businessId?: string) {
    // Business-tier callers default to their own businessId from the JWT;
    // platform callers must pass ?businessId=… explicitly.
    return this.service.getInvoices(businessId || user?.businessId);
  }
}
