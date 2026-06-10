# 11 — Postpaid (dine-in)

Covers the dine-in postpaid open-tab flow, the customer-scoped lookup
(multi-tab per table), the staff phone-driven lookup, and the bill-now
freeze.

### PP-001 — Customer scans table → no open tab on their phone (P0)
**Pre:** postpaid outlet; no existing open order for this customer at this table.
**Steps:** Customer adds items → "Place order".
**Expected:** New order created. Items start as `PENDING_VERIFICATION`. Service desk sees the verify card.

### PP-002 — Customer scans table → has open tab → "Add to my tab" (P0)
**Pre:** PP-001 already ran for this customer.
**Steps:** Same customer scans → adds items.
**Expected:** New items appended to the existing order, status `PENDING_VERIFICATION`. Service desk gets a verify nudge.

### PP-003 — Two customers same table, separate tabs (P0)
**Pre:** Customer A has open tab. Customer B scans the same QR with a different phone.
**Steps:** B places items.
**Expected:** New order created (B's tab); A's order untouched. `findOpenForTable` returned null for B because of the customer-key scoping.

### PP-004 — Staff resolves open tab via customerPhone query (P1)
**Pre:** PP-001 ran for customer with phone X.
**Steps:** Staff *Place Order* page → enter phone X (≥10 digits) → table picker.
**Expected:** "Open tab" panel appears showing the existing order's items.

### PP-005 — Unknown phone returns no tab (P1)
**Steps:** Staff enters a random phone never used.
**Expected:** No open tab UI; staff lands on the create-new-order flow.

### PP-006 — Bill Now closes additions (P0)
**Pre:** order at any postpaid state.
**Steps:** `PATCH /orders/:id/bill-request` → try appending more items.
**Expected:** First call 200; second call 400 with "Bill already requested".

### PP-007 — Postpaid verify gate removed when confirmed (P0)
**Pre:** order has 2 unverified lines.
**Steps:** Service desk → Confirm.
**Expected:** Lines move to PENDING. Kitchen board now shows them.
