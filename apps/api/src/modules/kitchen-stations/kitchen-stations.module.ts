import { Module } from '@nestjs/common';
import { KitchenStationsController } from './kitchen-stations.controller';
import { KitchenStationsService } from './kitchen-stations.service';

@Module({
  controllers: [KitchenStationsController],
  providers: [KitchenStationsService],
  exports: [KitchenStationsService],
})
export class KitchenStationsModule {}
