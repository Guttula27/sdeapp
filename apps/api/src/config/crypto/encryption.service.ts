import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;
const PREFIX = 'enc:v1:';

/**
 * App-level field encryption.
 *
 * Format on disk: `enc:v1:<base64(iv|tag|ciphertext)>`
 *
 * The prefix is what makes a graceful migration possible — `decrypt()` is a
 * no-op on values that don't start with `enc:v1:`, so the existing
 * plaintext rows keep working until something rewrites them. Once every
 * row has been rewritten, we can backfill any holdouts with a one-shot
 * script (`scripts/encrypt-existing.ts`) and remove the legacy path.
 *
 * Key source: `APP_ENCRYPTION_KEY` env var — 32 raw bytes, hex-encoded
 * (so 64 hex chars). Generate with `openssl rand -hex 32`. In dev/test
 * a fixed dev key is used so the encrypted column round-trips locally
 * without forcing every developer to set the env var; the boot log
 * shouts about it so it can't slip into prod.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger('Encryption');
  private key!: Buffer;

  onModuleInit() {
    const fromEnv = process.env.APP_ENCRYPTION_KEY;
    if (fromEnv && fromEnv.trim().length > 0) {
      const buf = Buffer.from(fromEnv.trim(), 'hex');
      if (buf.length !== 32) {
        throw new Error(
          `APP_ENCRYPTION_KEY must be 32 bytes (64 hex chars); got ${buf.length} bytes.`,
        );
      }
      this.key = buf;
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_ENCRYPTION_KEY is required in production.');
    }
    // Dev fallback — deterministic so re-starts don't break local data,
    // but the log line is intentionally loud.
    this.key = crypto
      .createHash('sha256')
      .update('paynpik-dev-encryption-key-do-not-use-in-prod')
      .digest();
    this.logger.warn(
      'APP_ENCRYPTION_KEY not set — using a dev-only fallback key. DO NOT USE IN PRODUCTION.',
    );
  }

  // ─── Strings ──────────────────────────────────────────────────────────
  encrypt(plain: string | null | undefined): string | null {
    if (plain == null) return null;
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(stored: string | null | undefined): string | null {
    if (stored == null) return null;
    // Legacy plaintext — pass through unchanged so existing rows still
    // work before the backfill script has run.
    if (!stored.startsWith(PREFIX)) return stored;
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = raw.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  // ─── JSON convenience ─────────────────────────────────────────────────
  encryptJson(obj: unknown): string | null {
    if (obj == null) return null;
    return this.encrypt(JSON.stringify(obj));
  }

  decryptJson<T = any>(stored: string | null | undefined): T | null {
    const plain = this.decrypt(stored);
    if (plain == null) return null;
    try {
      return JSON.parse(plain) as T;
    } catch {
      // Legacy rows that were stored as raw JSON in a Json column and
      // later migrated to TEXT keep their JSON-string shape — handled
      // above. If we somehow land here with non-JSON, surface it raw
      // so callers can decide what to do with it.
      return plain as unknown as T;
    }
  }
}
