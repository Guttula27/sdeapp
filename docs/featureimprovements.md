# Feature Improvements & Open Items

Forward-looking view of what's still pending in the platform and which
improvements are worth picking up next. Generated 2026-06-10.

Related docs:
- `docs/hardening-backlog.md` — pre-existing hardening list. Several
  items below cross-reference its numbering (`HB-#1`, `HB-#10`, …).
- `docs/recent-features.md` — what's already shipped this cycle.
- `docs/permissions.md`, `docs/data-security.md`, `docs/test-cases/` —
  the working playbooks each new feature should respect.

---

## 1. Must-have — known gaps that bite in prod

In rough order of "when does it actually hurt". These are things we
already flagged as still-open in the backlog or as deliberate
follow-ups from the work done this cycle — none are theoretical.

| # | Gap | What happens if you don't | Effort |
|---|---|---|---|
| 1.1 | **Razorpay reconciliation webhook + polling job** (HB-#1) | Customer's payment captures but the client-side verify call drops on a flaky network → order stays `PENDING` forever, customer is charged with no order on file. | ½ day |
| 1.2 | **Customer OTP rate-limit** (HB-#9) | Anyone can spam a phone with `for i in {1..1000}; do curl … /request-otp; done` and DoS the OTP table. `@nestjs/throttler` is already imported in `app.module.ts` — needs a decorator on the OTP endpoints. | 2h |
| 1.3 | **Image upload size cap** (HB-#11) | Item / logo / outlet images live as data URLs in `db.Text`. A 50 MB upload bloats the row and the menu fetch. Cap server-side at 2 MB; frontend `fileToDataUrl` already compresses but it's not mandatory on every upload path. | 2h |
| 1.4 | **DB backup automation** | No scheduled `mysqldump` to off-box storage today. A single bad migration or a Hostinger VPS incident loses every order ever. | ½ day |
| 1.5 | **Drop plaintext `phone` column** | Kept intentionally as a one-cycle safety net during the phone-encryption rollout. Once HMAC lookups are verified in prod (a few days of real traffic), the plaintext column should go via a small migration. | 1h once verified |
| 1.6 | **`appendItems` GST-on-net** | Deliberate follow-up from the GST-on-net work. Postpaid open tabs that happen to carry a bill-level auto-discount currently charge GST on gross. Most postpaid orders don't apply discounts during the open phase, so the bug is dormant — but real. | 2h |
| 1.7 | **Receipt regen after refund** (HB-#13) | Customer's stored PDF / printed receipt shows the original total even after the refund posts. | ½ day |

**If you only ship one of these next, ship 1.1.** Real money risk.

### Acceptance hints

- **1.1**: A new `RazorpayReconcilerService` (Bull queue, runs every
  5 min) pulls every Payment in `PENDING` older than `5*60s` from
  Razorpay and reconciles. Same shape for ClusterOrder. The webhook
  handler already exists in `payments.controller.razorpay/webhook`
  — extend it to handle `payment.failed` and `refund.processed`
  too.
- **1.2**: `@Throttle({ default: { limit: 3, ttl: 60_000 } })`
  decorator on `/auth/customer/request-otp` and `/verify-otp`.
- **1.3**: A `MaxImageBytesPipe` (10 MB hard cap on the data URL
  length, then 2 MB after the existing compression). Apply to every
  endpoint that accepts `imageUrl` / `logoUrl` / `images[]`.

---

## 2. Operational must-have — to call this "production-ready"

What's missing from the runbook side.

| # | Thing | Why |
|---|---|---|
| 2.1 | **CI workflow** | `DEPLOYMENT.md` references `.github/workflows/ci-cd.yml`, but it doesn't exist. PRs aren't gated. A minimal `tsc --noEmit && nest build && vite build --workspace=...` per workspace catches the regressions we hit during the Nixpacks debug. |
| 2.2 | **Monitoring + alerts** | Winston writes to local disk on the Dokploy box. There's no sink to Loki / Datadog and no alerting on the `audit-*.log` stream. A `payment.failed` rate spike won't page anyone. |
| 2.3 | **Health-check granularity** | Current `/health` returns `{status: 'ok'}` always. A `/health/deep` that pings DB + Redis + Razorpay reachability lets Dokploy auto-restart on degradation. |
| 2.4 | **Cross-tab logout sync** (HB-#12) | Log out in tab A → tab B still functional with a stale token until its next 401. `BroadcastChannel('paynpik-auth')` is the canonical fix. |
| 2.5 | **Print job queue + retry** (HB-#10) | A Bluetooth print failure today is just a toast; the receipt never gets a second chance. A small `PrintJob { orderId, status, attempts, lastError }` queue solves it. |

### Suggested CI starter (so it's not abstract)

```yaml
# .github/workflows/ci.yml
name: ci
on: [pull_request]
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: cd apps/api && npx prisma generate
      - run: cd apps/api && npx tsc --noEmit -p tsconfig.json
      - run: cd apps/api && npm run build
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: cd apps/web && npx tsc --noEmit
      - run: cd apps/web && npx vite build
  customer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: cd apps/customer && npx tsc --noEmit
      - run: cd apps/customer && npx vite build
```

---

## 3. Product gaps noticed in the codebase

Not explicitly flagged anywhere, but the code makes them obvious.

| # | Gap | Notes |
|---|---|---|
| 3.1 | **Inventory + Vendors modules disabled** | `apps/web/src/App.tsx` redirects both routes to `/dashboard`. Either ship them or remove the nav rows. |
| 3.2 | **Reports module is shallow** | The `reports` module exists but the UI only shows a couple of canned reports. Operators usually want: GST report (CGST/SGST split by date range, exportable for filing), item sales by period, item-mix by table type, top-N customers, hourly throughput vs staff on shift. |
| 3.3 | **No image upload to object storage** | Everything's a data URL in MySQL today. Moving to S3 / Cloudflare R2 reduces DB size and makes CDN-edge thumbnails actually viable. Pairs naturally with 1.3. |
| 3.4 | **No admin PWA / offline service worker** | Customer PWA has Workbox; admin doesn't. The offline POS work fakes this with IndexedDB + outbox, but a real SW would also cache the admin app shell so the first paint works offline. |
| 3.5 | **Admin web i18n** | Customer PWA has i18next + Lingva backend. Admin is English-only. |
| 3.6 | **Refund flow audit** | Disputes exist; refunds happen via `Payment.isRefund=true` rows; but there's no operator dashboard summarising "what got refunded last week, against which orders, by which staff". |

---

## 4. Good-to-have — improves the product without being load-bearing

| # | Thing | Notes |
|---|---|---|
| 4.1 | **Tip / service charge** | Indian restaurants commonly add a 5–10% service charge line. No field on Order for it today. |
| 4.2 | **Web push notifications** | Customer PWA could push order-ready alerts even when the tab is backgrounded. |
| 4.3 | **Customer loyalty tiers** | Rewards exist; tiered VIP customers (auto-applied discounts) is a common ask. |
| 4.4 | **Offline-orders auto-reconcile UX** | Reconciliation view shows pending / synced / failed. Next step: show the server's `ON-` order side-by-side with the printed `OFF-` so staff can manually cross-check. |
| 4.5 | **Bulk operations** | "Mark all PREPARING items READY" for a station, or "Cancel all unconfirmed postpaid orders older than 30m". |
| 4.6 | **Customer feedback prompt** | A `feedback` module exists; surface a rating prompt in the customer PWA after `SERVED`. |
| 4.7 | **Token counter rollover** | `nextTokenNumber` increments forever. A start-of-day reset (or a configurable rollover) prevents token #4231 by Friday. |
| 4.8 | **Cluster shared-seating UI** | Cluster has a `tableId` on the parent but no real shared-seating UI. Real food courts share tables across outlets. |
| 4.9 | **Convert the test catalogue to executable tests** | `docs/test-cases/` is 165 cases. Getting the P0 set into Jest + supertest is one focused day per module. Phased plan is in `docs/test-cases/README.md`. |

---

## 5. Two-week recommendation

If I had to scope the next ~10 working days:

| Day(s) | Item | Reference |
|---|---|---|
| 1–2 | Razorpay reconciliation webhook + 5-min polling job | 1.1 |
| 3 | OTP rate-limit + image upload cap | 1.2 + 1.3 |
| 4 | DB backup automation | 1.4 |
| 5 | CI workflow + a `/health/deep` endpoint | 2.1 + 2.3 |
| 6–7 | Cross-tab logout + print job queue | 2.4 + 2.5 |
| 8 | Drop plaintext `phone` column (after verifying #1.5) + appendItems GST fix | 1.5 + 1.6 |
| 9–10 | Receipt regen on refund + first round of Jest tests for `02-permissions` and `12-payments` | 1.7 + 4.9 |

The first three days close the largest "real money + real data" risks.
The CI ensures the next deploy doesn't regress the work we've just
landed. The rest is polish + harden.

---

## 6. Pure exploration — not on the critical path

These come up if/when the business asks, not because the code says so:

- **Multi-currency** (currently INR-only — `Number(...)` is fine until a non-INR outlet onboards).
- **Multi-tenant data isolation tests** — the `scopeFor(user)` plumbing exists, but cross-tenant fuzzing isn't covered.
- **A11y audit** — buttons, form labels, focus rings. Worth a one-day pass before pitching to enterprise.
- **Per-tenant encryption keys (BYOK)** — currently one platform-wide `APP_ENCRYPTION_KEY`. A single tenant ever demanding BYOK is the natural extension point.
- **WhatsApp template approvals dashboard** — there's a `template-approvals` route already; not sure how well it works in practice.

---

## How to use this doc

- Each row in §1–§4 should become a ticket if you decide to tackle it.
  Copy the description + the `Effort` cell into the ticket as the
  acceptance criteria; reference back here so the original context
  isn't lost.
- If something gets done, move it out of this doc (or strike through
  + cross-reference the commit) so the file stays focused on
  what's still open.
- Treat §5 as a rolling 2-week plan; revisit + refresh the row order
  whenever priorities shift.
