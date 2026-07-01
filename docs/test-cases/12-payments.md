# 12 — Payments

Covers cash / UPI / Razorpay payment paths, the platform-fee deduction,
webhook signature verification, and reward earn idempotency.

### PAY-001 — Cash payment auto-confirms (P0)
**Steps:** Place order with `paymentMode=CASH`.
**Expected:** Payment row `status=SUCCESS`. Customer alert `PAYMENT_RECEIVED` fires.
**Actual Result: [PASSED]** Cash checkout automatically triggers the `confirmPayment` routine, which marks the database row as `SUCCESS` and dispatches the `PAYMENT_RECEIVED` event.

### PAY-002 — UPI manual confirm (P0)
**Steps:** Place order with `paymentMode=UPI` → backend or admin marks the payment SUCCESS via `confirmPayment`.
**Expected:** Order's payment becomes SUCCESS; reward earn fires if applicable.
**Actual Result: [PASSED]** Confirming a pending UPI payment via `/payments/:id/confirm` sets status to `SUCCESS` and launches the reward points credit logic.

### PAY-003 — Razorpay create order with LA configured (P0)
**Pre:** outlet has Route ID.
**Steps:** `POST /payments/:id/razorpay/order`.
**Expected:** Route order created. Persisted `gatewayRef` (encrypted) starts `enc:v1:`. `transfers[]` carries outlet's LA + `(total − fee)` as the amount.
**Actual Result: [PASSED]** Creating a Razorpay order encrypts the order ID as a `gatewayRef` (prefixed with `enc:v1:`) and sets up the routing transfers list with the outlet's decrypted account ID.

### PAY-004 — Platform fee deducted from transfer (P0)
**Pre:** platform default 2.5% / ₹2 min; LA configured.
**Steps:** Pay ₹500.
**Expected:** Transfer amount routed to LA = ₹500 − ₹12.50 = ₹487.50. The `notes.platformFee` on the Razorpay order = `12.50`.
**Actual Result: [PASSED]** The platform fee calculation automatically subtracts the default 2.5% fee (minimum ₹2) from the routed transfer amount, capturing the fee into the master account.

### PAY-005 — Per-business fee override applied (P1)
**Pre:** business B has override 3% / ₹3.
**Steps:** Pay through an outlet of business B.
**Expected:** Fee = 3% min ₹3. Verified in `routeTransfers` JSON.
**Actual Result: [PASSED]** If a custom business-tier fee override is set (e.g., 3%), the calculator correctly applies the override rates rather than the platform defaults.

### PAY-006 — Verify Razorpay handler signature matches (P0)
**Steps:** Backend `verifyRazorpayPayment` with valid signature.
**Expected:** 200. Payment moves to SUCCESS.
**Actual Result: [PASSED]** Verifying the Razorpay payment signature via `verifyHandlerSignature` returns 200 on success and auto-settles the payment status to `SUCCESS`.

### PAY-007 — Verify rejects mismatched gatewayRef (P0)
**Pre:** the stored `gatewayRef` (encrypted) ≠ inbound `razorpayOrderId`.
**Expected:** 400 "Razorpay order id mismatch" — the decrypt call returns the original id for comparison.
**Actual Result: [PASSED]** Rejects payment verification with a 400 error if the decrypted `gatewayRef` stored in the database does not match the incoming `razorpayOrderId`.

### PAY-008 — Webhook signature accepted (P1)
**Steps:** POST raw `payment.captured` payload with valid HMAC to `/payments/webhooks/razorpay`.
**Expected:** Payment moves to SUCCESS. Idempotent on replay (Idempotency-Key flow).
**Actual Result: [PASSED]** The webhook signature verification is processed successfully on capturable events (`payment.captured`), updating payment status to `SUCCESS`.

### PAY-009 — Webhook rejected on bad signature (P0)
**Steps:** Send same payload with wrong sig.
**Expected:** 401.
**Actual Result: [PASSED]** Capturing webhook triggers with incorrect HMAC signatures returns a 401 Unauthorized status, blocking processing.

### PAY-010 — Reward EARN idempotent across retries (P1)
**Steps:** Call `tryEarnRewards` twice for the same order.
**Expected:** Only one `RewardTransaction.type='EARN'` row.
**Actual Result: [PASSED]** Reward points credits are protected by an idempotency check, which queries the database for existing `EARN` transactions before issuing points.

### PAY-011 — Payment list per order (P1)
**Steps:** `GET /payments/order/:orderId`.
**Expected:** Returns array. `gatewayRef` shown as plaintext (decrypted on read).
**Actual Result: [FAILED] (Decryption Loophole)** The endpoint returns the database rows directly, exposing the raw encrypted `gatewayRef` (e.g., starting with `enc:v1:`) to the client without decrypting it.
