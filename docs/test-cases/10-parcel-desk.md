# 10 — Parcel Desk

Covers the pack / handover lanes, the realtime alert pipeline, and the
exclusion of parcel orders from the service desk.

### PCL-001 — Pack lane lists parcel orders at READY (P0)
**Pre:** parcel order completed in kitchen.
**Steps:** Open `/parcel-desk`.
**Expected:** Order appears under Pack.

### PCL-002 — Mark packed → Handover lane (P0)
**Steps:** Click "Mark packed".
**Expected:** Status moves to `READY_FOR_PICKUP`. Card moves to Handover. `PICKUP_READY` alert fires.

### PCL-003 — Mark handed over (P0)
**Steps:** Click "Mark handed over".
**Expected:** Status moves to `SERVED`. Card gone.

### PCL-004 — Real-time alert (P1)
Like SVC-007 but on the parcel desk room (`joinParcelDesk`).

### PCL-005 — Service desk does NOT show parcel orders (P0)
**Pre:** parcel order at READY.
**Steps:** Open `/service-desk`.
**Expected:** Order not in any lane.

### PCL-006 — Fullscreen toggle (P0)
