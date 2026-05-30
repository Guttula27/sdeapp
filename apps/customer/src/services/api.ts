import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { markApiOffline, markApiReachable } from '../hooks/useNetworkStatus';
import { enqueue, newIdempotencyKey, OutboxEntry } from '../utils/outbox';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  timeout: 15000,
});

// See apps/web/src/services/api.ts for the full rationale. Same policy.
const RETRY_STATUS = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 4500];
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

interface RetryableConfig extends AxiosRequestConfig {
  __retryCount?: number;
  __isRetry?: boolean;
  __outboxLabel?: string;
  __skipOutbox?: boolean;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('customer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = localStorage.getItem('preferredLanguage');
  if (lang) config.headers['Accept-Language'] = lang;
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
  (res) => { markApiReachable(); return res; },
  async (err: AxiosError) => {
    const config = (err.config ?? {}) as RetryableConfig;
    if (err.response?.status === 401) {
      localStorage.removeItem('customer_token');
      localStorage.removeItem('customer_user');
      return Promise.reject(err);
    }
    const method = (config.method || 'get').toLowerCase();
    const isSafeMethod = method === 'get' || method === 'head';
    const isMutating = MUTATING_METHODS.has(method);
    const status = err.response?.status ?? 0;
    const isNetworkError = !err.response;
    const tried = config.__retryCount ?? 0;

    if (isSafeMethod && RETRY_STATUS.has(status) && tried < MAX_RETRIES) {
      config.__retryCount = tried + 1;
      config.__isRetry = true;
      const delay = RETRY_DELAYS_MS[tried] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await new Promise((r) => setTimeout(r, delay));
      return api.request(config);
    }

    if (isMutating && isNetworkError && tried < MAX_RETRIES) {
      config.__retryCount = tried + 1;
      config.__isRetry = true;
      const delay = RETRY_DELAYS_MS[tried] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await new Promise((r) => setTimeout(r, delay));
      return api.request(config);
    }

    if (isNetworkError) markApiOffline();
    if (isMutating && isNetworkError && !config.__skipOutbox) {
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
        lastError: err.message,
      };
      enqueue(entry);
    }
    return Promise.reject(err);
  },
);

export async function replayEntry(entry: OutboxEntry): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await api.request({
      method: entry.method,
      url: entry.url,
      data: entry.data,
      headers: { ...(entry.headers || {}), 'Idempotency-Key': entry.idempotencyKey },
      __skipOutbox: true,
    } as RetryableConfig);
    return { ok: true, status: res.status };
  } catch (e: any) {
    return {
      ok: false,
      status: e?.response?.status,
      error: e?.response?.data?.message || e?.message || 'Replay failed',
    };
  }
}

export default api;
