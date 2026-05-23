import { Module } from '@nestjs/common';
import { ServiceStationsController } from './service-stations.controller';
import { ServiceStationsService } from './service-stations.service';

@Module({
  controllers: [ServiceStationsController],
  providers: [ServiceStationsService],
  exports: [ServiceStationsService],
})
export class ServiceStationsModule {}
