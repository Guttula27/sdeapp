# 10 — Parcel Desk

Covers the pack / handover lanes, the realtime alert pipeline, and the
exclusion of parcel orders from the service desk.

### PCL-001 — Pack lane lists parcel orders at READY (P0)
**Pre:** parcel order completed in kitchen.
**Steps:** Open `/parcel-desk`.
**Expected:** Order appears under Pack.
**Actual Result:** Passed. When the kitchen completes all items in a parcel order, it transitions to READY and appears correctly in the Pack lane of the parcel desk dashboard.

### PCL-002 — Mark packed → Handover lane (P0)
**Steps:** Click "Mark packed".
**Expected:** Status moves to `READY_FOR_PICKUP`. Card moves to Handover. `PICKUP_READY` alert fires.
**Actual Result:** Failed (Logic Bypass Bug). Marking a parcel as packed works correctly. However, if the chef on the kitchen board marks a parcel item as "Served" directly, the parent order auto-completes and immediately vanishes from the Parcel Desk dashboard, bypassing the Pack/Handover workflow and causing the order to be missed by parcel desk staff.

### PCL-003 — Mark handed over (P0)
**Steps:** Click "Mark handed over".
**Expected:** Status moves to `SERVED`. Card gone.
**Actual Result:** Passed. Handing over the parcel updates the status to SERVED, removing the card from the dashboard.

### PCL-004 — Real-time alert (P1)
Like SVC-007 but on the parcel desk room (`joinParcelDesk`).
**Actual Result:** Passed. New ready-to-pack orders register in real time over the socket connection and play a distinctive chime.

### PCL-005 — Service desk does NOT show parcel orders (P0)
**Pre:** parcel order at READY.
**Steps:** Open `/service-desk`.
**Expected:** Order not in any lane.
**Actual Result:** Passed. Service desk query filters out all parcel orders so they never appear on the service desk dashboard.

### PCL-006 — Fullscreen toggle (P0)
**Expected:** Toggling fullscreen expands the view; ESC exits.
**Actual Result:** Passed. The fullscreen toggle button expands the page content to occupy the entire screen, and ESC exits back to the standard layout.
