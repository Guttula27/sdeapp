# 09 — Service Desk

Covers the three-lane dashboard (verify / release / pickup) and the
realtime alert pipeline.

### SVC-001 — Three lanes render correct status set (P0)
**Pre:** orders exist at READY (dine-in), OUT_FOR_SERVICE (self-service), and a postpaid order with `PENDING_VERIFICATION` items.
**Steps:** Open `/service-desk`.
**Expected:** Verify lane shows postpaid card; Release lane shows self-service card; Pickup lane shows dine-in card. Parcel orders absent.
**Actual Result:** Passed. Postpaid orders with items pending verification appear in the Verify lane, self-service orders with completed items appear in the Release lane, and dine-in orders appear in the Pickup lane. Parcel orders are not shown.

### SVC-002 — Verify all PENDING_VERIFICATION items (P0)
**Pre:** logged in user has `MANAGE_SERVICE_DESK`.
**Steps:** Click Confirm on a verify card.
**Expected:** Items move to PENDING (kitchen sees them now). 200 response. Audit log line written.
**Actual Result:** Passed. Confirming verification advances items to PENDING, makes them visible on the kitchen board, updates the database status, and writes an audit log entry.

### SVC-003 — Strike unverified items (P1)
**Steps:** Click Strike → confirm dialog.
**Expected:** Items move to CANCELLED. Card disappears.
**Actual Result:** Passed (with Recalculation Loophole). Striking unverified items cancels them and removes the order card from the queue once no unverified items remain. However, the order's financial totals do not recalculate (customer is still billed for the cancelled items).

### SVC-004 — Release self-service order (P0)
**Steps:** Click Release for pickup.
**Expected:** Status moves to `READY_FOR_PICKUP`. Customer alert `PICKUP_READY` fires.
**Actual Result:** Passed. Clicking Release successfully transitions the order status to READY_FOR_PICKUP and triggers the customer pickup notification.

### SVC-005 — Mark on its way (dine-in) (P0)
**Steps:** Click "On its way" on a pickup card.
**Expected:** Status moves to `OUT_FOR_SERVICE`. Customer alert `ORDER_READY` fires.
**Actual Result:** Passed. Marking an order as "On its way" changes its status to OUT_FOR_SERVICE and triggers the food ready notification.

### SVC-006 — Mark served (dine-in) (P0)
**Steps:** Click Served on a pickup/already-on-the-way card.
**Expected:** Status `SERVED`. Card removed from the lane. Order closes.
**Actual Result:** Passed. Marking a dine-in order as Served updates its status to SERVED, removes it from the board, and ends the active flow.

### SVC-007 — Real-time alert + chime (P1)
**Steps:** Keep service desk open. From another window place a new postpaid order.
**Expected:** Card appears with a brief flash + chime (audio requires prior page interaction due to browser autoplay rules).
**Actual Result:** Passed. Incoming postpaid orders register instantly via WebSocket connection, showing the new card with a temporary flashing highlight and an audio beep.

### SVC-008 — Fullscreen toggle (P0)
Same as KIT-007 on `/service-desk`.
**Actual Result:** Passed. Toggling fullscreen successfully expands the service desk dashboard to full-viewport size, and ESC exits back to normal.
