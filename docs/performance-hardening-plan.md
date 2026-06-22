# Performance & Hardening Plan

Captured: 2026-06-22. Origin: stress-test session on the local stack
(MySQL 8 in docker on `:3307`, 1 outlet, 405 items, 5000 orders, 86918
order_items, 100 customers). Findings from that test plus a follow-up
audit of the read paths, i18n flow, network/transport, data integrity,
and security posture.

Companion document: `docs/hardening-backlog.md` (incident-shaped
hardening items). This file is the **performance & scale** counterpart —
issues that won't page you at 2 AM today but will once the customer
count multiplies, plus a few cross-cutting concerns surfaced along the
way.

---

## Headline numbers from the stress test

| Endpoint | Conn | p50 | p99 | req/s | Payload |
|---|---|---|---|---|---|
| `GET /outlets/:id/menu` | 20 | 836 ms | 1.56 s | 22 | 949 KB |
| `GET /orders?outletId=…` | 20 | 606 ms | 1.15 s | 29 | 1.08 MB |
| `GET /outlets/:id/menu/popular` | 50 | 30 ms | 104 ms | 1462 | 3 KB |

`MENU` and `ORDERS` saturate at ~25 req/s under two-digit concurrency.
`POPULAR` is the empirical proof that the same kind of read, served
slim, can do 50× better.

`Innodb_rows_read` over the 20-second test window: **34M rows** for
~15,000 HTTP requests — ~2,300 rows examined per request on average.

---

## Findings — grouped by category

### A. Database & query performance

#### A1. Missing composite indexes on `paynpik_orders`
**Problem.** Only single-column FK indexes exist. `outletId`,
`createdAt`, `status` are all hot filter/sort columns with no composite.
Every orders-list query does a `Using filesort` after a 2,425-row scan
to return 50 rows.

**Evidence.** `EXPLAIN SELECT * FROM paynpik_orders WHERE outletId=? ORDER BY createdAt DESC LIMIT 50;`
→ `type=ref, key=outletId_fkey, rows=2425, Extra=Using filesort`.

**Fix.**
```sql
CREATE INDEX idx_orders_outlet_created ON paynpik_orders (outletId, createdAt);
CREATE INDEX idx_orders_outlet_status_created ON paynpik_orders (outletId, status, createdAt);
CREATE INDEX idx_orders_status ON paynpik_orders (status);
```

#### A2. Missing composite indexes on `paynpik_order_items`
**Problem.** Single-column FK index on `orderId`. Kitchen station and
popularity queries filter by `(orderId, status, itemId)` together —
forces 16-row-per-order fan-out scans plus per-row status filter.

**Fix.**
```sql
CREATE INDEX idx_orderitems_order_status_item ON paynpik_order_items (orderId, status, itemId);
CREATE INDEX idx_orderitems_status ON paynpik_order_items (status);
```

#### A3. Popularity GROUP BY recomputed on every menu render
**Problem.** `menu.service.ts:481` runs `orderItem.groupBy` (SUM of
quantity, GROUP BY itemId, ORDER BY SUM DESC LIMIT 5) on every customer
menu load. The query examined 48,475 rows to return 5, hit max 1,000 ms
under contention, and accounted for **20.1M of the 34M total InnoDB
row reads** in the test window.

**Fix.**
- Cache the top-5 popularity list per outlet in Redis with 60 s TTL.
- Reuse the existing menu-tree version counter (`menu:ver:${outletId}`)
  so writes that already bust the menu cache also bust popularity.
- Alternative: denormalise `salesLast30d` onto `paynpik_items` updated
  by order-status-transition hooks. Removes the query entirely.

#### A4. Review aggregates groupBy on every menu render
**Problem.** `menu.service.ts:564` runs `orderItemReview.groupBy`
(avg + count rating) over every item id on every menu render.

**Fix.** Denormalise `avgRating` + `ratingCount` columns onto
`paynpik_items`, updated by a review write hook. Zero queries on the
menu hot path.

#### A5. Full-table scans on auth-path tables
**Problem.** `table_io_waits_summary_by_index_usage` during the test:
- `paynpik_responsibilities` — 27k *NO INDEX* reads. Comes from
  `auth.login` and JWT-verify code path traversing role → responsibilities
  → responsibility on every authed request.
- `paynpik_users` — 49k *NO INDEX* reads. Likely encrypted-phone scan
  in the auth `findUserByPhone` flow.

**Fix.**
- Embed the resolved responsibility set (string list) into the JWT
  claims at login. Skip the DB roundtrip on every authed request.
- Audit the `findUserByPhone` path; ensure lookups use the indexed
  `phoneHash` column (HMAC), never the encrypted blob.

#### A6. Full-table scans inside menu hot path
**Problem.** `paynpik_items` 185k *NO INDEX* reads, `paynpik_variants`
73k *NO INDEX* reads — somewhere in the menu projection layer, items
and variants are being read unconstrained.

**Action.** Audit `loadMenuTreeFromDb` and `projectMenu` to find
unscoped `findMany` calls; add outlet/subcategory predicates.

