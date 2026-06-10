# 12 — Payments

Covers cash / UPI / Razorpay payment paths, the platform-fee deduction,
webhook signature verification, and reward earn idempotency.

### PAY-001 — Cash payment auto-confirms (P0)
**Steps:** Place order with `paymentMode=CASH`.
**Expected:** Payment row `status=SUCCESS`. Customer alert `PAYMENT_RECEIVED` fires.

### PAY-002 — UPI manual confirm (P0)
**Steps:** Place order with `paymentMode=UPI` → backend or admin marks the payment SUCCESS via `confirmPayment`.
**Expected:** Order's payment becomes SUCCESS; reward earn fires if applicable.

### PAY-003 — Razorpay create order with LA configured (P0)
**Pre:** outlet has Route ID.
**Steps:** `POST /payments/:id/razorpay/order`.
**Expected:** Route order created. Persisted `gatewayRef` (encrypted) starts `enc:v1:`. `transfers[]` carries outlet's LA + `(total − fee)` as the amount.

### PAY-004 — Platform fee deducted from transfer (P0)
**Pre:** platform default 2.5% / ₹2 min; LA configured.
**Steps:** Pay ₹500.
**Expected:** Transfer amount routed to LA = ₹500 − ₹12.50 = ₹487.50. The `notes.platformFee` on the Razorpay order = `12.50`.

### PAY-005 — Per-business fee override applied (P1)
**Pre:** business B has override 3% / ₹3.
**Steps:** Pay through an outlet of business B.
**Expected:** Fee = 3% min ₹3. Verified in `routeTransfers` JSON.

### PAY-006 — Verify Razorpay handler signature matches (P0)
**Steps:** Backend `verifyRazorpayPayment` with valid signature.
**Expected:** 200. Payment moves to SUCCESS.

### PAY-007 — Verify rejects mismatched gatewayRef (P0)
**Pre:** the stored `gatewayRef` (encrypted) ≠ inbound `razorpayOrderId`.
**Expected:** 400 "Razorpay order id mismatch" — the decrypt call returns the original id for comparison.

### PAY-008 — Webhook signature accepted (P1)
**Steps:** POST raw `payment.captured` payload with valid HMAC to `/payments/webhooks/razorpay`.
**Expected:** Payment moves to SUCCESS. Idempotent on replay (Idempotency-Key flow).

### PAY-009 — Webhook rejected on bad signature (P0)
**Steps:** Send same payload with wrong sig.
**Expected:** 401.

### PAY-010 — Reward EARN idempotent across retries (P1)
**Steps:** Call `tryEarnRewards` twice for the same order.
**Expected:** Only one `RewardTransaction.type='EARN'` row.

### PAY-011 — Payment list per order (P1)
**Steps:** `GET /payments/order/:orderId`.
**Expected:** Returns array. `gatewayRef` shown as plaintext (decrypted on read).
