# 18 — Real-time sockets

Covers the Socket.IO room routing for kitchen, service desk, parcel desk,
table, customer and order rooms.

### SOC-001 — Order created emits to outlet room (P0)
**Steps:** Open a websocket on `joinOutlet`. Place an order.
**Expected:** `orderCreated` event received.

### SOC-002 — Order status update fans out (P0)
**Steps:** Open kitchen, service-desk, parcel-desk sockets simultaneously.
**Expected:** Each receives `orderStatusUpdated` when status changes.

### SOC-003 — Service desk alert kinds routed correctly (P0)
- Self-service kitchen-done → `serviceDeskAlert { kind: 'release' }`.
- Dine-in kitchen-done → `serviceDeskAlert { kind: 'pickup' }`.
- New postpaid line → `serviceDeskAlert { kind: 'verify' }`.

### SOC-004 — Parcel desk alert kinds (P0)
- Parcel READY → `parcelDeskAlert { kind: 'pack' }`.
- Parcel READY_FOR_PICKUP → `parcelDeskAlert { kind: 'handover' }`.

### SOC-005 — Customer alert delivered to customer room (P1)
**Pre:** customer joined `customer:<id>`.
**Steps:** Trigger `PICKUP_READY` lifecycle dispatch.
**Expected:** `customerAlert` event received.
