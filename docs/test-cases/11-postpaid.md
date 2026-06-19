# 11 — Postpaid (dine-in)

Covers the dine-in postpaid open-tab flow, the customer-scoped lookup
(multi-tab per table), the staff phone-driven lookup, and the bill-now
freeze.

### PP-001 — Customer scans table → no open tab on their phone (P0)
**Pre:** postpaid outlet; no existing open order for this customer at this table.
**Steps:** Customer adds items → "Place order".
**Expected:** New order created. Items start as `PENDING_VERIFICATION`. Service desk sees the verify card.
**Actual Result:** Passed. When a new customer places an order on a table, a fresh postpaid order starts, setting the item statuses to PENDING_VERIFICATION and placing the order card on the Service Desk Verify lane.

### PP-002 — Customer scans table → has open tab → "Add to my tab" (P0)
**Pre:** PP-001 already ran for this customer.
**Steps:** Same customer scans → adds items.
**Expected:** New items appended to the existing order, status `PENDING_VERIFICATION`. Service desk gets a verify nudge.
**Actual Result:** Passed. Subsequent items added by the same customer append directly to their active order in PENDING_VERIFICATION status, sending a notification to the service desk dashboard.

### PP-003 — Two customers same table, separate tabs (P0)
**Pre:** Customer A has open tab. Customer B scans the same QR with a different phone.
**Steps:** B places items.
**Expected:** New order created (B's tab); A's order untouched. `findOpenForTable` returned null for B because of the customer-key scoping.
**Actual Result:** Passed. Tabs are scoped by customer credentials. Customer B scanning the same QR is routed to a new tab, leaving Customer A's open tab completely separate and untouched. (Note: testing multiple phone tabs on the same computer's browser splits local storage, causing them to merge in the UI; testing must be done in private/incognito modes or separate devices).

### PP-004 — Staff resolves open tab via customerPhone query (P1)
**Pre:** PP-001 ran for customer with phone X.
**Steps:** Staff *Place Order* page → enter phone X (≥10 digits) → table picker.
**Expected:** "Open tab" panel appears showing the existing order's items.
**Actual Result:** Passed. Staff searching by the customer's phone number on the place order screen correctly identifies and loads the customer's active postpaid tab and table items.

### PP-005 — Unknown phone returns no tab (P1)
**Steps:** Staff enters a random phone never used.
**Expected:** No open tab UI; staff lands on the create-new-order flow.
**Actual Result:** Passed. Searching for an unregistered phone number displays no open tab UI and lets the staff start a new order directly.

### PP-006 — Bill Now closes additions (P0)
**Pre:** order at any postpaid state.
**Steps:** `PATCH /orders/:id/bill-request` → try appending more items.
**Expected:** First call 200; second call 400 with "Bill already requested".
**Actual Result:** Failed (UX Flaw). Tapping "Bill Now" successfully locks the postpaid order in the backend. Subsequent API attempts to append items correctly return a 400 error. However, the frontend menu/cart are not disabled during the billing phase (staff can build a cart of new items, even though paying only charges the locked amount).

### PP-007 — Postpaid verify gate removed when confirmed (P0)
**Pre:** order has 2 unverified lines.
**Steps:** Service desk → Confirm.
**Expected:** Lines move to PENDING. Kitchen board now shows them.
**Actual Result:** Failed (Recalculation & Payment Block Loophole). Confirming unverified items via the Service Desk advances their status. However, striking/rejecting items (Service Desk) or cancelling them (Kitchen) does not update the order's financial totals (customer is still billed for the cancelled items). Furthermore, once all items are served, the order moves to SERVED status, which throws a terminal state error (`Order is in a terminal state and cannot accept payment`) and blocks payment collection.
