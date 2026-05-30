import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersBrowseController } from './orders-browse.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './orders.gateway';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';
import { PricingModule } from '../pricing/pricing.module';
import { RewardsModule } from '../rewards/rewards.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ServiceStationsModule } from '../service-stations/service-stations.module';

@Module({
  imports: [
    forwardRef(() => CustomerAlertsModule),
    PricingModule,
    RewardsModule,
    CouponsModule,
    ServiceStationsModule,
  ],
  controllers: [OrdersBrowseController, OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
