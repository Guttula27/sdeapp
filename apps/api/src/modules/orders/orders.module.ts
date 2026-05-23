import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersBrowseController } from './orders-browse.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './orders.gateway';
import { CustomerAlertsModule } from '../customer-alerts/customer-alerts.module';

@Module({
  imports: [forwardRef(() => CustomerAlertsModule)],
  controllers: [OrdersBrowseController, OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
