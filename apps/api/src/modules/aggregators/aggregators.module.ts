import { Module } from '@nestjs/common';
import { AggregatorsController } from './aggregators.controller';
import { AggregatorsService } from './aggregators.service';
import { ZomatoAdapter } from './adapters/zomato.adapter';
import { SwiggyAdapter } from './adapters/swiggy.adapter';
import { UberEatsAdapter } from './adapters/uber-eats.adapter';
import { CryptoModule } from '../../config/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  controllers: [AggregatorsController],
  providers: [AggregatorsService, ZomatoAdapter, SwiggyAdapter, UberEatsAdapter],
  exports: [AggregatorsService],
})
export class AggregatorsModule {}
