import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Application-level Redis cache. Distinct from the Bull queue connection
 * — Bull manages its own client. Lazy-connects on first use and degrades
 * gracefully: if Redis is unreachable, get() returns null and set/del/incr
 * become no-ops, so callers can treat Redis as a best-effort cache rather
 * than a hard dependency. Worst case the request falls through to the DB.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private connected = false;

  onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url, {
      // Limit reconnect storm if Redis is down — we'd rather degrade
      // to pass-through than thrash. ioredis keeps trying in the
      // background; individual ops just fail fast in the meantime.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    this.client.on('connect', () => {
      this.connected = true;
      this.logger.log(`Connected to Redis at ${url}`);
    });
    this.client.on('error', (e) => {
      // Don't spam — only log when transitioning from connected → disconnected.
      if (this.connected) {
        this.connected = false;
        this.logger.warn(`Redis error: ${e?.message}`);
      }
    });
    this.client.on('end', () => { this.connected = false; });
  }

  async onModuleDestroy() {
    if (this.client) {
      try { await this.client.quit(); } catch { /* ignore */ }
      this.client = null;
    }
  }

  /** Returns the parsed JSON value at `key`, or null on miss / Redis down. */
  async getJSON<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Sets `key` to JSON-encoded `value` with TTL in seconds. No-op if Redis is down. */
  async setJSON(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      /* swallow — cache write failure shouldn't surface to the user */
    }
  }

  /** Atomic counter bump. Used as the version stamp for invalidation patterns. */
  async incr(key: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      return await this.client.incr(key);
    } catch {
      return null;
    }
  }

  /** Reads a counter as a number, defaulting to 0 on miss / parse failure. */
  async getCounter(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      const raw = await this.client.get(key);
      const n = raw == null ? 0 : Number(raw);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
}
