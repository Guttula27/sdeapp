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
const DB_VERSION = 1;
const STORE_MENU = 'menu-cache';
const STORE_OFFLINE_ORDERS = 'offline-orders';

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
export type OfflineOrder = {
  id: string;                 // = provisional orderNumber
  outletId: string;
  createdAt: number;
  // Sync state — 'pending' until the outbox drain replays it
  // successfully (then 'synced') or it permanently errors ('failed').
  syncState: 'pending' | 'synced' | 'failed';
  syncError?: string;
  serverOrderId?: string;     // populated after sync
  serverOrderNumber?: string; // populated after sync
  // Snapshot of what was placed — enough to re-render the receipt
  // for a reprint (same shape as a regular order detail response).
  snapshot: any;
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
