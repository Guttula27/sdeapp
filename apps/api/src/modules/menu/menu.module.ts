import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { BusinessMenuController } from './business-menu.controller';
import { MenuService } from './menu.service';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [DiscountsModule],
  controllers: [MenuController, BusinessMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
