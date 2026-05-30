import { Module } from '@nestjs/common';
import { ClusterOrdersController } from './cluster-orders.controller';
import { ClusterOrdersService } from './cluster-orders.service';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [OrdersModule, PaymentsModule, RewardsModule],
  controllers: [ClusterOrdersController],
  providers: [ClusterOrdersService],
})
export class ClusterOrdersModule {}
