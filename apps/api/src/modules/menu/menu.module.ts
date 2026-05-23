import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { BusinessMenuController } from './business-menu.controller';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuController, BusinessMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
