# 08 — Kitchen workflow

Covers per-item status transitions, the outlet-type-aware order rollup,
station scope, the postpaid verification gate, course planner, and
fullscreen.

### KIT-001 — Item status transitions (P0)
**Pre:** signed in as Kitchen role.
**Steps:** On a PENDING item → Start → Ready → Served.
**Expected:** Backend `OrderItemStatus` advances. Order auto-rolls up correctly (see KIT-002).

### KIT-002 — Order rollup respects outlet type (P0)
- Self-service: all items READY/SERVED → order auto-advances to `OUT_FOR_SERVICE` (not `READY`).
- Dine-in / parcel: all items READY → order moves to `READY`.

### KIT-003 — Kitchen station scopes visibility (P1)
**Pre:** kitchen user assigned to station A; items routed to station B.
**Steps:** Open kitchen board.
**Expected:** Station A's user sees only A's items (master kitchen user sees all).

### KIT-004 — PENDING_VERIFICATION items hidden from kitchen (P0)
**Pre:** postpaid order with unverified items.
**Steps:** Open kitchen board.
**Expected:** Only PENDING / PREPARING / READY items render — `PENDING_VERIFICATION` lines hidden.

### KIT-005 — Course planner holds higher sequences (P1)
**Pre:** order with items in sequence 1 + 2.
**Steps:** Mark sequence-1 items SERVED.
**Expected:** Sequence-2 items become live in the kitchen automatically.

### KIT-006 — Kitchen auto-print on ORDER_PLACED (P1)
**Pre:** outlet has `kitchenAutoPrint=true`; station has a printer; printer is connected.
**Steps:** Place an order containing items routed to that station.
**Expected:** Bluetooth print triggers without manual action.

### KIT-007 — Fullscreen toggle (P0)
**Steps:** Click the maximise icon.
**Expected:** Page enters fullscreen; icon flips to minimise; ESC restores.
