# 21 — Smoke + regression

End-to-end happy paths and the curl-based smoke script. Run these on
every release.

### SMK-001 — End-to-end staff happy path (P0)
1. Login as Outlet Admin.
2. Place a counter order (cash).
3. Move it through QUEUED → PREPARING → READY → OUT_FOR_SERVICE → SERVED via kitchen + service desk.
4. Open the order log; verify each transition has the right actor.
5. Reprint the receipt.

### SMK-002 — End-to-end customer happy path (P0)
1. Customer scans table QR.
2. Add items; apply a coupon.
3. Pay via Razorpay (test mode).
4. Track order status updates live.
5. Verify customer reward EARN row appears post-confirm.

### SMK-003 — Smoke script run (P0)
**Steps:** `API=… STAFF_PHONE=… STAFF_PASS=… OUTLET_ID=… bash scripts/smoke-test.sh`.
**Expected:** All green ticks; no failed lines.
