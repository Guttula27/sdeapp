import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayModule } from './razorpay.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { RefundsModule } from '../refunds/refunds.module';
import { SplitBillsModule } from '../split-bills/split-bills.module';

@Module({
  imports: [
    RazorpayModule,
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
  providers: [PaymentsService],
  // Re-export RazorpayModule so callers that historically imported
  // PaymentsModule for RazorpayService keep working without changes.
  exports: [RazorpayModule],
})
export class PaymentsModule {}
