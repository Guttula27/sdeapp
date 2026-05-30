import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PricingService, QuoteInput } from './pricing.service';

@ApiTags('Pricing')
@Controller()
export class PricingController {
  constructor(private service: PricingService) {}

  // Single source of truth for the customer-side bill. The cart re-quotes on
  // every change — when items shift, when a coupon is picked, when reward
  // points are dialed up — and re-renders the breakdown.
  @Post('outlets/:outletId/cart/quote')
  quote(@Param('outletId') outletId: string, @Body() body: Omit<QuoteInput, 'outletId'>) {
    return this.service.quoteCart({ ...body, outletId });
  }
}
