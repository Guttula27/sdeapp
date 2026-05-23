import { Module } from '@nestjs/common';
import { TableTypesController } from './table-types.controller';
import { TableTypesService } from './table-types.service';

@Module({
  controllers: [TableTypesController],
  providers: [TableTypesService],
  exports: [TableTypesService],
})
export class TableTypesModule {}
