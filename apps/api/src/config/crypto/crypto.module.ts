import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

// Global so any module can inject EncryptionService without per-module
// imports. There's only one provider — keeping it Global lets us wire
// encryption at write sites surgically without rewiring module imports.
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CryptoModule {}
