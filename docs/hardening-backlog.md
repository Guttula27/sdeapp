# Hardening Backlog

Scenarios that are good to address before production / scale-up, captured
during the offline-tolerance arc (Layers 1–5). Ranked by likelihood +
blast radius. Each item names the failure mode, why it bites, and the
shortest credible fix.

Captured: 2026-05-26.

---

## 🔴 Top tier — would call you at 2 AM

### 1. Razorpay payment reconciliation gap

**Problem.** We trust the client to call `POST /cluster-orders/:id/verify`
(or `POST /payments/razorpay/verify` for standalone) after the gateway
captures. If the customer's network drops *after* Razorpay charges the
card but *before* the verify call lands, the order stays `PENDING`
forever and the customer is charged with no order on file.

**Why it bites.** Payments are the highest-stakes write in the system.
Manual reconciliation is slow and embarrassing.

**Fix.**
- Add a Razorpay webhook handler (`payment.captured` event) as the
  source of truth for "did this payment land".
- Background job: poll Razorpay for any ClusterOrder / Payment in
  `PENDING` state older than 5 minutes and reconcile.
- Dedupe on `razorpayPaymentId` so the webhook and the client's verify
  call can both arrive without doubling up.
- Verify the Razorpay webhook signature (the helper already exists in
  `razorpay.service.ts`: `verifyWebhookSignature`).

---

### 2. Audit log for money-moving + sensitive operations

**Problem.** No structured record of who did what when. "Customer says
they were charged ₹500 but no order shows up" → no answer. Same for
manual order cancellations, item availability flips, price edits, and
admin overrides.

**Why it bites.** Support tickets balloon. Trust erodes quickly when
you can't tell a customer / business owner exactly what happened.

**Fix.**
- New `AuditLog { id, actorId, actorRole, action, scope, before, after,
  createdAt }` Prisma model.
- NestJS interceptor (similar shape to `IdempotencyInterceptor`) that
  records mutations on opt-in routes. Decorator-driven so individual
  endpoints declare what they audit.
- Critical surface to start: cancel order, cancel item, edit item
  price, edit GST, refund, add/remove cluster member, deactivate outlet.

---

### 3. Idempotent kitchen / order state transitions

**Problem.** Two chefs at the same station tap "Mark Ready" on the
same item ~50ms apart → second PATCH throws. Same race for cancel vs.
mark-served.

**Why it bites.** Pop-up errors in the kitchen feel like the app is
broken. Some chefs will keep tapping until something else breaks.

**Fix.**
- In `OrdersService.updateItemStatus` (and `updateStatus`): if current
  state already equals target state, return 200 + current row. Don't
  throw.
- Add a server-side guard rejecting *backward* transitions (e.g.
  `SERVED → PREPARING` should still 409). Catch real misuse without
  triggering on benign double-taps.
- Pair with the existing `IdempotencyInterceptor` so retried PATCHes
  via the outbox don't double-emit kitchen socket events.

---

## 🟡 Mid tier — eventual pain

### 4. Session / token refresh mid-checkout

**Problem.** Customer JWT expires while they're picking items. They hit
Place Order → 401 → axios redirects to `/login` → cart lost, navigation
lost.

**Fix.** On 401, attempt one silent refresh via `/auth/refresh` using
the stored `refreshToken`. Only redirect to login if that fails too.
The refresh endpoint already exists.

---

### 5. Outlet operations boundary cases

**Problem.** A handful of state transitions have undefined behaviour:
- Outlet deactivated while open postpaid tabs exist
- Cluster member's source business deactivated
- Admin changes GST mid-day; existing closed orders are safe (frozen
  per-line `gstRate`) but new items appended to *open* postpaid tabs
  could use the new rate inconsistently

**Fix.** Add explicit guards in the deactivation flow (block if
`OPEN orders > 0`, or warn + drain). Snapshot `gstRate` on appended
items too. Treat outlet deactivation as a soft action — admin gets a
warning with the affected counts.

---

### 6. Customer PWA bundle size

**Problem.** `dist/assets/index-*.js` is 1.8MB minified, 550KB gzipped.
On 3G inside a restaurant basement that's a 5–10s blank-screen wait.

