import { Module } from '@nestjs/common';
import { ToppingsController } from './toppings.controller';
import { ToppingsService } from './toppings.service';

@Module({
  controllers: [ToppingsController],
  providers: [ToppingsService],
  exports: [ToppingsService],
})
export class ToppingsModule {}
