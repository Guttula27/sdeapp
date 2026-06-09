import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { OrdersModule } from '../orders/orders.module';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [OrdersModule, CustomerAlertsModule, PlatformSettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService],
  // Re-exported so cluster-orders can compose its Route-based checkout
  // on top of the same Razorpay client used for standard payments.
  exports: [RazorpayService],
})
export class PaymentsModule {}