**Fix.**
- Route-based code-splitting via `React.lazy()` + `<Suspense>`.
  Likely splits: `/cluster/:code/*`, `/order`, `/pay`, `/receipt/*`,
  `/track/*`, `/history`, `/alerts`.
- Vite's manual chunks for vendor (`react`, `axios`, `socket.io-client`).
- Aim: initial chunk ≤ 300KB gzipped.

---

### 7. Time zones / clock skew

**Problem.** Today every outlet defaults to `country: India`; the UI
formats timestamps via `new Date().toLocaleString()` which uses the
*client's* timezone. The moment one outlet operates in a different TZ
or the platform expands beyond India, hourly reports, "Outlet opens at
09:00" gating, and "X mins ago" elapsed timers all skew.

**Fix.**
- Add `Outlet.timezone` (IANA string, e.g. `Asia/Kolkata`).
- Format all time-sensitive UI via a tz-aware helper that takes the
  outlet's TZ, not the client's.
- Snapshot the outlet timezone on receipts.

---

## 🟢 Lower tier — nice-to-have insurance

### 8. Stock oversell on simultaneous checkouts
**Status.** Believed correct — `OrdersService.create` uses
`updateMany WHERE availableQuantity >= qty` which is atomic. Worth
confirming under load before relying on it for the inventory module.

### 9. Customer OTP brute-force
**Fix.** Throttle `/auth/customer/request-otp` + `/verify-otp` to ≤3 per
phone per 5 minutes. Server-side rate-limit middleware (the
`@nestjs/throttler` is already in the app module).

### 10. Receipt print failure
**Problem.** No retry, no record of which orders printed successfully.
**Fix.** A small `PrintJob { orderId, status, attempts, lastError }`
queue. Matters when thermal printer integration ships.

### 11. Image upload size
**Problem.** Items / business logos store data URLs in `db.Text`.
A malicious or careless 50MB image bloats the row and the menu fetch.
**Fix.** Enforce a server-side ≤2MB limit on every image-accepting
endpoint. Frontend `fileToDataUrl` already compresses, but it's not
mandatory on all upload paths.

### 12. Cross-tab logout sync
**Problem.** Log out in tab A → tab B still functional with a stale
token until its next 401.
**Fix.** `BroadcastChannel('paynpik-auth')` — broadcast logout, peers
listen + redirect.

### 13. Receipt regeneration after refund
**Problem.** Refund updates the order but doesn't auto-regenerate the
PDF receipt. Customer's stored copy shows the original total.
**Fix.** Add `OrderReceiptVersion` or generate-on-demand.

### 14. Multi-device staff sessions
**Problem.** Same cashier logged in on POS + their phone. Both call
"Mark order PAID" — only one wins; the other thinks it failed.
**Fix.** Already covered by item #3 (idempotent transitions). Add a
"last-seen device" indicator if the conflict surfaces operationally.

### 15. Captured Razorpay payments with no order
**Problem.** Edge of #1 — payment succeeded, order creation step
failed (DB connection drop). Razorpay has the money, we don't have
an order to refund against.
**Fix.** Same reconciliation job as #1, plus an alert when the
payment-to-order linkage is missing.

---

## What to tackle first

**Recommended bundle:** #1 (Razorpay reconciliation) + #2 (audit log)
+ #3 (idempotent state transitions). These three are the
production-readiness floor for a payments-touching multi-tenant SaaS.

Rough estimate:
- #1: ~half day (webhook + reconciliation job + tests)
- #2: ~half day (model + interceptor + 5–6 endpoints decorated)
- #3: ~1 hour (Service tweaks + idempotency check)

Everything else can wait until real-user signal tells you which one
hurts most.

---

## What's NOT on this list (deliberately)

- Full GDPR / DPDP machinery — out of scope until India-DPDP enforcement
  + EU presence
- SSO / SAML — not needed at this scale
- Distributed tracing — useful but premature; structured logging via
  Pino + a request-id middleware buys 80% of the value at 5% of the cost
- Complex inventory reconciliation — wait for the inventory module to
  actually ship
