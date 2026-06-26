import { Module } from '@nestjs/common';
import { CustomerDuesController, CustomerDuesMeController } from './customer-dues.controller';
import { CustomerDuesService } from './customer-dues.service';
import { PaymentsModule } from '../payments/payments.module';

// Exports the service so OrdersModule can call recordOrderDebit /
// voidOrderDebit / assertCanPayLater from the order create + status
// transitions without re-implementing the ledger math.
@Module({
  imports: [PaymentsModule],
  controllers: [CustomerDuesController, CustomerDuesMeController],
  providers: [CustomerDuesService],
  exports: [CustomerDuesService],
})
export class CustomerDuesModule {}
