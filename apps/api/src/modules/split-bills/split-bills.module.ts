import { Module, forwardRef } from '@nestjs/common';
import { SplitBillsController } from './split-bills.controller';
import { SplitBillsService } from './split-bills.service';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    CustomerAlertsModule,
    // PaymentsService imports SplitBillsService for the
    // post-confirmation hook; forwardRef breaks the cycle.
    forwardRef(() => PaymentsModule),
  ],
  controllers: [SplitBillsController],
  providers: [SplitBillsService],
  exports: [SplitBillsService],
})
export class SplitBillsModule {}
