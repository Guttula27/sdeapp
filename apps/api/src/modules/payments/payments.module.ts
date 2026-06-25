import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { OrdersModule } from '../orders/orders.module';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { RefundsModule } from '../refunds/refunds.module';
import { SplitBillsModule } from '../split-bills/split-bills.module';

@Module({
  imports: [
    OrdersModule,
    CustomerAlertsModule,
    PlatformSettingsModule,
    // Webhook handler calls RefundsService.markCompletedByGatewayRef
    // on refund.processed events. forwardRef breaks the otherwise
    // circular module graph (RefundsModule imports PaymentsModule for
    // RazorpayService).
    forwardRef(() => RefundsModule),
    // confirmPayment hooks SplitBillsService.applyShareSettled when
    // splitShareId is present. Same forwardRef pattern.
    forwardRef(() => SplitBillsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService],
  // Re-exported so cluster-orders can compose its Route-based checkout
  // on top of the same Razorpay client used for standard payments.
  exports: [RazorpayService],
})
export class PaymentsModule {}
