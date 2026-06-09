import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { PhoneBackfillService } from './phone-backfill.service';
import { UserLookupService } from './user-lookup.service';
import { PrismaModule } from '../prisma/prisma.module';

// Global so any module can inject EncryptionService / UserLookupService
// without per-module imports. There's only a handful of providers —
// keeping it Global lets us wire phone-encryption at the leaf services
// surgically without rewiring module imports.
@Global()
@Module({
  imports: [PrismaModule],
  providers: [EncryptionService, PhoneBackfillService, UserLookupService],
  exports: [EncryptionService, UserLookupService],
})
export class CryptoModule {}
