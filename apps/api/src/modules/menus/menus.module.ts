import { Module } from '@nestjs/common';
import { MenusController } from './menus.controller';
import { OutletMenusController } from './outlet-menus.controller';
import { MenusService } from './menus.service';

@Module({
  controllers: [MenusController, OutletMenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
