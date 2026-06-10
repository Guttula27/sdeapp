# 14 — Offline POS (admin web)

Covers the IndexedDB menu cache, offline order placement with the
provisional `OFF-…` prefix, the outbox-driven sync, and the
reconciliation view.

### OFF-001 — Menu cached after first visit (P0)
**Steps:** Visit Place Order online → close → open DevTools → `IndexedDB → paynpik-pos → menu-cache`.
**Expected:** One row per outletId.

### OFF-002 — Menu falls back to cache when offline (P0)
**Steps:** Set browser to Offline → reload Place Order.
**Expected:** Toast "Using cached menu — you appear to be offline". Menu still renders.

### OFF-003 — Place order offline (P0)
**Steps:** Offline → add items → Place Order.
**Expected:** Toast "Offline · order saved as OFF-…". An `offline-orders` IDB row appears with `syncState=pending`. The outbox has an entry.

### OFF-004 — Receipt prints from cart even offline (P1)
**Pre:** outlet has receiptAutoPrint + a paired/connected printer.
**Steps:** Place an offline order.
**Expected:** Bluetooth print fires with OFF- number on the receipt.

### OFF-005 — Sync replays on reconnect (P0)
**Steps:** From OFF-003, restore network.
**Expected:** Outbox drains. Idempotency-Key matches the OFF- number. Server creates the canonical order with an `ON-` number. The local IDB row flips to `syncState=synced` with `serverOrderNumber` populated.

### OFF-006 — Reconciliation view summary counts (P0)
**Steps:** Visit `/offline-orders`.
**Expected:** Three tiles: Pending / Synced / Failed match IDB contents.

### OFF-007 — Reprint from reconciliation view (P1)
**Steps:** Click Reprint on an entry.
**Expected:** Web Bluetooth prompt (if not yet connected) → print fires with the saved snapshot.

### OFF-008 — Force-sync button (P1)
**Steps:** Click "Sync now (N)".
**Expected:** Outbox drains; toast reports synced count.

### OFF-009 — Clear local entry preserves server copy (P1)
**Steps:** Click Clear → confirm.
**Expected:** Row disappears from the page; server order (if synced) stays.

### OFF-010 — Failed sync surfaces error (P2)
**Pre:** simulate a 4xx server rejection on replay (e.g. unknown phone validation fails).
**Steps:** Restore network; let the drain run.
**Expected:** Row's badge becomes Failed; hover shows error message.
