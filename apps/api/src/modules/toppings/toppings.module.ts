import { Module } from '@nestjs/common';
import { ToppingsController } from './toppings.controller';
import { ToppingsService } from './toppings.service';
import { MenuModule } from '../menu/menu.module';

@Module({
  // MenuService for menu-cache invalidation after item-topping writes
  // — itemToppings live in the cached menu tree.
  imports: [MenuModule],
  controllers: [ToppingsController],
  providers: [ToppingsService],
  exports: [ToppingsService],
})
export class ToppingsModule {}
