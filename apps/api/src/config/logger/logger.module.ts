import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonAppConfig } from './winston.config';
import { AuditLogService } from './audit-log.service';
import { RequestLogMiddleware } from './request-log.middleware';

// Global so any service can inject AuditLogService without a per-module
// import chain. Winston's nest module is also exposed globally so
// `new Logger(context)` from @nestjs/common is automatically routed
// through Winston once main.ts swaps the default logger.
@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonAppConfig)],
  providers: [AuditLogService, RequestLogMiddleware],
  exports: [WinstonModule, AuditLogService, RequestLogMiddleware],
})
export class LoggerModule {}