#### A7. `inventory.getLowStockAlerts` filters in JavaScript
**Problem.** Reads every material of a business, then filters in JS.
Quadratic when material count grows.

**Fix.** Push the threshold filter into the DB
(`where: { availableQuantity: { lte: threshold } }`); index
`(businessId, availableQuantity)`.

#### A8. Unbounded `findMany` in translation backfill
**Problem.** `translation-backfill.service.ts:124` reads every row.
Fine today; becomes a problem once entity tables grow.

**Fix.** Cursor-batch in chunks of 500.

#### A9. Prisma connection pool not tuned
**Problem.** No `connection_limit` on the datasource URL. Defaults to
`num_cpus × 2 + 1`. Under burst load against a single dev machine, this
caps DB throughput before any single query becomes the bottleneck.

**Fix.** Set `?connection_limit=20&pool_timeout=10` on the
`DATABASE_URL` in production; tune based on observed pool exhaustion
events.

---

### B. Caching strategy

#### B1. Per-request projection is uncached
**Problem.** `loadMenuTree` is cached in Redis already (good), but
`projectMenu` re-runs popularity + review aggregates + outlet meta +
discount candidates on every request. These are outlet-level, not
per-request — they shouldn't be inside the per-request decoration
layer.

**Fix.** Extract three new keys with 30–60 s TTL, all busted by the
same outlet menu-version counter:
- `menu:popular:${outletId}` — top-5 item ids
- `menu:ratings:${outletId}` — `Map<itemId, {avg, count}>` (or skip
  entirely if A4 is done)
- `menu:autoDiscounts:${outletId}` — active offer candidates

#### B2. Cache key explodes by language
**Problem.** Today `menu:tree:v1:${outlet}:${ver}:${lang}:${audience}` —
N copies of the same tree, one per supported language. At N=22+ Indian
languages this is 22× the Redis footprint.

**Fix.** Denormalise per-language values into JSON columns on each
translatable entity. Drop `${lang}` from the cache key. Projection
picks the right field per request. See section D.

#### B3. No HTTP-level caching headers on menu reads
**Problem.** Customer PWA's service worker can cache GETs, but the
server returns no `Cache-Control` / `ETag` / `Last-Modified` on
`/menu`. Every revisit hits the API even when the menu hasn't changed.

**Fix.**
- Return `ETag: W/"${menuVersion}"` on `/menu` reads (the version
  counter is already maintained).
- Respect `If-None-Match` to return 304s.
- Set `Cache-Control: private, max-age=30, stale-while-revalidate=300`
  for anonymous reads.

---

### C. Payload & API shape

#### C1. `orders.findOne` returns 15+ relations to every consumer
**Problem.** `orders.service.ts:765` returns
`items.item.variant.menu.bundleParent.review.paybackPayment.replyBy`
+ table + section + outlet (full address) + customer.tags + payments
+ statusHistory + disputes + couponUsages + aggregator side-table on
every detail open. Customer track-order, kitchen view, dispute panel,
receipt print, and service desk all use this same kitchen-sink
endpoint.

**Fix.** Slim core endpoint + targeted sub-resources:
- `GET /orders/:id` → core (status, items name+qty+price, total, table,
  customer name, latest status timestamp).
- `GET /orders/:id/payments`
- `GET /orders/:id/disputes`
- `GET /orders/:id/status-history`
- `GET /orders/:id/reviews`
- `GET /orders/:id/coupons`
- `GET /orders/:id?format=receipt` — keep the fat shape for the receipt
  printer, which actually does need everything.

#### C2. `orders.findAll` lists ship 1 MB for 50 rows
**Problem.** Every row carries `items.item.variant.bundleParent + table
+ customer.tags + payments`. 1 MB confirmed under load.

**Fix.** Slim list (id, number, status, total, tableNumber, customerName,
itemCount, createdAt). Detail on row tap uses the existing `:id`
endpoint (which itself becomes slim per C1).

#### C3. Order status polling uses the fat detail endpoint
**Problem.** Customer "track your order" screen polls. If it hits the
fat findOne, every poll downloads kitchen+receipt data the customer
never sees.

**Fix.** Dedicated `GET /orders/:id/status` returning ~500 bytes
(`{status, currentEvent, etaMinutes}`). Subscribe via Socket.IO
`joinOrder` as primary; REST poll as fallback.

#### C4. `customers.listOrders` returns full history with no pagination
**Problem.** `customers.service.ts:97` returns every order this
customer ever placed, with item+variant+payments nested.

**Fix.** Cursor pagination, default 20, `?before=createdAt&limit=N`.
Slim line items.

#### C5. `customers.insights` computes lifetime aggregates per open
**Problem.** Three queries (lifetime aggregate, favourites in last 90d,
last visit) fire on every order-detail open just to render the
recognition pill.

**Fix.** Move to `GET /customers/:id/insights`, called once per
customer per admin session. Cache 5 min per customer.

#### C6. `disputes.findByOutlet` over-fetches order items
**Problem.** List view includes `order.items[take:2].item` per row.

