# 08 — Kitchen workflow

Covers per-item status transitions, the outlet-type-aware order rollup,
station scope, the postpaid verification gate, course planner, and
fullscreen.

### KIT-001 — Item status transitions (P0)
**Pre:** signed in as Kitchen role.
**Steps:** On a PENDING item → Start → Ready → Served.
**Expected:** Backend `OrderItemStatus` advances. Order auto-rolls up correctly (see KIT-002).
**Actual Result:** Passed. Tapping Start, Ready, and Served successfully transitions the item's status through preparing, ready, and served states in real-time.

### KIT-002 — Order rollup respects outlet type (P0)
- Self-service: all items READY/SERVED → order auto-advances to `OUT_FOR_SERVICE` (not `READY`).
- Dine-in / parcel: all items READY → order moves to `READY`.
**Actual Result:** Passed. Self-service orders transition directly to OUT_FOR_SERVICE once items are completed. Dine-in and parcel orders transition to READY as expected.

### KIT-003 — Kitchen station scopes visibility (P1)
**Pre:** kitchen user assigned to station A; items routed to station B.
**Steps:** Open kitchen board.
**Expected:** Station A's user sees only A's items (master kitchen user sees all).
**Actual Result:** Passed. Kitchen workers only see items assigned to their specific station. The master kitchen role displays all items across all stations.

### KIT-004 — PENDING_VERIFICATION items hidden from kitchen (P0)
**Pre:** postpaid order with unverified items.
**Steps:** Open kitchen board.
**Expected:** Only PENDING / PREPARING / READY items render — `PENDING_VERIFICATION` lines hidden.
**Actual Result:** Failed (Logic Bypass Bug). Items marked as `PENDING_VERIFICATION` are successfully hidden from the kitchen board. However, clicking the "Accept" button on the general Orders page (`/orders`) incorrectly changes the parent order status to `QUEUED` while leaving the items stuck in `PENDING_VERIFICATION` ("Awaiting verify") status, which blocks them from appearing in the kitchen. To verify correctly, staff must use the Service Desk "Confirm" action.

### KIT-005 — Course planner holds higher sequences (P1)
**Pre:** order with items in sequence 1 + 2.
**Steps:** Mark sequence-1 items SERVED.
**Expected:** Sequence-2 items become live in the kitchen automatically.
**Actual Result:** Failed (API Route Crash). Setting courses throws a `404 Not Found` error (`Cannot PATCH /api/v1/orders/:id/sequences`). The frontend web client makes a request to `/orders/:id/sequences` instead of the correct backend controller route at `/outlets/:outletId/orders/:id/sequences`.

### KIT-006 — Kitchen auto-print on ORDER_PLACED (P1)
**Pre:** outlet has `kitchenAutoPrint=true`; station has a printer; printer is connected.
**Steps:** Place an order containing items routed to that station.
**Expected:** Bluetooth print triggers without manual action.
**Actual Result:** Skipped. No printer hardware available for testing, code review confirms correct Web Bluetooth auto-print invocation logic.

### KIT-007 — Fullscreen toggle (P0)
**Steps:** Click the maximise icon.
**Expected:** Page enters fullscreen; icon flips to minimise; ESC restores.
**Actual Result:** Passed. The maximize icon expands the KDS display to fullscreen mode and changes to a minimize icon. Pressing ESC restores the normal browser view.
