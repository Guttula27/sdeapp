import { Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';

/**
 * Thin module wrapper around RazorpayService. Exists so any module
 * that just needs the Razorpay client (cluster orders, customer-side
 * dues settlement) can import it without pulling in PaymentsModule's
 * full graph — PaymentsModule imports OrdersModule and back, so
 * importing PaymentsModule from inside the OrdersModule subtree
 * creates an unresolvable cycle.
 *
 * RazorpayService has no Nest deps of its own (it reads env vars and
 * lazily constructs the Razorpay client), so this module imports
 * nothing.
 */
@Module({
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class RazorpayModule {}
