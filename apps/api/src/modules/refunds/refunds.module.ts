import { Module, forwardRef } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { PaymentsModule } from '../payments/payments.module';
import { CryptoModule } from '../../config/crypto/crypto.module';

// PaymentsModule is wrapped in forwardRef because PaymentsService's
// webhook handler turns around and calls back into RefundsService when
// Razorpay fires refund.processed / refund.failed. Without forwardRef
// the two modules can't both `imports:` each other.
@Module({
  imports: [forwardRef(() => PaymentsModule), CryptoModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
