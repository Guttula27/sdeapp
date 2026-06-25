// Tiny IndexedDB wrapper — Promise-based key/value get/put for two
// object stores ("menu-cache" + "offline-orders"). Adds no dependency
// because the offline-pos surface is small enough that a dedicated
// library (Dexie, idb) would be overkill.
//
// Schema is versioned via DB_VERSION; bump + extend onupgradeneeded
// to add a new store. The wrapper retries opening on every call so
// a Safari quirk where the first open after a reload returns null
// doesn't hard-fail the page.

const DB_NAME = 'paynpik-pos';
// Bumped to 2 to add the open-orders snapshot store used by OrdersPage
// for offline read fallback + the manual-delivery workflow on top.
const DB_VERSION = 2;
const STORE_MENU = 'menu-cache';
const STORE_OFFLINE_ORDERS = 'offline-orders';
const STORE_OPEN_ORDERS = 'open-orders';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MENU)) {
        db.createObjectStore(STORE_MENU); // keyed by outletId
      }
      if (!db.objectStoreNames.contains(STORE_OFFLINE_ORDERS)) {
        const s = db.createObjectStore(STORE_OFFLINE_ORDERS, { keyPath: 'id' });
        s.createIndex('outletId', 'outletId', { unique: false });
        s.createIndex('syncState', 'syncState', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_OPEN_ORDERS)) {
        // One row per outlet — value carries the last-known list of
        // open orders along with the fetch timestamp so the offline
        // view can show a "stale data" hint.
        db.createObjectStore(STORE_OPEN_ORDERS); // keyed by outletId
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function tx<T = unknown>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest | null,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const s = transaction.objectStore(store);
    const req = fn(s);
    if (req == null) {
      transaction.oncomplete = () => resolve(undefined as any);
      transaction.onerror = () => reject(transaction.error);
      return;
    }
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

// ─── Menu cache (one row per outlet) ──────────────────────────────────
export type CachedMenu = {
  outletId: string;
  cachedAt: number;
  menu: any[];
  menus: any[];        // outlet's enabled menus
  outlet: any;         // outlet meta for header / GST / printer config
  tableTypes: any[];
};

export async function getCachedMenu(outletId: string): Promise<CachedMenu | null> {
  try {
    const res = await tx<any>(STORE_MENU, 'readonly', (s) => s.get(outletId));
    return res ?? null;
  } catch { return null; }
}

export async function setCachedMenu(payload: CachedMenu): Promise<void> {
  try {
    await tx<void>(STORE_MENU, 'readwrite', (s) => s.put(payload, payload.outletId));
  } catch { /* quota / private mode — best-effort */ }
}

// ─── Offline orders (queue of orders placed without network) ──────────
//
// Offline orders are modelled as open tabs from the start. Counter /
// quick-pay flows happen to have a single batch and bill immediately;
// table-service flows accumulate multiple batches and bill later. The
// uniform shape lets the sticky-tab logic in PlaceOrderPage and the
// Bill action on OfflineOrdersPage operate on one data model.
//
// The server POST is NOT queued at create / append time — only at
// billing. Until then the tab lives purely in IndexedDB, so additions
// don't need to mutate a queued outbox entry.
export type OfflineOrderBatch = {
  // Items as they came off the cart at the time of this batch. Used
  // both to re-render the per-batch receipt and to assemble the
  // consolidated POST body at billing.
  items: any[];
  // ISO timestamp of the batch — when the staff actually clicked
  // "Place Order" / "Add items". Useful for reports and for keeping
  // the batch order stable in the receipt.
  addedAt: string;
  // Raw payload that would have gone to /orders for THIS batch alone.
  // Carries customerPhone, paymentMode, tableId, etc. The first batch
  // carries the order-level fields; later batches duplicate them so
  // the consolidated bill stays robust against the first batch being
  // edited locally.
  payload: any;
};

export type OfflineOrder = {
  id: string;                 // = provisional orderNumber (OFF-...)
  outletId: string;
  createdAt: number;
  // Sync state — 'pending' until the outbox drain replays it
  // successfully (then 'synced') or it permanently errors ('failed').
  syncState: 'pending' | 'synced' | 'failed';
  syncError?: string;
  serverOrderId?: string;     // populated after sync
  serverOrderNumber?: string; // populated after sync
  // Latest consolidated snapshot — refreshed every time a batch is
  // appended. Enough to re-render the running customer receipt for a
  // reprint or the final bill at sync time. Same shape as a regular
  // order detail response.
  snapshot: any;
  // Set when the customer was billed locally before the network came
  // back. ISO timestamp of the bill click. On sync, the outbox replay
  // places the consolidated order AND chains a force-status PATCH so
  // the server records the order as SERVED with this actedAt —
  // crucial for reports/closing totals not to miss the revenue.
  servedAt?: string | null;

  // ── Sticky-tab fields (table service) ──────────────────────────
  // Together (outletId, tableId, customerPhone, staffId) form the
  // tab key. Subsequent Place Order clicks that match all four
  // append to this row instead of creating a new one — that way the
  // staff can keep adding items as the meal progresses and bill once
  // at the end, even when the network flaps online mid-meal.
  tableId?: string | null;
  customerPhone?: string | null;
  staffId?: string | null;
  // false once billed (locks the tab from further appends), true while
  // the staff can still add more items. Defaults to true for legacy
  // single-batch rows so existing code paths keep working.
  isOpenTab?: boolean;
  // Append-ordered history of the items added to this tab. The last
  // entry is what the kitchen would print as a "delta" if that flow
  // gets added later; the consolidated bill is built from all of them.
  batches?: OfflineOrderBatch[];
};

export async function saveOfflineOrder(order: OfflineOrder): Promise<void> {
  try { await tx<void>(STORE_OFFLINE_ORDERS, 'readwrite', (s) => s.put(order)); }
  catch { /* best-effort */ }
}

export async function listOfflineOrders(outletId?: string): Promise<OfflineOrder[]> {
  try {
    const all = await tx<OfflineOrder[]>(STORE_OFFLINE_ORDERS, 'readonly', (s) => s.getAll() as any);
    return (all || []).filter((o) => !outletId || o.outletId === outletId);
  } catch { return []; }
}

export async function markOfflineSynced(id: string, server: { id: string; orderNumber: string }) {
  const cur = await tx<OfflineOrder | undefined>(STORE_OFFLINE_ORDERS, 'readonly', (s) => s.get(id) as any);
  if (!cur) return;
  cur.syncState = 'synced';
  cur.serverOrderId = server.id;
  cur.serverOrderNumber = server.orderNumber;
  await saveOfflineOrder(cur);
}

export async function markOfflineFailed(id: string, error: string) {
  const cur = await tx<OfflineOrder | undefined>(STORE_OFFLINE_ORDERS, 'readonly', (s) => s.get(id) as any);
  if (!cur) return;
  cur.syncState = 'failed';
  cur.syncError = error;
  await saveOfflineOrder(cur);
}

// Stamps the offline-served timestamp on a pending offline order so
// the next outbox drain can chain a force-status PATCH after the
// placement POST succeeds. Idempotent — re-clicking just refreshes
// the timestamp, which is harmless before sync.
export async function markOfflineServed(id: string, actedAtIso: string) {
  const cur = await tx<OfflineOrder | undefined>(STORE_OFFLINE_ORDERS, 'readonly', (s) => s.get(id) as any);
  if (!cur) return;
  cur.servedAt = actedAtIso;
  await saveOfflineOrder(cur);
}

// Read a single OfflineOrder by id. Used by the outbox replay to look
// up whether a placed-offline order also needs its served-status PATCH
// chained after the placement succeeds.
export async function getOfflineOrder(id: string): Promise<OfflineOrder | null> {
  try {
    const res = await tx<OfflineOrder | undefined>(STORE_OFFLINE_ORDERS, 'readonly', (s) => s.get(id) as any);
    return res ?? null;
  } catch { return null; }
}

// Look up a still-open offline tab matching (outletId, tableId, phone,
// staff). The tab key is intentionally narrow — the user explicitly
// asked that a different staff session or different customer (phone)
// start a fresh tab even when seated at the same table.
//
// All four parts must match exactly, including the nullability of
// tableId / customerPhone — a counter quick-pay tab (no table, no
// phone) only matches another quick-pay attempt by the same staff.
export async function findOpenOfflineTab(args: {
  outletId: string;
  tableId: string | null;
  customerPhone: string | null;
  staffId: string | null;
}): Promise<OfflineOrder | null> {
  try {
    const all = await listOfflineOrders(args.outletId);
    return (
      all.find((o) =>
        o.isOpenTab !== false &&        // legacy rows had no flag — treat as open
        o.syncState === 'pending' &&
        (o.tableId ?? null) === args.tableId &&
        (o.customerPhone ?? null) === args.customerPhone &&
        (o.staffId ?? null) === args.staffId,
      ) ?? null
    );
  } catch { return null; }
}

// Append a batch to an open tab + refresh the consolidated snapshot.
// Used when the staff adds more items to a table that already has an
// offline tab in flight. Idempotency is the caller's job — typically
// each Place Order click is a new batch with addedAt = now.
export async function appendToOfflineTab(orderId: string, batch: OfflineOrderBatch, snapshot: any): Promise<void> {
  const cur = await getOfflineOrder(orderId);
  if (!cur) return;
  cur.batches = [...(cur.batches ?? []), batch];
  cur.snapshot = snapshot; // consolidated view for the running receipt + final bill
  await saveOfflineOrder(cur);
}

// Bills the tab: locks further appends + stamps the bill timestamp on
// servedAt so the outbox replay chain knows to mark the synced order
// as SERVED at this exact moment. Separate from markOfflineServed so
// the calling code stays explicit about closing the tab vs just
// recording the served time.
export async function closeOfflineTab(orderId: string, billedAtIso: string): Promise<void> {
  const cur = await getOfflineOrder(orderId);
  if (!cur) return;
  cur.isOpenTab = false;
  cur.servedAt = billedAtIso;
  await saveOfflineOrder(cur);
}

// ─── Open-orders snapshot (one row per outlet) ────────────────────────
// Powers OrdersPage's offline fallback: every successful fetch writes
// through; on network failure the snapshot is dispatched to Redux so
// staff still see the open tabs and in-flight orders. Stored as the
// raw server response shape (a flat list of order objects) so the rest
// of the page can render it without translation.
export type OpenOrdersSnapshot = {
  outletId: string;
  cachedAt: number;
  orders: any[];
};

export async function getOpenOrdersSnapshot(outletId: string): Promise<OpenOrdersSnapshot | null> {
  try {
    const res = await tx<any>(STORE_OPEN_ORDERS, 'readonly', (s) => s.get(outletId));
    return res ?? null;
  } catch { return null; }
}

export async function setOpenOrdersSnapshot(payload: OpenOrdersSnapshot): Promise<void> {
  try {
    await tx<void>(STORE_OPEN_ORDERS, 'readwrite', (s) => s.put(payload, payload.outletId));
  } catch { /* quota / private mode — best-effort */ }
}
