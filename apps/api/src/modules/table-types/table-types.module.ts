import { Module } from '@nestjs/common';
import { TableTypesController } from './table-types.controller';
import { TableTypesService } from './table-types.service';
import { MenuModule } from '../menu/menu.module';

@Module({
  // MenuService needed so price-override writes can bust the outlet's
  // menu-tree cache; otherwise the admin's re-fetch shows stale prices.
  imports: [MenuModule],
  controllers: [TableTypesController],
  providers: [TableTypesService],
  exports: [TableTypesService],
})
export class TableTypesModule {}
