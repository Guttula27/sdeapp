import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { CouponsModule } from '../coupons/coupons.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { OffersModule } from '../offers/offers.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [CouponsModule, DiscountsModule, OffersModule, RewardsModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
