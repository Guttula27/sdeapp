import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OrdersModule } from '../orders/orders.module';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';

@Module({
  imports: [OrdersModule, CustomerAlertsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
