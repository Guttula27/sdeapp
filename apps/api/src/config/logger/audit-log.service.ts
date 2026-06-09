import { Injectable, Logger } from '@nestjs/common';
import * as winston from 'winston';
import { winstonAuditConfig } from './winston.config';

// Lightweight wrapper around a dedicated Winston logger that only
// receives the events worth forensically replaying. Lives in its
// own file stream so an operator can `tail -f logs/audit-*.log`
// without drowning in HTTP noise.
@Injectable()
export class AuditLogService {
  private readonly logger: winston.Logger;
  private readonly fallback = new Logger('Audit');

  constructor() {
    this.logger = winston.createLogger(winstonAuditConfig);
  }

  // Generic write — every event must specify a `type` (kept stable so
  // downstream queries can filter). actorId/orderId/etc. are optional
  // free-form context that get serialised into the JSON payload.
  record(type: string, payload: Record<string, any> = {}) {
    try {
      this.logger.info({ type, ...payload });
    } catch (e: any) {
      // Audit is best-effort — never block the request on a write
      // failure. Fall back to the Nest logger so we at least see
      // something in stdout if the file transport explodes.
      this.fallback.warn(`audit write failed: ${e?.message ?? e}`);
    }
  }

  // ─── Convenience emitters — keep names mirroring the user-visible
  // verbs so a future "audit search" endpoint can filter by these
  // strings without consulting a separate enum. ─────────────────────
  orderStatusChanged(args: {
    actorId?: string | null;
    orderId: string;
    orderNumber?: string;
    outletId?: string;
    from: string;
    to: string;
    notes?: string | null;
  }) {
    this.record('ORDER_STATUS_CHANGED', args);
  }

  orderItemStatusChanged(args: {
    actorId?: string | null;
    orderId: string;
    orderItemId: string;
    from: string;
    to: string;
  }) {
    this.record('ORDER_ITEM_STATUS_CHANGED', args);
  }

  paymentConfirmed(args: {
    paymentId: string;
    orderId: string;
    amount: number | string;
    mode: string;
    gatewayRef?: string | null;
    routedTransfer?: number | null;
    platformFee?: number | null;
  }) {
    this.record('PAYMENT_CONFIRMED', args);
  }

  postpaidVerification(args: {
    actorId?: string | null;
    orderId: string;
    action: 'confirm' | 'strike';
    itemCount: number;
  }) {
    this.record('POSTPAID_VERIFICATION', args);
  }

  permissionGranted(args: {
    actorId?: string | null;
    roleId: string;
    responsibility: string;
    granted: boolean;
  }) {
    this.record('PERMISSION_CHANGED', args);
  }
}
