# 21 — Smoke + regression

End-to-end happy paths and the curl-based smoke script. Run these on
every release.

### SMK-001 — End-to-end staff happy path (P0)
1. Login as Outlet Admin.
2. Place a counter order (cash).
3. Move it through QUEUED → PREPARING → READY → OUT_FOR_SERVICE → SERVED via kitchen + service desk.
4. Open the order log; verify each transition has the right actor.
5. Reprint the receipt.
**Expected:** All actions succeed.
**Actual Result: [PASSED]** Staff flow behaves correctly: order creation, KDS status updates fanning out in real-time, audit logs capturing actors, and receipt reprints working without errors.

### SMK-002 — End-to-end customer happy path (P0)
1. Customer scans table QR.
2. Add items; apply a coupon.
3. Pay via Razorpay (test mode).
4. Track order status updates live.
5. Verify customer reward EARN row appears post-confirm.
**Expected:** All actions succeed.
**Actual Result: [PASSED]** Customer flow works end-to-end: QR table scanning, cart coupon discount deductions, test-mode payment capture, order tracking live websocket updates, and automated reward points crediting.

### SMK-003 — Smoke script run (P0)
**Steps:** `API=… STAFF_PHONE=… STAFF_PASS=… OUTLET_ID=… bash scripts/smoke-test.sh`.
**Expected:** All green ticks; no failed lines.
**Actual Result: [PASSED]** Running the shell script `bash scripts/smoke-test.sh` against a booted api server successfully logs in, places a test order, confirms payment, updates status, and finishes with all test points passing.
