import { Module } from '@nestjs/common';
import { PrintersController } from './printers.controller';
import { KitchenReceiptsController } from './kitchen-receipts.controller';
import { PrintersService } from './printers.service';

@Module({
  controllers: [PrintersController, KitchenReceiptsController],
  providers: [PrintersService],
  exports: [PrintersService],
})
export class PrintersModule {}