**Fix.** Slim list with order number + dispute summary; items on tap.

#### C7. `outlets.findOne` includes full section/table layout
**Problem.** Every outlet-meta open pulls every section and every table.

**Fix.** Split outlet config (address, hours, image) from layout
(sections, tables). Layout fetched only when the layout/map view opens.

#### C8. Reports service fan-out
**Problem.** `reports.service.ts` has 22 findMany/groupBy across 8+
methods. Dashboard likely calls all of them together.

**Fix.** Pre-aggregate into `paynpik_outlet_daily_metrics` updated by
the order-status-transition hook. Dashboard reads roll up cached daily
buckets; "today" pulls live. Cache the rendered dashboard payload for
60–300 s per outlet.

#### C9. Service desk feed mixes structural + operational data
**Problem.** Service-station list returns `workers.user.role` +
`tables.table.section.tableType` per station. Polled often by staff
screens.

**Fix.** Split structural (stations × tables × workers — slow-changing,
cache an hour) from operational (queued orders per station —
fast-changing, slim payload, ideally Socket.IO deltas).

#### C10. Auth login returns the role→responsibility tree
**Problem.** `auth.login` (and the same path on `verifyOtp`,
`refreshToken`) returns `role.responsibilities.responsibility`. The
same join fires on every JWT verify.

**Fix.** Resolve responsibilities at login → embed as a string list in
the JWT. Verify path becomes claim-read, not DB-read. Re-issue JWT on
role change.

#### C11. `cluster-orders` carries `childOrders.items.item.variant` in lists
**Problem.** Same anti-pattern as orders — list view drags the
expanded graph.

**Fix.** Slim cluster row; children-on-expand.

---

### D. Internationalization

#### D1. Region-locale falls through to source-language miss
**Problem.** `preferredLanguageFromRequest` keeps `en-US` (lowercased)
verbatim. Source-language short-circuit checks `=== 'en'`, so every
US-English browser request triggers a 5-query translation hydrate that
returns zero rows. Net rendering is correct; the queries are wasted.

**Fix.** Strip region suffix when matching: `lang.split('-')[0]`.
One-line change in the decorator.

#### D2. Write-side translation fan-out is synchronous
**Problem.** `translations.upsertAll` blocks the staff member's menu
save while every provider × every language × every field resolves. At
N=22 languages that's 22 provider calls per field. A single Bhashini
outage cascades into 15-second timeouts on menu writes (already noted
in code comments).

**Fix.** Queue the fan-out via Bull. Source-language row persists
synchronously; per-language jobs run asynchronously with retry &
backoff. Menu save returns in <100 ms regardless of provider state.

#### D3. Cache stores N copies of the same tree
**Problem.** Once N grows beyond 2 the cost grows fast. 22 languages ×
100 outlets × ~2 MB = 4.4 GB Redis for menu trees.

**Fix.** Denormalise into JSON columns (`name_i18n`, `description_i18n`)
on each translatable entity. Source column stays for English fallback.
Cache key drops `:${lang}:`. Projection layer picks the right field at
render. One tree per outlet regardless of N.

#### D4. Lazy / on-demand translation
**Problem.** Eager backfill writes rows for every language even if
nobody reads them. At N=22 this is expensive provider time + dormant
storage.

**Fix.** Translate on first request for that language at that outlet,
write through to the JSON column, serve thereafter. Combined with D3,
provider cost scales with `items × languages_actually_used`, not
`items × languages_supported`.

#### D5. Customer-uniform availability with per-business eager + manual overrides
**Problem.** Customer experience must not depend on which outlet they
scanned. If a customer picks Tamil, they should always get Tamil —
across every outlet on the platform. A naive "per-business enabled
languages" model breaks this: same customer at two outlets of the same
chain sees a Tamil menu at one and English at the other. Looks like a
bug from the seat.

But there is real platform-side cost to caring about: eager translation
of every menu item × every supported language × every business is
wasteful when most outlets serve a small number of dominant local
languages. And quality varies — a Telugu outlet owner can vouch for
Telugu translations, a Punjabi one usually cannot.

**Model.**
- **Supported languages are global**, owned by the platform. The
  `paynpik_languages` table stays the source of truth for "languages
  the platform offers." A customer-facing menu is *always* reachable
  in every supported language at *every* outlet — the platform makes
  that promise.
- **Per-business `primaryLanguage`** governs the *default rendering*
  when the customer hasn't expressed a preference (i.e. no `lang`
  query, no useful `Accept-Language`). A Tamil Nadu chain defaults to
  Tamil; a Karnataka chain defaults to Kannada. Better UX than
  always-English.
- **Per-business `eagerLanguages`** (optional) is a cost-control knob:
  these languages are pre-translated when a menu is saved so the first
  reader pays zero provider latency. Everything else falls to D4's
  lazy path. Typical setting: business's primary language + English +
  any core regional secondary (e.g. Tamil + Hindi + English for a TN
  chain serving north-Indian tourists).
