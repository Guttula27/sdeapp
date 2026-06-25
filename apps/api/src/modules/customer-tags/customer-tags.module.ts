import { Module } from '@nestjs/common';
import { CustomerTagsController } from './customer-tags.controller';
import { CustomerTagsService } from './customer-tags.service';
import { MenuModule } from '../menu/menu.module';

@Module({
  // Need MenuService here so price-override writes can bust the
  // outlet's menu-tree cache; otherwise the admin re-fetch reads
  // stale customerTagPrices and the edit looks like it didn't save.
  imports: [MenuModule],
  controllers: [CustomerTagsController],
  providers: [CustomerTagsService],
  exports: [CustomerTagsService],
})
export class CustomerTagsModule {}
