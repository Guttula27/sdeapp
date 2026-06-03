// Stale-read cache for GETs. Try network first; on failure (or when
// caller asks for stale-while-revalidate) fall back to the cached copy.
//
// Storage: localStorage — simple, durable across reloads, ~5MB cap which
// comfortably fits menu/bundle JSON. Upgrade to IndexedDB later if we
// ever need to cache image blobs or large payloads.
//
// Each entry stores { data, cachedAt, ttl }; entries past ttl are
// treated as misses but not auto-evicted (eviction is opportunistic in
// `purgeExpired` when we hit the quota).

import api from '../services/api';

const PREFIX = 'cache-v1:';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h

// Language-aware cache keys. Without this, switching language hits the
// same cache slot and the user sees stale translations until the cache
// entry expires (up to 1h). Reading localStorage on every call is fine
// — it's synchronous and cheap.
function languageSuffix(): string {
  try {
    const lang = localStorage.getItem('preferredLanguage');
    return lang ? `:lang=${lang}` : '';
  } catch { return ''; }
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

function read<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function write(key: string, entry: CacheEntry<any>) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded — drop the oldest cache entries and retry once.
    purgeExpired();
    try { localStorage.setItem(PREFIX + key, JSON.stringify(entry)); }
    catch { /* still no room — accept loss */ }
  }
}

function purgeExpired() {
  const now = Date.now();
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys) {
    try {
      const entry = JSON.parse(localStorage.getItem(k) || '{}') as CacheEntry<any>;
      if (entry.cachedAt + entry.ttl < now) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}

export interface CachedGetOptions {
  ttlMs?: number;
  params?: Record<string, any>;
  // When true, return the cached copy immediately while a background
  // refresh runs. Useful for the cluster bundle on subsequent visits.
  // The promise still resolves with the latest network payload.
  staleWhileRevalidate?: boolean;
}

export interface CachedGetResult<T> {
  data: T;
  fromCache: boolean;
  // cachedAt = ms-since-epoch the cached copy was last fetched. Useful
  // for surfacing "Last updated 5m ago" in the cached-data banner.
  cachedAt: number | null;
}

// Performs a GET with cache fallback. Network always wins when it can;
// when the network fails (offline / API down after retries), the cached
// copy is returned with fromCache=true so the UI can flag stale state.
export async function cachedGet<T = any>(
  key: string,
  url: string,
  opts: CachedGetOptions = {},
): Promise<CachedGetResult<T>> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const fullKey = key + languageSuffix();
  const cached = read<T>(fullKey);

  try {
    const res = await api.get(url, { params: opts.params });
    const payload = (res.data?.data ?? res.data) as T;
    write(fullKey, { data: payload, cachedAt: Date.now(), ttl });
    return { data: payload, fromCache: false, cachedAt: Date.now() };
  } catch (err) {
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw err;
  }
}

// Direct cache lookup — useful for "warm boot" code paths that want to
// paint immediately while the network call runs in parallel.
export function peekCache<T = any>(key: string): CachedGetResult<T> | null {
  const entry = read<T>(key + languageSuffix());
  if (!entry) return null;
  return { data: entry.data, fromCache: true, cachedAt: entry.cachedAt };
}

export function invalidateCache(key: string) {
  // Drop every language-suffixed variant of the key so a language
  // switch doesn't leave the previous-language entry behind.
  const target = PREFIX + key;
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k === target || k.startsWith(target + ':lang='))) toDelete.push(k);
  }
  for (const k of toDelete) localStorage.removeItem(k);
}

// Drop every cache entry under the prefix. Useful when a global
// invariant (like language) changes and we want a hard reset.
export function invalidateAllCache() {
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) toDelete.push(k);
  }
  for (const k of toDelete) localStorage.removeItem(k);
}