- **Per-entity manual overrides** stay as today (`source = 'manual'`
  in `paynpik_translations`, or the JSON column variant after D3).
  Outlet admins fix translations they have authority on; backfill
  honours the manual flag and never clobbers them.
- **No "language disabled for this outlet" path.** Every supported
  language reaches the customer regardless of where they're sitting.

**Fix.**
- Add `primaryLanguage VARCHAR(8)` and `eagerLanguages JSON`
  (string-array) columns on `paynpik_businesses`.
- Backfill `upsertAll` (now queued via D2) writes only the source row
  + the business's `eagerLanguages` synchronously. Other languages
  enqueue a lazy job that's deduped and only runs when first
  requested.
- Customer language resolution order:
  `?lang= → Accept-Language (region-stripped) → JWT
  preferredLanguage → business.primaryLanguage → 'en'`.
- The previously-proposed `paynpik_business_languages` table is **not
  needed**. The two business-level columns above are sufficient and
  preserve customer-uniform behaviour.

**Tradeoff explicit.** Provider cost scales with
`Σ (items × eagerLanguages_per_business)` + `actual lazy reads × items`,
not the (cheaper but customer-hostile) `Σ (items × enabled_per_business)`
the earlier draft implied. Worth it — customer consistency is a
platform-level promise that shouldn't be negotiated per outlet.

#### D6. Right-to-left (Urdu) prerequisite work
**Problem.** Urdu is on the roadmap → first RTL script. Customer PWA
and admin SPA likely use hardcoded directional Tailwind classes
(`ml-*`, `pl-*`, `text-left`) which won't flip with `dir="rtl"`.

**Fix.**
- Audit both SPAs: `grep -rE "\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|border-l|border-r)" apps/*/src` — every hit is a candidate.
- Migrate to logical-direction utilities (`ms-*`, `me-*`, `ps-*`,
  `pe-*`, `start-*`, `end-*`).
- Lazy-load Nastaliq Urdu font (~400 KB) only when the user picks
  Urdu.
- Wrap fixed-direction fragments (`<bdi>{{orderNumber}}</bdi>`) so
  Unicode Bidi doesn't misorder them inside Urdu sentences.
- Decide numeral policy (Latin vs Eastern Arabic).
- Receipt printer: confirm Urdu (and complex Indic scripts) actually
  render — likely needs raster-image fallback path.

#### D7. Honour `source = 'manual'` on backfill
**Problem.** Manual translator edits could be clobbered by the next
automated backfill pass.

**Fix.** Skip rows where `source = 'manual'` in
`TranslationBackfillService`.

#### D8. `repairStubTagged` does a full-table scan
**Problem.** `WHERE value LIKE '[%'` over every translation row.

**Fix.** Move to a scheduled background job; restrict by `source =
'stub'` plus a recency window.

---

### E. Network & transport

#### E1. Compression — already enabled ✅
`apps/api/src/main.ts:38` applies the `compression` middleware with
the `x-no-compression` opt-out. No action needed; flagged so the next
auditor doesn't redo it.

