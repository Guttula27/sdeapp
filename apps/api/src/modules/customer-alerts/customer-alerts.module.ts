import { Module, forwardRef } from '@nestjs/common';
import { CustomerAlertsController } from './customer-alerts.controller';
import { CustomerAlertsService } from './customer-alerts.service';
import { LifecycleDispatcherService } from './lifecycle-dispatcher.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => OrdersModule)],
  controllers: [CustomerAlertsController],
  providers: [CustomerAlertsService, LifecycleDispatcherService],
  exports: [CustomerAlertsService, LifecycleDispatcherService],
})
export class CustomerAlertsModule {}
