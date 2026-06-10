# 16 — Audit log + per-order log

Covers the Winston-backed audit log stream, the per-order log endpoint,
and the redaction filters (phone masking, secret-key removal).

### LOG-001 — Order status change logged (P0)
**Steps:** Move an order through CREATED → QUEUED → SERVED → tail `logs/audit-*.log`.
**Expected:** One JSON line per transition with type=`ORDER_STATUS_CHANGED`, `actorId`, `from`, `to`.

### LOG-002 — Item status change logged (P1)
**Steps:** Kitchen marks an item READY.
**Expected:** `ORDER_ITEM_STATUS_CHANGED` line.

### LOG-003 — Payment confirmed logged (P0)
**Steps:** Confirm a Razorpay payment.
**Expected:** `PAYMENT_CONFIRMED` with `amount`, `mode`, `gatewayRef` (redacted by the log filter).

### LOG-004 — Postpaid verify logged (P1)
**Steps:** Confirm postpaid lines.
**Expected:** `POSTPAID_VERIFICATION` with action + itemCount.

### LOG-005 — Permission grant logged (P1)
**Steps:** Toggle a responsibility on a role.
**Expected:** `PERMISSION_CHANGED` line.

### LOG-006 — Per-order audit endpoint (P0)
Already covered by ORD-007.

### LOG-007 — Phone numbers masked in logs (P0)
**Steps:** Trigger a code path that logs an object containing a phone (e.g. failed login).
**Expected:** Log line shows `***1234` not the full number.

### LOG-008 — Sensitive keys redacted (P0)
**Steps:** Trigger a Razorpay webhook log path.
**Expected:** `razorpaySignature`, `password`, `otp`, `token` keys show as `[REDACTED]`.