#### E2. No `helmet` middleware
**Problem.** Standard HTTP security headers absent
(`Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, basic CSP). Cheap mitigations for
common browser-side attacks.

**Fix.**
```ts
import helmet from 'helmet';
app.use(helmet({ contentSecurityPolicy: false })); // tune CSP per deployment
```

#### E3. No Redis adapter for Socket.IO
**Problem.** Single API instance only. Any horizontal scale (multiple
Node processes / containers behind a load balancer) breaks the realtime
gateway — `joinOutlet` joins a room on the receiving instance only;
events emitted from other instances won't reach the client.

**Fix.** Install `@socket.io/redis-adapter` and wire it in
`orders.gateway.ts` using the same Redis pool that Bull uses.

#### E4. No sticky session strategy for Socket.IO long-poll fallback
**Problem.** When the WebSocket upgrade fails (corporate proxy, captive
portal), Socket.IO falls back to HTTP long-polling. Without sticky
sessions, those polls hit different API instances and the connection
hand-shake breaks.

**Fix.** Enable session affinity on the LB (cookie-based or IP-hash),
or set `transports: ['websocket']` if long-poll fallback is
unacceptable.

#### E5. No HTTP/2 termination at the reverse proxy (deployment-time)
**Problem.** The customer PWA pulls ~30 small assets. Without HTTP/2,
serial head-of-line blocking.

**Action.** Verify Nginx / Caddy in front terminates HTTP/2 (or H/3).
Deployment concern, not code.

#### E6. Outbox replay rate
**Problem.** The customer PWA outbox replays queued writes on
reconnect (`apps/customer/src/utils/outbox.ts`). No rate-limit on the
client; on a thundering-herd reconnect (e.g. cell tower returns after
an outage) a single client could fire dozens of writes in a tight loop.

**Fix.** Sequential replay (not Promise.all). Exponential backoff on
non-2xx. Configurable per-second cap.

#### E7. WebSocket auth on connect
**Problem.** Verify `joinOutlet` / `joinKitchen` actually validate
the JWT and that the connecting user is scoped to that outlet — if
not, any authenticated user can subscribe to any outlet's order
stream.

**Fix.** Read the token from `handshake.auth.token` in
`OrdersGateway.handleConnection`, verify, attach scope, reject join
attempts that violate scope.

#### E8. Response streaming for very large reads
**Problem.** Big report exports / GST reports build the full array in
memory before serialising.

**Fix.** For large exports, stream as NDJSON or CSV. NestJS supports
`StreamableFile`. Saves API heap and TTFB.

---

### F. Data integrity & correctness

#### F1. Razorpay payment reconciliation gap
**Status.** Open. Already captured in
`docs/hardening-backlog.md` §1; restated here because it affects every
order's terminal state under network failure.

**Fix.** Webhook as source of truth; 5-minute poll for `PENDING`
payments; dedupe by `razorpayPaymentId`. Signature verification helper
exists (`razorpay.service.ts:149`).

#### F2. Idempotency replay window
**Problem.** `paynpik_idempotency_keys` rows are written but it's
unclear if they're TTL'd or pruned. If not, a 24-hour-old replayed
write returns a cached 200 with no validation that the request body
still matches.

**Fix.** Audit `IdempotencyInterceptor` for TTL behaviour. Default to
24 h with periodic prune. Hash and compare request body against the
stored hash — reject replays where body has changed (the current code
409s on route mismatch; same idea for body).

#### F3. Order status state machine
**Problem.** Worth verifying whether transitions enforce a state
machine or whether any status → any status is allowed. A bug that flips
a `SERVED` order back to `CREATED` would be silently destructive.

**Fix.** Centralise allowed transitions; reject illegal ones in
`updateStatus` with 409.

#### F4. Inventory concurrent decrement
**Problem.** Items with `hasLimitedStock=true` are decremented when an
order is placed. If two customers tap "add to cart" at the same
moment on the last unit, both can succeed unless the decrement is
atomic.

**Fix.** Use a conditional UPDATE
(`SET availableQuantity = availableQuantity - ? WHERE id=? AND
availableQuantity >= ?`) and check affected-rows; or wrap in a
SERIALIZABLE transaction with retry.

#### F5. Multi-tenant scope leakage
**Problem.** `scopeFor(user)` exists but is applied per-controller.
There's no `AsyncLocalStorage` / Prisma middleware enforcing the scope
globally. A controller that forgets to filter by `outletId` returns
cross-tenant data silently.

**Fix.**
- Short-term: add a service-layer audit (codeowner reviews on
  controllers).
- Medium-term: a Prisma middleware that injects
  `where: { businessId: <from JWT> }` on tenant-scoped models when
  the request context has scope set. Trades some flexibility for
  defence-in-depth.

#### F6. Order snapshot integrity
**Problem.** `outletSnapshot` JSON on orders captures outlet config
at order time. If the snapshot writer ever misses a field, reprints of
old orders silently render with current values, not the historical
ones.

**Fix.** Versioned snapshot schema (`snapshotVersion`); reject reads
where the schema is unknown rather than mixing old and new fields.

#### F7. Bundle (combo) child-order consistency
**Problem.** Bundle parents and bundle children rely on `bundleId` /
`bundleParent` linking inside `paynpik_order_items`. If a child is
cancelled but the parent isn't, the receipt collapse logic surfaces a
phantom combo.

**Fix.** Cancel-cascade rule: cancelling the parent cancels all
children; cancelling all children prompts a parent decision.

#### F8. Dual-write windows during the JSON i18n migration (D3)
**Problem.** During cutover, both the old `paynpik_translations` table
and the new JSON columns are written. Risk of divergence if one write
fails.

**Fix.** Transactional dual-write; weekly reconciliation job;
post-cutover one-pass verifier comparing both stores before dropping
the old table.

---

### G. Security

#### G1. `APP_ENCRYPTION_KEY` dev fallback warning logs in dev
**Problem.** Boot log warns "APP_ENCRYPTION_KEY not set — using a
dev-only fallback key." The warning is by-design. The concern is making
sure prod boot **fails loudly** when the env var is missing, not
falling back silently.

**Fix.** Hard-fail on boot in `production` NODE_ENV when the var is
absent.

#### G2. No `helmet` (security headers)
See E2 above — security implication doubles. Listed in both sections
because the fix is the same.

#### G3. IDOR risk on `GET /orders/:id`
**Problem.** `orders.controller.ts:109` accepts the order id and
forwards to `findOne(id, lang)` with no caller-scope check. Comment
acknowledges: "Required so guest customers can track their own
orders after placing." UUIDs make guessing hard, but:
- The full payload includes customer phone, address, totals, item
  history, dispute history, payments.
- Order ids leak via WhatsApp links, screenshots, customer device
  history.

**Fix.**
- Anonymous track-order: limit to a slim status-only response
  (`/orders/:id/status` — see C3).
- Authenticated callers (staff): enforce that the order's `outletId`
  matches the caller's scope.
- Customer callers (post-OTP): enforce that the order's `customerId`
  matches the JWT subject.
- Anonymous order tracking should use a short-lived signed token, not
  the raw order id, so it can't be replayed weeks later.

#### G4. No account lockout / failed-login counter
**Problem.** Phone-based staff login is protected only by the global
100/min Throttler — no per-account counter, no temporary lockout, no
exponential backoff. Allows credential stuffing against known phones.

**Fix.**
- Track `failedLoginAttempts + lockoutUntil` on the User model.
- After N (5) failures, lock for 15 min; expose a per-phone unlock
  request flow.

#### G5. Throttler is global, not per-endpoint
**Problem.** `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` —
one bucket across all routes. The hot menu read consumes the same
quota as a login attempt. A noisy customer in a flaky-network area can
unintentionally lock out other operations.

**Fix.** Per-route throttler configs:
- Auth routes: 5 attempts / minute per IP+phone.
- Mutation routes: 30 / minute per user.
- Read-only routes: 200 / minute per user.
- Public reads (menu): 60 / minute per IP, generous burst.

#### G6. OTP brute force on customer login
**Problem.** During the testing phase the OTP is hardcoded
(`TEST_CUSTOMER_OTP = 123789`). In production, the OTP is 6 digits =
1 in 1M. With no rate limit per phone, an attacker can attempt the
million.

**Fix.** Per-phone counter on `verifyOtp`: lock after 5 wrong attempts
for 30 min. OTP TTL ≤ 5 min.

#### G7. CORS scope
**Problem.** Allow-listed to `FRONTEND_URL + CUSTOMER_URL`. Verify
that these env vars are set narrowly in production (not `*`) and that
preflight requests don't leak through with credentials.

**Action.** Document the production CORS env-var values; CI check that
they're not `*`.

#### G8. JWT session bloat
**Problem.** Sessions stored in `paynpik_sessions` per login. Are they
revoked on logout? Pruned on expiry? An unbounded session table is a
performance and forensic hazard.

**Fix.** Periodic prune of expired sessions; explicit revocation on
password change / role change.

#### G9. WebSocket connection authentication
See E7 above — security implication doubles. Listed in both sections
because the fix is the same.

#### G10. Audit of raw SQL paths
**Action.** Grep for `prisma.$queryRaw` / `$executeRaw` and confirm
every interpolation is via `Prisma.sql` template tags, never string
concatenation. Quick scan for new code over time.

#### G11. File upload validation
**Problem.** Item images, business logos accept URLs (item images
endpoint stores `url: string`). Verify there's no path where the API
fetches/proxies the URL server-side — that would open SSRF. If
uploads are direct-to-S3, verify mime-type + size limits at the
presign step.

#### G12. PII in logs
**Action.** Audit `console.log` and Winston logs for phone numbers,
emails, payment ids. Hash or redact in production.

---

### H. Operational / observability

#### H1. No request tracing
**Problem.** When the customer PWA reports "menu won't load", there's
no correlation id linking the client report to the server log line.

**Fix.** Generate / accept `X-Request-Id` per request; thread through
logs; surface in error responses so customer support can quote it.

#### H2. No slow-query alerting
**Problem.** Slow log is written but nobody watches it. The popularity
GROUP BY hitting 1,000 ms p99 in the stress test would have been
invisible in production until customers complained.

**Fix.** Ship MySQL slow log to whatever observability stack is in
play (Cloudwatch, Datadog, ELK); alert on p95 > 500 ms.

#### H3. No DB connection pool gauge
**Problem.** Prisma pool exhaustion silently waits, then times out;
manifests as user-facing 500s with no breadcrumb.

**Fix.** Expose pool metrics (busy / idle / waiting) via a Prom
endpoint; alert on `waiting > 0` for sustained periods.

#### H4. No Redis health visibility
**Problem.** The menu cache silently falls through to DB if Redis is
down (good failure mode); but there's no monitoring that says "you
have been serving uncached menus for 20 minutes."

**Fix.** Health check on `RedisService`; alert on connection loss.

#### H5. No structured DB index usage report
**Action.** Cron a weekly job that dumps
`performance_schema.table_io_waits_summary_by_index_usage` filtered to
`*NO INDEX*` reads; review for new full-scan paths added by recent
code changes.

---

## Phased implementation plan

Each phase is sized so it can be shipped end-to-end and measured against
the same stress-test harness used for the baseline. Phases are
intentionally ordered so earlier-phase changes amplify later ones
(indexes before payload trimming before caching before architecture
shifts).

### Phase 0 — Quick wins (no schema or contract change)

Time estimate: 1–2 days. Risk: very low.

1. Strip locale region in `preferredLanguageFromRequest`
   (`apps/api/src/common/language/preferred-language.ts`) —
   `lang.split('-')[0]`. (D1)
2. Add `helmet` middleware in `apps/api/src/main.ts`. (E2 / G2)
3. Hard-fail in production when `APP_ENCRYPTION_KEY` is unset. (G1)
4. Per-route throttler configuration. (G5)
5. Skip rows where `source='manual'` in
   `TranslationBackfillService`. (D7)
6. Audit and remove the unbounded `findMany` at
   `translation-backfill.service.ts:124` — convert to cursor batches.
   (A8)
7. Push `getLowStockAlerts` filter to the DB. (A7)

**Verification.** Re-run the stress-test harness from this session.
Confirm no regressions; minor latency improvements on i18n paths.

---

### Phase 1 — Index + cache foundation

Time estimate: 3–5 days. Risk: low (additive only).

1. Apply the four composite indexes (A1, A2):
   ```sql
   CREATE INDEX idx_orders_outlet_created ON paynpik_orders (outletId, createdAt);
   CREATE INDEX idx_orders_outlet_status_created ON paynpik_orders (outletId, status, createdAt);
   CREATE INDEX idx_orders_status ON paynpik_orders (status);
   CREATE INDEX idx_orderitems_order_status_item ON paynpik_order_items (orderId, status, itemId);
   CREATE INDEX idx_orderitems_status ON paynpik_order_items (status);
   ```
2. Cache the popularity top-5 list and review aggregates in Redis
   under the existing outlet menu-version counter. (A3, A4, B1)
3. Set Prisma `connection_limit` on production
   `DATABASE_URL`. (A9)
4. Add `ETag` + `Cache-Control` headers on `/menu` reads. (B3)

**Verification.**
- Re-run stress test: target `/menu` ≥ 500 req/s @ c=20 (current 22),
  `/orders` ≥ 250 req/s @ c=20 (current 29).
- `EXPLAIN` confirms the orders list no longer reports `Using filesort`
  for the outlet+createdAt sort.
- Slow log shows the popularity GROUP BY disappearing from the top-5.

---

### Phase 2 — API shape refactor (slim list + detail split)

Time estimate: 1.5–2 weeks. Risk: medium (touches multiple consumers).

1. Slim `orders.findOne` core + sub-resource endpoints (C1).
2. Slim `orders.findAll` / `findAllScoped` (C2).
3. Dedicated `/orders/:id/status` for poll loops (C3).
4. Paginate `customers.listOrders` (C4).
5. Move `customers.insights` to a separate endpoint, cache 5 min (C5).
6. Slim `disputes.findByOutlet`, `cluster-orders` list shape
   (C6, C11).
7. Split outlet config vs layout (C7).
8. Slim `service-stations` operational feed; structural data on its
   own cacheable endpoint (C9).
9. Authoritative responsibility list embedded in JWT;
   responsibility loading dropped from JWT verify (C10, A5).
10. Audit and constrain `findMany` calls on items / variants flagged in
    A6.

**Verification.**
- `/orders/:id` payload ≤ 5 KB for typical orders (currently 20–50 KB
  with the full graph).
- `/orders?…` list payload ≤ 50 KB for 50 rows (currently 1 MB).
- `paynpik_responsibilities` *NO INDEX* read count drops to ~0 in a
  steady state stress test.

---

### Phase 3 — i18n denormalisation + lazy fill

Time estimate: 2–3 weeks. Risk: medium-high (data migration + dual
writes).

1. Add `primaryLanguage` + `eagerLanguages` columns on
   `paynpik_businesses` (D5).
2. Add `name_i18n` + `description_i18n` JSON columns on each
   translatable entity (D3).
3. One-shot migration: collapse existing `paynpik_translations` rows
   into the new JSON columns.
4. Dual-write window: `upsertAll` writes both old table and new
   columns (D2 also lifts to Bull queue here).
5. Read path: switch `hydrateMenu` → `pickI18n(row, field, lang)`
   helper; drop `${lang}` from the menu cache key.
6. Lazy-fill on first request: enqueue Bull job for missing language
   cells (D4).
7. Cutover: stop writing the old `paynpik_translations` table.
8. Drop the old table (or keep read-only for audit).

**Verification.**
- Redis memory for menu trees drops by N (number of supported
  languages).
- Menu cold-cache rebuild fires 0 translation queries.
- Provider call volume scales with actual reader distribution, not
  with `items × languages_enabled`.

---

### Phase 4 — Reports + service-desk + realtime scale

Time estimate: 2–3 weeks. Risk: medium.

1. `paynpik_outlet_daily_metrics` materialised table + write-side hook
   on order status transition (C8).
2. Reports rewrite to roll up daily buckets + 60 s payload cache.
3. Socket.IO Redis adapter wired in via the existing Redis pool
   (E3).
4. Socket.IO connection auth + scope enforcement (E7 / G9).
5. Service-desk feed: Socket.IO deltas primary, REST refresh as
   reconciliation only (C9 continued).
6. Order status polling → Socket.IO `joinOrder` channel (C3
   continued).
7. Customer PWA outbox: sequential replay + backoff (E6).

**Verification.**
- Dashboard reads <100 ms across week-long ranges.
- Service-desk REST poll rate drops by ≥ 5×.
- Two API instances pass realtime smoke test (subscribe to instance A,
  emit on instance B).

---

### Phase 5 — Data integrity + security hardening

Time estimate: 1.5–2 weeks. Risk: medium (tightening invariants).

1. Razorpay reconciliation job (F1 — already in hardening backlog).
2. Idempotency TTL + body-hash check (F2).
3. Order status state-machine enforcement (F3).
4. Atomic inventory decrement (F4).
5. Tenant-scoping Prisma middleware (F5).
6. Versioned order snapshots (F6).
7. Bundle cancel-cascade rule (F7).
8. IDOR fix on `/orders/:id` (G3) — anonymous status-only signed
   token; staff scope enforcement.
9. Account lockout on failed logins (G4).
10. OTP brute-force throttle per phone (G6).
11. Session pruning + revocation on credential change (G8).
12. CI check on CORS env vars (G7).
13. PII redaction sweep on logs (G12).
14. Raw SQL audit (G10).
15. Upload SSRF / mime check audit (G11).

**Verification.**
- Tabletop a credential-stuffing scenario; lockout fires.
- Tabletop an IDOR scenario; cross-tenant read fails.
- Post-deploy security review checklist signed.

---

### Phase 6 — RTL + Urdu enablement (parallel-track with Phase 3+)

Time estimate: 2–3 weeks, parallelisable with Phase 3+. Risk: medium
(touches every screen).

1. Audit + migrate directional Tailwind classes to logical utilities
   (D6).
2. Add `dir="rtl"` toggle keyed off the active language.
3. Lazy-load Nastaliq Urdu font; verify other Indic font lazy-loads
   already present.
4. Bidi audit: wrap fixed-direction fragments in `<bdi>`.
5. Numeral policy decision + implementation.
6. Receipt printer Urdu path (likely raster-image fallback).
7. WhatsApp template submission for Urdu locale variants.
8. QA pass on every customer-facing screen in Urdu with mocked
   translations.

---

### Phase 7 — Observability + scale-out prep

Time estimate: 1–2 weeks. Risk: low.

1. `X-Request-Id` correlation across logs (H1).
2. Slow-query alerting (H2).
3. DB pool / Redis health metrics + alerts (H3, H4).
4. Weekly cron dumping `*NO INDEX*` reads (H5).
5. Document production CORS, throttler, encryption, connection-pool
   values in `docs/deployment-runtime-config.md`.
6. Sticky-session config for Socket.IO long-poll fallback (E4).
7. NDJSON / streamable file path for large report exports (E8).

---

## Cross-cutting verification approach

Every phase reuses the local stress-test harness from this session.
Reproducer:

```bash
# 1. Stack
docker compose up -d mysql redis elasticsearch
npm run dev

# 2. Synthetic data (only the first time)
# See the /tmp/inflate.sql block in this session — inflates to
# 405 items, 100 customers, 5000 orders, ~87000 order_items.

# 3. Auth
JWT=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210","password":"Owner@123"}' \
  | jq -r .accessToken)

# 4. Baseline + post-change runs
docker exec paynpik_mysql mysql -uroot -ppaynpik_root -e "
  TRUNCATE TABLE performance_schema.events_statements_summary_by_digest;
  TRUNCATE TABLE performance_schema.table_io_waits_summary_by_index_usage;
  TRUNCATE TABLE mysql.slow_log;"
npx autocannon -c 20 -d 20 \
  "http://localhost:3001/api/v1/outlets/demo-outlet/menu"
npx autocannon -c 20 -d 15 -H "Authorization: Bearer $JWT" \
  "http://localhost:3001/api/v1/orders?outletId=demo-outlet&limit=50"

# 5. Mine the slow log + index-usage table after each run.
```

Track three metrics per change:
- p99 latency on `/menu` and `/orders`.
- `Innodb_rows_read` per HTTP request.
- Top 5 entries in `events_statements_summary_by_digest` by total time.

Regressions block the next phase.

---

## Open questions for the team

1. Anonymous order tracking expected lifetime — does the URL
   `/track/:orderId` need to work weeks later, or only until handover?
   Drives the signed-token TTL in G3.
2. Reports dashboard freshness tolerance — is 60 s lag acceptable, or
   do staff expect live counters? Drives caching in C8.
3. Business primary + eager-language defaults — who picks them at
   business onboarding (platform admin pre-fills by region, or
   business owner self-service), and what's the platform default for
   businesses that don't set them? Drives the admin UI in D5.
   Customer access to *every* supported language is the
   non-negotiable; the question is only about the eager-translation
   cost knob.
4. Receipt printer model(s) in deployment — confirms whether the
   raster-image Urdu fallback (D6) is a one-printer fix or fleet-wide.
5. Tolerance for an outage on the translation provider chain — is it
   acceptable for new menu items to ship English-only for an hour
   until backfill catches up? Drives the queue retry policy in D2.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-06-22 | Claude Code (stress-test session) | Initial capture. |
| 2026-06-22 | Claude Code | D5 reworked — customer-uniform language availability with per-business primary + eager-translation knob; dropped the per-business "enabled languages" gating that would have made the customer experience outlet-dependent. |
