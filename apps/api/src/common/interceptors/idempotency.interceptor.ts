import {
  CallHandler, ConflictException, ExecutionContext, Injectable, Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../config/prisma/prisma.service';

const IDEM_TTL_HOURS = 24;
// Only honour the header for actually-mutating verbs. A stray
// Idempotency-Key on a GET should be ignored so the cache isn't polluted
// by GETs that look identical (different query params, etc.).
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Idempotency interceptor — applies the standard `Idempotency-Key` header
 * pattern (Stripe / GitHub flavour).
 *
 *   • Caller sends `Idempotency-Key: <client-uuid>` on a write.
 *   • First time: the handler runs, the response (status + body) is
 *     cached against the key for 24h, and the response flows back.
 *   • Subsequent calls with the same key replay the cached response —
 *     no side-effects on the database, no duplicate Razorpay charges,
 *     no second order, no double item-status flip.
 *
 * The cache table has a UNIQUE constraint on `key`, so two concurrent
 * requests racing for the same key resolve cleanly: the loser gets a
 * Prisma P2002 from the cache-write, we ignore it (the winner's response
 * is what authoritative), and the loser's response is still correct
 * since it just executed the same operation idempotently.
 *
 * Routes opt in by adding `@UseInterceptors(IdempotencyInterceptor)`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Header lookup is case-insensitive in Express; we accept the canonical
    // form + a kebab-case alternative the older clients ship.
    const headerKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as
      | string | undefined;
    const method = String(req.method || '').toUpperCase();

    // No key, or non-mutating method → bypass entirely.
    if (!headerKey || !MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const key = headerKey.trim();
    if (!key || key.length > 191) {
      // Bad key — surface a clear 409 so the client knows to regenerate.
      throw new ConflictException('Invalid Idempotency-Key (max 191 chars)');
    }

    const scope = `${method} ${req.route?.path || req.originalUrl || req.url}`;

    // 1) Cache lookup — return cached on hit + still-valid TTL.
    const hit = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (hit && hit.expiresAt > new Date()) {
      // Optional safety check: same scope. A client reusing a key across
      // different endpoints is almost certainly a bug; we 409 so it
      // surfaces loudly rather than silently returning the wrong payload.
      if (hit.scope !== scope) {
        throw new ConflictException(
          `Idempotency-Key reused across different routes (was ${hit.scope}, now ${scope})`,
        );
      }
      // Replay — set status + body to the cached response.
      res.status(hit.statusCode);
      return of(hit.body);
    }

    // 2) Cache miss — run the handler and persist the response on the way out.
    return next.handle().pipe(
      tap(async (body) => {
        const statusCode = res.statusCode || 200;
        const expiresAt = new Date(Date.now() + IDEM_TTL_HOURS * 60 * 60 * 1000);
        try {
          // Stash whatever the handler returned. `body` may be a plain
          // object (transformed by the global response interceptor) or a
          // primitive — Prisma JSON handles both.
          await this.prisma.idempotencyKey.create({
            data: { key, scope, statusCode, body: body as any, expiresAt },
          });
        } catch (e: any) {
          // P2002 = race lost; another request already wrote this key.
          // That's fine — both responses are equivalent by definition.
          if (e?.code !== 'P2002') {
            this.logger.warn(`Could not persist idempotency key ${key}: ${e?.message || e}`);
          }
        }
      }),
    );
  }
}
