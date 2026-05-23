import { Module } from '@nestjs/common';
import { CustomerTagsController } from './customer-tags.controller';
import { CustomerTagsService } from './customer-tags.service';

@Module({
  controllers: [CustomerTagsController],
  providers: [CustomerTagsService],
  exports: [CustomerTagsService],
})
export class CustomerTagsModule {}
