import { Module } from '@nestjs/common';
import { CustomerDuesController } from './customer-dues.controller';
import { CustomerDuesService } from './customer-dues.service';

// Exports the service so OrdersModule can call recordOrderDebit /
// voidOrderDebit / assertCanPayLater from the order create + status
// transitions without re-implementing the ledger math.
@Module({
  controllers: [CustomerDuesController],
  providers: [CustomerDuesService],
  exports: [CustomerDuesService],
})
export class CustomerDuesModule {}
