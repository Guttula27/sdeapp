# 14 — Offline POS (admin web)

Covers the IndexedDB menu cache, offline order placement with the
provisional `OFF-…` prefix, the outbox-driven sync, and the
reconciliation view.

### OFF-001 — Menu cached after first visit (P0)
**Steps:** Visit Place Order online → close → open DevTools → `IndexedDB → paynpik-pos → menu-cache`.
**Expected:** One row per outletId.
**Actual Result: [PASSED]** Visiting the Place Order page successfully stores the outlet menu structure inside the IndexedDB `paynpik-pos` `menu-cache` database.

### OFF-002 — Menu falls back to cache when offline (P0)
**Steps:** Set browser to Offline → reload Place Order.
**Expected:** Toast "Using cached menu — you appear to be offline". Menu still renders.
**Actual Result: [PASSED]** Setting the browser to offline loads the menu directly from the IndexedDB cache and displays a "Using cached menu — you appear to be offline" warning toast.

### OFF-003 — Place order offline (P0)
**Steps:** Offline → add items → Place Order.
**Expected:** Toast "Offline · order saved as OFF-…". An `offline-orders` IDB row appears with `syncState=pending`. The outbox has an entry.
**Actual Result: [PASSED]** Placing an order while offline assigns a provisional `OFF-...` order number and pushes the request into the IndexedDB `offline-orders` outbox queue.

### OFF-004 — Receipt prints from cart even offline (P1)
**Pre:** outlet has receiptAutoPrint + a paired/connected printer.
**Steps:** Place an offline order.
**Expected:** Bluetooth print fires with OFF- number on the receipt.
**Actual Result: [PASSED]** Even when offline, the print service serializes the cart layout and sends ESC/POS print commands containing the `OFF-...` number to the connected Bluetooth thermal printer.

### OFF-005 — Sync replays on reconnect (P0)
**Steps:** From OFF-003, restore network.
**Expected:** Outbox drains. Idempotency-Key matches the OFF- number. Server creates the canonical order with an `ON-` number. The local IDB row flips to `syncState=synced` with `serverOrderNumber` populated.
**Actual Result: [PASSED]** Restoring the network connection automatically triggers the API outbox queue drain, replaying the checkout with the original `Idempotency-Key` (the `OFF-...` number). The server creates the canonical order (prefixed with `ON-`), and the local IndexedDB state is updated to synced.

### OFF-006 — Reconciliation view summary counts (P0)
**Steps:** Visit `/offline-orders`.
**Expected:** Three tiles: Pending / Synced / Failed match IDB contents.
**Actual Result: [PASSED]** The `/offline-orders` reconciliation view displays accurate Pending, Synced, and Failed tiles mapped to the IndexedDB entries.

### OFF-007 — Reprint from reconciliation view (P1)
**Steps:** Click Reprint on an entry.
**Expected:** Web Bluetooth prompt (if not yet connected) → print fires with the saved snapshot.
**Actual Result: [PASSED]** Clicking the Reprint button on the offline orders table successfully prints a duplicate receipt using the locally cached cart payload.

### OFF-008 — Force-sync button (P1)
**Steps:** Click "Sync now (N)".
**Expected:** Outbox drains; toast reports synced count.
**Actual Result: [PASSED]** The manual "Sync now" button forces the API client interceptor to replay any queued offline requests immediately and reports the results.

### OFF-010 — Failed sync surfaces error (P2)
**Pre:** simulate a 4xx server rejection on replay (e.g. unknown phone validation fails).
**Steps:** Restore network; let the drain run.
**Expected:** Row's badge becomes Failed; hover shows error message.
**Actual Result: [PASSED]** Replayed orders that fail server-side validation are flagged as Failed, and hovering over the badge displays the server error message.

### OFF-009 — Clear local entry preserves server copy (P1)
**Steps:** Click Clear → confirm.
**Expected:** Row disappears from the page; server order (if synced) stays.
**Actual Result: [PASSED]** Clearing a synced offline order from the local table removes the IndexedDB row but preserves the active canonical order record on the server.
