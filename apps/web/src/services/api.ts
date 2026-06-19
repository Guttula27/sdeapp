import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { markApiOffline, markApiReachable } from '../hooks/useNetworkStatus';
import { enqueue, newIdempotencyKey, OutboxEntry } from '../utils/outbox';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  timeout: 15000,
});

// ── Network resilience config ───────────────────────────────────
// Reads retry blindly on transient failures; writes get an
// Idempotency-Key + retry only network errors (not 4xx/5xx, since those
// might be legitimate rejections). On final write failure the request is
// pushed to the outbox for replay when connectivity returns.
const RETRY_STATUS = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 4500];

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

interface RetryableConfig extends AxiosRequestConfig {
  __retryCount?: number;
  __isRetry?: boolean;
  // Caller-supplied label for the outbox/toast — "Place order", "Mark
  // item ready", etc. Falls back to the URL + method when missing.
  __outboxLabel?: string;
  // Skip the outbox for this request even if it fails. Used internally
  // for outbox drain replays so a re-failed replay doesn't re-queue
  // recursively.
  __skipOutbox?: boolean;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = localStorage.getItem('preferredLanguage');
  if (lang) config.headers['Accept-Language'] = lang;
  // Stamp an Idempotency-Key on every mutating request UNLESS one was
  // supplied by the caller (outbox replays reuse the original key). The
  // backend ignores the header on endpoints that don't opt in, so this
  // is always safe to send.
  const method = String(config.method || 'get').toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    config.headers = config.headers || {};
    if (!config.headers['Idempotency-Key'] && !config.headers['idempotency-key']) {
      config.headers['Idempotency-Key'] = newIdempotencyKey();
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    markApiReachable();
    return res;
  },
  async (error: AxiosError) => {
    const config = (error.config ?? {}) as RetryableConfig;

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const method = (config.method || 'get').toLowerCase();
    const isSafeMethod = method === 'get' || method === 'head';
    const isMutating = MUTATING_METHODS.has(method);
    const status = error.response?.status ?? 0;
    // A "true" network error has no response at all. But when the API is
    // sitting behind a reverse proxy (Traefik on Dokploy, Nginx, an LB,
    // a CDN), a downed upstream surfaces as a 502/503/504 from the
    // proxy — there's a response, but the request didn't actually reach
    // the API. Treat both the same way for retry + outbox queueing,
    // since neither path can have produced server-side side effects.
    // 500 is not included: that's an application error and should not
    // be auto-replayed (could be a constraint violation, etc.).
    const INFRA_TRANSIENT = new Set([502, 503, 504]);
    const isNetworkError = !error.response || INFRA_TRANSIENT.has(status);
    const tried = config.__retryCount ?? 0;

    // ── GET / HEAD: retry both network + server-side transient errors.
    if (isSafeMethod && RETRY_STATUS.has(status) && tried < MAX_RETRIES) {
      config.__retryCount = tried + 1;
      config.__isRetry = true;
      const delay = RETRY_DELAYS_MS[tried] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await new Promise((r) => setTimeout(r, delay));
      return api.request(config);
    }

    // ── Mutating methods: retry "infrastructure transient" errors only
    //    (raw network failures + 502/503/504 from the proxy). We do NOT
    //    replay 4xx (legitimate rejection) or 500 (server processed and
    //    threw); those are surfaced to the caller as-is. Same
    //    Idempotency-Key flows through every retry. After all retries
    //    are exhausted, queue to the outbox unless explicitly skipped.
    if (isMutating && isNetworkError && tried < MAX_RETRIES) {
      config.__retryCount = tried + 1;
      config.__isRetry = true;
      const delay = RETRY_DELAYS_MS[tried] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await new Promise((r) => setTimeout(r, delay));
      return api.request(config);
    }

    // Exhausted: surface the API-offline flag (so the banner shows)
    // and — for mutating requests that the network never delivered —
    // park the request in the outbox for retry on reconnect. The caller
    // still sees the error so it can surface a "queued for retry"
    // toast and avoid optimistic UI updates that the server didn't OK.
    if (isNetworkError) markApiOffline();
    // Auth endpoints are unsafe to queue: a login replay after the user
    // has already moved past that state is meaningless, and a stale
    // attempt re-firing on every reconnect just clutters the banner.
    const url = (config.url || '').toLowerCase();
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/logout') || url.includes('/auth/register') || url.includes('/auth/refresh');
    if (isMutating && isNetworkError && !config.__skipOutbox && !isAuthEndpoint) {
      const idemKey = (config.headers?.['Idempotency-Key']
        || config.headers?.['idempotency-key']
        || newIdempotencyKey()) as string;
      const entry: OutboxEntry = {
        idempotencyKey: idemKey,
        label: config.__outboxLabel || `${(config.method || 'POST').toUpperCase()} ${config.url || ''}`,
        method: ((config.method || 'POST').toUpperCase()) as OutboxEntry['method'],
        url: config.url || '',
        data: config.data,
        headers: Object.fromEntries(
          Object.entries(config.headers || {}).filter(([k]) =>
            ['idempotency-key', 'content-type', 'accept-language'].includes(k.toLowerCase()),
          ).map(([k, v]) => [k, String(v)]),
        ),
        enqueuedAt: Date.now(),
        attempts: tried + 1,
        lastError: error.message,
      };
      enqueue(entry);
    }

    return Promise.reject(error);
  },
);

// ── Outbox replay helper ─────────────────────────────────────────
// Called from the global drain loop in OfflineBanner. Re-issues a queued
// write with __skipOutbox=true so a still-failed replay surfaces an error
// rather than re-queueing (which would loop forever).
export async function replayEntry(entry: OutboxEntry): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await api.request({
      method: entry.method,
      url: entry.url,
      data: entry.data,
      headers: { ...(entry.headers || {}), 'Idempotency-Key': entry.idempotencyKey },
      __skipOutbox: true,
    } as RetryableConfig);
    // If the entry corresponded to an offline order (its idempotencyKey
    // doubles as the offline orderNumber, prefix "OFF-"), mark the
    // local snapshot as synced and stamp the server-issued ON- number
    // alongside. Lazy-imported so this module stays UI-app-agnostic.
    if (entry.idempotencyKey.startsWith('OFF-')) {
      try {
        const { markOfflineSynced } = await import('../utils/idb');
        const body = res.data?.data;
        if (body?.id) {
          await markOfflineSynced(entry.idempotencyKey, { id: body.id, orderNumber: body.orderNumber });
        }
      } catch { /* offline-orders module missing or write failed — ignore */ }
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    // Permanent server-side rejection (4xx) → mark the offline order
    // as failed so the reconciliation view can show the reason.
    if (entry.idempotencyKey.startsWith('OFF-') && e?.response?.status && e.response.status >= 400 && e.response.status < 500) {
      try {
        const { markOfflineFailed } = await import('../utils/idb');
        await markOfflineFailed(entry.idempotencyKey, e?.response?.data?.message || e?.message || 'Server rejected the order');
      } catch { /* ignore */ }
    }
    return {
      ok: false,
      status: e?.response?.status,
      error: e?.response?.data?.message || e?.message || 'Replay failed',
    };
  }
}

export default api;
