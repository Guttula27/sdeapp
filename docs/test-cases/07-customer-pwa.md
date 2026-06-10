# 07 — Customer PWA

Covers the customer ordering flow on the standalone PWA: QR scan, cart,
checkout, live tracking, and alerts.

### CUST-001 — QR scan resolves to outlet/table (P0)
**Steps:** Scan an outlet table QR.
**Expected:** Land on menu with the table identity set.

### CUST-002 — Add items, modify quantity, remove (P0)
**Steps:** Add item → +/- in cart → remove.
**Expected:** Cart state persisted in session storage; toppings allowed per item config.

### CUST-003 — Apply coupon (P1)
**Steps:** Enter / pick a coupon code.
**Expected:** Discount reflected on quote; on order placement, GST is computed on the net.

### CUST-004 — Pay via Razorpay (P0)
**Pre:** outlet has Route ID set + Razorpay configured.
**Steps:** Choose Pay via Razorpay → complete the Razorpay flow.
**Expected:** Order moves to paid. Backend captures via verify endpoint.

### CUST-005 — Pay via Razorpay hidden when LA empty (P0)
Already covered by OUT-005 — keep duplicate for the customer view.

### CUST-006 — Offline PWA can browse cached menu (P1)
**Steps:** Visit outlet menu while online → go offline → reload.
**Expected:** Workbox service worker serves cached menu.

### CUST-007 — Order tracking page shows live status (P0)
**Steps:** Place order → tracking page.
**Expected:** Socket pushes status changes in real time (READY, OUT_FOR_SERVICE, SERVED).

### CUST-008 — Customer alert sounds for ITEM_READY (P2)
**Pre:** customer linked to order.
**Steps:** Kitchen marks an item READY.
**Expected:** PWA plays the configured ringtone + shows in-app alert.
