# 09 — Service Desk

Covers the three-lane dashboard (verify / release / pickup) and the
realtime alert pipeline.

### SVC-001 — Three lanes render correct status set (P0)
**Pre:** orders exist at READY (dine-in), OUT_FOR_SERVICE (self-service), and a postpaid order with `PENDING_VERIFICATION` items.
**Steps:** Open `/service-desk`.
**Expected:** Verify lane shows postpaid card; Release lane shows self-service card; Pickup lane shows dine-in card. Parcel orders absent.

### SVC-002 — Verify all PENDING_VERIFICATION items (P0)
**Pre:** logged in user has `MANAGE_SERVICE_DESK`.
**Steps:** Click Confirm on a verify card.
**Expected:** Items move to PENDING (kitchen sees them now). 200 response. Audit log line written.

### SVC-003 — Strike unverified items (P1)
**Steps:** Click Strike → confirm dialog.
**Expected:** Items move to CANCELLED. Card disappears.

### SVC-004 — Release self-service order (P0)
**Steps:** Click Release for pickup.
**Expected:** Status moves to `READY_FOR_PICKUP`. Customer alert `PICKUP_READY` fires.

### SVC-005 — Mark on its way (dine-in) (P0)
**Steps:** Click "On its way" on a pickup card.
**Expected:** Status moves to `OUT_FOR_SERVICE`. Customer alert `ORDER_READY` fires.

### SVC-006 — Mark served (dine-in) (P0)
**Steps:** Click Served on a pickup/already-on-the-way card.
**Expected:** Status `SERVED`. Card removed from the lane. Order closes.

### SVC-007 — Real-time alert + chime (P1)
**Steps:** Keep service desk open. From another window place a new postpaid order.
**Expected:** Card appears with a brief flash + chime (audio requires prior page interaction due to browser autoplay rules).

### SVC-008 — Fullscreen toggle (P0)
Same as KIT-007 on `/service-desk`.
