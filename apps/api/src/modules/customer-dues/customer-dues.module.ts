import { Module } from '@nestjs/common';
import { CustomerDuesController, CustomerDuesMeController } from './customer-dues.controller';
import { CustomerDuesService } from './customer-dues.service';
import { RazorpayModule } from '../payments/razorpay.module';

// Exports the service so OrdersModule can call recordOrderDebit /
// voidOrderDebit / assertCanPayLater from the order create + status
// transitions without re-implementing the ledger math.
//
// We import RazorpayModule (a thin standalone module that only
// provides RazorpayService) rather than PaymentsModule. Importing
// PaymentsModule from inside the OrdersModule subtree creates a
// cycle: PaymentsModule itself imports OrdersModule for confirm-time
// hooks. RazorpayModule has no module deps, so it breaks cleanly.
@Module({
  imports: [RazorpayModule],
  controllers: [CustomerDuesController, CustomerDuesMeController],
  providers: [CustomerDuesService],
  exports: [CustomerDuesService],
})
export class CustomerDuesModule {}
