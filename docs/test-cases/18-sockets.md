# 18 — Real-time sockets

Covers the Socket.IO room routing for kitchen, service desk, parcel desk,
table, customer and order rooms.

### SOC-001 — Order created emits to outlet room (P0)
**Steps:** Open a websocket on `joinOutlet`. Place an order.
**Expected:** `orderCreated` event received.
**Actual Result: [PASSED]** Placing an order successfully emits the `orderCreated` event to both the generic outlet room (`outlet:${outletId}`) and the kitchen room (`kitchen:${outletId}`).

### SOC-002 — Order status update fans out (P0)
**Steps:** Open kitchen, service-desk, parcel-desk sockets simultaneously.
**Expected:** Each receives `orderStatusUpdated` when status changes.
**Actual Result: [PASSED]** Changing an order status broadcasts the `orderStatusUpdated` event to all interested rooms (`outlet`, `kitchen`, `service-desk`, `parcel-desk`, `table`, and `order`).

### SOC-003 — Service desk alert kinds routed correctly (P0)
- Self-service kitchen-done → `serviceDeskAlert { kind: 'release' }`.
- Dine-in kitchen-done → `serviceDeskAlert { kind: 'pickup' }`.
- New postpaid line → `serviceDeskAlert { kind: 'verify' }`.
**Expected:** Alert sent to service-desk room.
**Actual Result: [PASSED]** Service Desk alerts correctly route the specific kinds (`verify`, `release`, `pickup`) to the `service-desk:${outletId}` room.

### SOC-004 — Parcel desk alert kinds (P0)
- Parcel READY → `parcelDeskAlert { kind: 'pack' }`.
- Parcel READY_FOR_PICKUP → `parcelDeskAlert { kind: 'handover' }`.
**Expected:** Alert sent to parcel-desk room.
**Actual Result: [PASSED]** Parcel Desk alerts correctly route packaging nudges (`pack`, `handover`) to the `parcel-desk:${outletId}` room.

### SOC-005 — Customer alert delivered to customer room (P1)
**Pre:** customer joined `customer:<id>`.
**Steps:** Trigger `PICKUP_READY` lifecycle dispatch.
**Expected:** `customerAlert` event received.
**Actual Result: [PASSED]** Invoking `emitCustomerAlert` delivers the `customerAlert` event payload to the target customer and order tracking rooms.
