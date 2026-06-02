// Outbox — persistent queue of writes that failed because of network
// trouble. Each entry has a client-generated `idempotencyKey` so the
// backend can dedupe replays. Storage is localStorage (simple, durable,
// works without a service worker); upgradeable to IndexedDB later if
// the queue ever needs to hold large payloads.
//
// Flow:
//   1. Write fails on a network error after retries → enqueue(entry)
//   2. The subscriber pattern fires; UI shows a pending count + the
//      "Sync failed — Retry" toast for the affected entry.
//   3. On reconnect, drain() walks the queue and replays each via the
//      caller-supplied dispatcher (the axios instance).
//   4. Successful replay removes the entry; the toast is dismissed.

export interface OutboxEntry {
  // Stable ID — used for dedupe + UI listing. Also passed as the
  // Idempotency-Key header so the backend can collapse retries to a
  // single side-effect.
  idempotencyKey: string;
  // What was being done — used in the toast copy.
  label: string;
  // The raw axios-style request descriptor.
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  // Bookkeeping
  enqueuedAt: number;
  attempts: number;
  lastError?: string;
}

const STORAGE_KEY = 'paynpik-outbox-v1';
type Listener = (entries: OutboxEntry[]) => void;
const listeners: Set<Listener> = new Set();

function read(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
  catch { /* quota / disabled storage — accept loss */ }
  for (const l of listeners) l(entries);
}

export function getEntries(): OutboxEntry[] { return read(); }

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  // Fire once with current state so subscribers don't have to read separately.
  fn(read());
  return () => { listeners.delete(fn); };
}

export function enqueue(entry: OutboxEntry) {
  const cur = read();
  // Dedupe by idempotency key — if we somehow try to enqueue the same
  // operation twice, second one wins (same key, fresher attempts count).
  const filtered = cur.filter((e) => e.idempotencyKey !== entry.idempotencyKey);
  filtered.push(entry);
  write(filtered);
}

export function remove(idempotencyKey: string) {
  const cur = read();
  const filtered = cur.filter((e) => e.idempotencyKey !== idempotencyKey);
  if (filtered.length !== cur.length) write(filtered);
}

export function update(idempotencyKey: string, patch: Partial<OutboxEntry>) {
  const cur = read();
  const idx = cur.findIndex((e) => e.idempotencyKey === idempotencyKey);
  if (idx === -1) return;
  cur[idx] = { ...cur[idx], ...patch };
  write(cur);
}

// Entries older than this OR with this many failed attempts are
// considered zombies and quietly purged on the next drain. Keeps the
// banner from sticking forever on writes the server has permanently
// rejected (e.g. validation errors that won't fix themselves).
const MAX_ATTEMPTS_BEFORE_PURGE = 10;
const MAX_AGE_MS_BEFORE_PURGE = 24 * 60 * 60 * 1000; // 24h

// Drop everything from the queue. User-triggered from the banner's
// Dismiss button — useful when entries are stale beyond hope.
export function clearAll() {
  write([]);
}

// Replay every queued write through the supplied dispatcher. The
// dispatcher is the page-bound axios instance — passed in instead of
// imported here so the outbox stays UI-app-agnostic.
//
// Returns the count of entries that successfully drained.
export async function drain(
  dispatch: (entry: OutboxEntry) => Promise<{ ok: boolean; status?: number; error?: string }>,
): Promise<{ succeeded: number; failed: number; purged: number }> {
  const entries = read();
  let succeeded = 0;
  let failed = 0;
  let purged = 0;
  const now = Date.now();
  for (const entry of entries) {
    // Purge zombies before attempting — saves a doomed network call.
    if (entry.attempts >= MAX_ATTEMPTS_BEFORE_PURGE || (now - entry.enqueuedAt) > MAX_AGE_MS_BEFORE_PURGE) {
      remove(entry.idempotencyKey);
      purged += 1;
      continue;
    }
    update(entry.idempotencyKey, { attempts: entry.attempts + 1 });
    try {
      const result = await dispatch(entry);
      if (result.ok) {
        remove(entry.idempotencyKey);
        succeeded += 1;
      } else if (result.status && result.status >= 400 && result.status < 500 && result.status !== 408 && result.status !== 429) {
        // 4xx (except 408/429 which are transient) means the server
        // permanently rejected the request — replaying won't help.
        // Drop the entry so it stops cluttering the banner.
        remove(entry.idempotencyKey);
        purged += 1;
      } else {
        update(entry.idempotencyKey, { lastError: result.error || `HTTP ${result.status}` });
        failed += 1;
      }
    } catch (e: any) {
      update(entry.idempotencyKey, { lastError: e?.message || 'Unknown error' });
      failed += 1;
    }
  }
  return { succeeded, failed, purged };
}

// Generate a UUID-ish key without pulling a dependency. crypto.randomUUID
// is available in all modern browsers; fall back to a timestamp + random
// suffix for the (rare) older environment.
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID();
    }
  } catch { /* fall through */ }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
