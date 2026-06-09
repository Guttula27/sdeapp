import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { utilities as nestWinstonUtils } from 'nest-winston';

// Fields we never want hitting any log target — payment secrets in
// webhook bodies, raw passwords, OTPs, bearer tokens. The redact
// formatter walks the message + meta and replaces matching values
// with "[REDACTED]". Add new keys here whenever we introduce a new
// secret-bearing parameter.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'otp',
  'razorpaySignature',
  'razorpay_signature',
  'razorpaySecret',
  'razorpayKey',
  'webhookSignature',
  'token',
  'jwt',
  'authorization',
  'authToken',
  'refreshToken',
]);

// Mask Indian-style phones inline so casual log lines that include a
// raw number still get partial protection. We keep the last 4 digits
// so support staff can correlate without exposing the full number.
function maskPhones(input: string): string {
  return input.replace(/(\+?\d{1,3}[- ]?)?[6-9]\d{9}/g, (m) => {
    const last = m.slice(-4);
    return `***${last}`;
  });
}

function redactDeep(value: any): any {
  if (value == null) return value;
  if (typeof value === 'string') return maskPhones(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redactDeep(v);
    }
    return out;
  }
  return value;
}

const redactFormat = winston.format((info) => {
  if (typeof info.message === 'string') info.message = maskPhones(info.message);
  for (const [k, v] of Object.entries(info)) {
    if (k === 'level' || k === 'message' || k === 'timestamp' || k === 'context') continue;
    (info as any)[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redactDeep(v);
  }
  return info;
});

const isProd = process.env.NODE_ENV === 'production';
const logDir = process.env.LOG_DIR || 'logs';

// Pretty console for dev (matches Nest's familiar coloured output);
// JSON for prod so log shippers (datadog/cloudwatch/loki) can index
// fields. App and audit lines flow to separate file streams so an
// operator running `tail -f logs/audit-*.log` only sees state-change
// rows — keeps forensic playback clean.
function buildAppTransports() {
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      redactFormat(),
      isProd
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            nestWinstonUtils.format.nestLike('paynpik', {
              colors: true,
              prettyPrint: !isProd,
            }),
          ),
    ),
  });

  const fileTransport = new (winston.transports as any).DailyRotateFile({
    filename: `${logDir}/app-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      redactFormat(),
      winston.format.json(),
    ),
  });

  return [consoleTransport, fileTransport];
}

// Dedicated audit-log transport: separate file rotation, longer
// retention, JSON-only. Used by AuditLogService for state changes
// the business cares about (payments, status moves, permission grants).
function buildAuditTransports() {
  return [
    new (winston.transports as any).DailyRotateFile({
      filename: `${logDir}/audit-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: winston.format.combine(
        winston.format.timestamp(),
        redactFormat(),
        winston.format.json(),
      ),
    }),
  ];
}

export const winstonAppConfig = {
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  transports: buildAppTransports(),
};

export const winstonAuditConfig = {
  level: 'info',
  transports: buildAuditTransports(),
};
