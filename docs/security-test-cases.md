# PayNPik / VEZEOR — Security Test Plan

Concrete security test cases mapped to **OWASP Top 10 (2021)** and the
**OWASP Application Security Verification Standard (ASVS) v4.0**, tied
to actual endpoints and features of this stack:

- `apps/api` — NestJS 10, Prisma → MySQL 8, JWT auth, Bull/Redis,
  Razorpay, Socket.IO
- `apps/web` — admin SPA at `https://admin.vezeor.cloud`
- `apps/customer` — customer PWA at `https://order.vezeor.cloud`
- `mobile/android` — Capacitor WebView wrapper of the customer PWA

Tests are written so a QA engineer can run them with `curl`, a browser,
or `adb`. Each test has explicit pass/fail criteria. Severities reflect
real impact for a multi-tenant restaurant SaaS.

| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical — must pass before any deploy |
| 🟠 | High — must pass before public launch |
| 🟡 | Medium — should pass within a sprint of GA |
| 🟢 | Low — track but ship without |

Test environment baseline:

- Production API: `https://api.vezeor.cloud/api/v1`
- Staging-isolated database (never run mutating tests against prod
  with real customer data — spin up the scratch MySQL container from
  `docs/dokploy-deployment.md`)
- Seeded accounts:
  - Platform Admin: `9000000000 / Admin@123` (rotate before runs)
  - Business Owner: `9876543210 / Owner@123`
  - Outlet Admin:   `9999000000 / Outlet@123`
  - Kitchen Chef:   `9111000001 / Chef@123`
  - Cashier:        `9111000002 / Cash@123`

---

## A01: Broken Access Control

Cross-tenant + vertical-privilege issues are the highest-impact bug
class in this codebase because the API is multi-tenant (platform →
business → outlet hierarchy via `scopeFor(user)`).

### A01-T01 🔴 Vertical privilege — chef cannot read platform reports

**Why**: a regression of this exact bug shipped to staging once
(commit `8926bc72`'s sibling). `chef` has no `VIEW_PLATFORM_REPORTS`
responsibility but a missing guard let it through.

**Steps**:
```bash
CHEF=$(curl -s -X POST https://api.vezeor.cloud/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9111000001","password":"<rotated-pw>"}' \
  | jq -r .data.accessToken)

curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $CHEF" \
  https://api.vezeor.cloud/api/v1/reports/platform-summary
```

**Pass**: `403`. **Fail**: `200` (regression of the prior bug).

### A01-T02 🔴 Horizontal access — outlet admin of business A cannot read business B

**Steps**: log in as the Outlet Admin of `demo-outlet` (business A).
Attempt to read another business's data:
```bash
OUTLET=$(... login as 9999000000 ...)
# Try to enumerate other businesses
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $OUTLET" \
  https://api.vezeor.cloud/api/v1/businesses/some-other-business-id
```

**Pass**: `403` or `404` (404 is acceptable — same response shape
prevents enumeration). **Fail**: returns business B's data.

### A01-T03 🔴 IDOR — order detail cross-account

A customer who places order X cannot view order Y belonging to another
customer.

**Steps**:
```bash
# Customer A logs in
A=$(... login as customer A ...)
# Get customer A's most recent order id
ORDA=$(curl -s -H "Authorization: Bearer $A" \
  https://api.vezeor.cloud/api/v1/users/orders/history | jq -r '.data.orders[0].id')
# Switch to customer B
B=$(... login as customer B ...)
# Attempt to read A's order as B
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $B" \
  "https://api.vezeor.cloud/api/v1/orders/$ORDA"
```

**Pass**: `403` or `404`.

### A01-T04 🟠 Cluster cross-tenant — outlet in cluster A can't see cluster B's orders

**Steps**: as a member-outlet user of cluster A, attempt to call
`GET /cluster-orders/<id>` where the id belongs to cluster B.

**Pass**: `403` or `404`.

### A01-T05 🟠 Token reuse after logout

```bash
T=$(... login ...)
curl -X POST -H "Authorization: Bearer $T" https://api.vezeor.cloud/api/v1/auth/logout
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $T" https://api.vezeor.cloud/api/v1/auth/me
```

**Pass**: `401`. **Note**: if logout only removes the token client-side
(not server-side via session table), this fails by design — track as
intentional vs gap.

### A01-T06 🟠 Stale role removal

Admin downgrades a user's role; the previously-issued JWT must stop
working for the removed responsibilities at most by token-expiry,
ideally immediately.

**Steps**: log in as user X with role R. Have an admin remove R from X.
Retry an action that requires R.

**Pass**: `403` within ≤ `JWT_EXPIRES_IN` (currently 7d). **Document
gap**: currently the JWT carries the role at mint time; remove-role
requires the user to log in again for the change to take effect.

### A01-T07 🟠 IDOR — payment confirm with someone else's orderId

```bash
# As staff at outlet A, attempt to confirm a payment on order belonging
# to outlet B
curl -X POST -H "Authorization: Bearer $STAFF_A" -H 'Content-Type: application/json' \
  -d '{"gatewayRef":"FAKE123"}' \
  "https://api.vezeor.cloud/api/v1/payments/$ORDER_FROM_OUTLET_B/confirm"
```

**Pass**: `403`.

### A01-T08 🟡 Forced browsing — admin SPA routes via direct URL while signed in as customer

In the customer PWA on `order.vezeor.cloud`, type `/admin` style routes
directly. The admin SPA is a separate origin (`admin.vezeor.cloud`) so
this is mostly about confirming there's no leakage. Confirm CORS denies
any direct calls from the customer origin to admin-only endpoints.

```bash
curl -sI -X OPTIONS https://api.vezeor.cloud/api/v1/leads \
  -H "Origin: https://order.vezeor.cloud" \
  -H "Access-Control-Request-Method: GET"
```

**Pass**: no `Access-Control-Allow-Origin` for the customer origin on
admin-only endpoints — or the response has one but the actual GET
returns `403` because the customer's JWT lacks responsibilities.

### A01-T09 🟡 Public endpoint enumeration

Verify that endpoints with `@Public()` decorator only expose public
information (no PII, no internal IDs that could be enumerated).

Endpoints to audit:
- `GET /clusters/public`
- `GET /outlets/public-list`
- `GET /customer/outlets/by-code/:code`
- `POST /auth/customer/request-otp`

**Pass**: response excludes phone numbers, emails, internal user ids,
business owner contact info.

---

## A02: Cryptographic Failures

### A02-T01 🔴 TLS only — HTTPS enforced

```bash
curl -I http://api.vezeor.cloud/api/v1/health  # plain HTTP
```

**Pass**: `301` to https OR connection refused. **Fail**: `200`.

Repeat for `order.vezeor.cloud` and `admin.vezeor.cloud`.

### A02-T02 🔴 JWT secret strength

```bash
ssh root@<vps-ip>
docker exec $(docker ps --filter "name=paynpikapi" -q | head -1) \
  printenv JWT_SECRET | wc -c
```

**Pass**: ≥ 32 chars and **not** the literal `<generate a long random
string>` placeholder. **Fail**: anything shorter or the placeholder.

### A02-T03 🔴 Password storage — bcrypt with appropriate cost

Inspect a freshly-created user row:
```sql
SELECT phone, LEFT(passwordHash, 30) FROM paynpik_users WHERE phone='9999000000';
```

**Pass**: hash starts with `$2b$12$` or higher cost factor (seed uses 12,
configurable). **Fail**: plain text, MD5, SHA-1, bcrypt cost < 10.

### A02-T04 🟠 No secrets in client bundles

```bash
# Pull the deployed admin bundle and scan for accidental secrets
curl -s https://admin.vezeor.cloud/ | grep -oE '/assets/index-[^"]+\.js' | head -1 \
  | xargs -I {} curl -s "https://admin.vezeor.cloud{}" \
  | grep -iE "(jwt_secret|razorpay_key_secret|mysql:.*:.*@|api[_-]?key.*=)"
```

**Pass**: no matches. **Fail**: any matched secret-like string.

### A02-T05 🟠 Razorpay webhook signature verification

Confirm `POST /payments/webhooks/razorpay` rejects requests without a
valid `X-Razorpay-Signature`:
```bash
curl -i -X POST -H 'Content-Type: application/json' \
  -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_FAKE"}}}}' \
  https://api.vezeor.cloud/api/v1/payments/webhooks/razorpay
```

**Pass**: `401 Invalid webhook signature`. **Fail**: `200` or
processing of the fake payload.

### A02-T06 🟠 Sensitive fields excluded from API responses

`GET /users/me` and `GET /users/:id` must never return `passwordHash`,
`refreshTokens`, or `apiKey` fields.

```bash
T=$(... login ...)
curl -s -H "Authorization: Bearer $T" https://api.vezeor.cloud/api/v1/users/me \
  | jq 'keys' | grep -iE "(password|secret|hash|refresh|apikey)"
```

**Pass**: no match.

### A02-T07 🟡 Cookies — secure + httpOnly + sameSite

If any cookies are issued (none currently — auth is bearer-token), they
must carry `Secure; HttpOnly; SameSite=Strict`. Re-check after any
session-cookie work.

---

## A03: Injection

### A03-T01 🔴 SQL injection via Prisma (sanity)

Prisma uses parameterised queries so this is mostly proving the
discipline holds. Try a classic payload on a search endpoint:
```bash
curl -s -H "Authorization: Bearer $T" \
  "https://api.vezeor.cloud/api/v1/leads?status='%20OR%201=1--&take=10"
```

**Pass**: `200` with empty list or `400 validation error` (the status
must equal an enum value). **Fail**: returns all rows.

### A03-T02 🔴 NoSQL-style injection on Idempotency-Key

```bash
curl -X POST -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: {"$ne": null}' \
  -d '{"items":[{"itemId":"x","quantity":1}]}' \
  https://api.vezeor.cloud/api/v1/outlets/demo-outlet/orders
```

**Pass**: server treats the header as an opaque string (no key
evaluation as a query operator). **Fail**: any indication the JSON was
interpreted.

### A03-T03 🔴 Stored XSS — menu item name reflected in customer PWA

In admin SPA, create a menu item with name:
```
<img src=x onerror="alert(document.cookie)">
```

Open the item in the customer PWA. **Pass**: alert does NOT fire — the
PWA renders the text as raw text. **Fail**: alert fires.

Test variants in: item description, outlet name, business name, review
reply text, dispute description, customer name, address.

### A03-T04 🟠 Reflected XSS in query params

```
https://admin.vezeor.cloud/orders?search=%3Csvg%2Fonload%3Dalert(1)%3E
```

**Pass**: rendered as literal text.

### A03-T05 🟠 Open redirect via auth-redirect

The scan resolver stashes a `from` URL in `localStorage` and `AuthPage`
navigates to it after login. Try a malicious `from`:
```
https://order.vezeor.cloud/auth?from=https://evil.example.com/phish
```

**Pass**: AuthPage rejects absolute URLs or external origins;
navigation stays inside `order.vezeor.cloud`. **Fail**: redirects to
external origin after login.

### A03-T06 🟠 Header injection in Idempotency-Key

```bash
curl -X POST ... -H $'Idempotency-Key: foo\r\nX-Inject: bar' ...
```

**Pass**: request rejected (Node + Express drop control chars in
headers). **Fail**: API logs show `X-Inject` honoured.

### A03-T07 🟡 Command injection on file upload

Upload an image file whose name contains shell metacharacters
(`; rm -rf /`, `\`whoami\``, etc.) via the menu item image upload.

**Pass**: filename is sanitised before any filesystem or shell use.

### A03-T08 🟡 ReDoS in regex-based DTOs

Test long boundary inputs on phone/email/name fields:
```bash
PHONE=$(python3 -c "print('9' * 100000)")
curl -X POST -d "{\"phone\":\"$PHONE\",\"password\":\"x\"}" ...
```

**Pass**: 400 within < 1s. **Fail**: > 5s response (regex pathological
case).

---

## A04: Insecure Design

### A04-T01 🔴 Rate limiting on login

```bash
for i in $(seq 1 150); do
  curl -s -o /dev/null -w "%{http_code} " -X POST \
    -H 'Content-Type: application/json' \
    -d '{"phone":"9000000000","password":"wrong"}' \
    https://api.vezeor.cloud/api/v1/auth/login
done
```

**Pass**: response shifts to `429 Too Many Requests` after threshold
(`@nestjs/throttler` default 100/min). **Fail**: all 401s — no
throttling means brute-force friendly.

### A04-T02 🔴 OTP brute-force

Request an OTP for a phone. Attempt all 1,000,000 6-digit combinations
in parallel (or simulate with 1,000 attempts):
```bash
for i in $(seq 0 999); do
  OTP=$(printf "%06d" $i)
  curl -s -o /dev/null -w "%{http_code} " -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"phone\":\"9555000001\",\"otp\":\"$OTP\"}" \
    https://api.vezeor.cloud/api/v1/auth/customer/verify-otp
done
```

**Pass**: throttled after ~5 attempts (industry standard for OTP) OR
OTP is invalidated after N wrong tries.

### A04-T03 🔴 Idempotency-Key reuse on `POST /orders`

The interceptor must replay the cached response, not double-charge.

```bash
KEY=$(uuidgen)
RES1=$(curl -s -X POST -H "Authorization: Bearer $T" -H "Idempotency-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"...","quantity":1}]}' \
  https://api.vezeor.cloud/api/v1/outlets/demo-outlet/orders)
RES2=$(curl -s -X POST -H "Authorization: Bearer $T" -H "Idempotency-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"...","quantity":1}]}' \
  https://api.vezeor.cloud/api/v1/outlets/demo-outlet/orders)
echo "$RES1" | jq .data.id
echo "$RES2" | jq .data.id
```

**Pass**: same order id returned both times. **Fail**: two distinct
orders created → customer charged twice in a real Razorpay scenario.

### A04-T04 🔴 Idempotency-Key cross-scope reuse

The interceptor must `409` if the same key is reused on a *different*
route (which would otherwise replay the wrong cached body).

```bash
KEY=$(uuidgen)
curl -s -X POST -H "Authorization: Bearer $T" -H "Idempotency-Key: $KEY" \
  -d '{"items":[{"itemId":"x","quantity":1}]}' \
  https://api.vezeor.cloud/api/v1/outlets/demo-outlet/orders

curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer $T" \
  -H "Idempotency-Key: $KEY" \
  -d '{"orderId":"x","amount":100}' \
  https://api.vezeor.cloud/api/v1/payments/razorpay/order
```

**Pass**: second call returns `409 Conflict`.

### A04-T05 🟠 Price tampering on order create

Submit an order whose `unitPrice` differs from the item's menu price:
```bash
curl -X POST ... -d '{"items":[{"itemId":"<real-id>","quantity":1,"unitPrice":1}]}' ...
```

**Pass**: server recomputes price from the DB and ignores client value.
**Fail**: `totalAmount` reflects `unitPrice=1` instead of the real
menu price.

### A04-T06 🟠 Coupon abuse — apply same coupon multiple times

Create a coupon limited to 1 use per customer. Attempt to apply twice:

**Pass**: second application returns `400 Coupon already used`.

### A04-T07 🟠 Reward point overdraft

Customer has 100 reward points. Submit an order with
`{"rewardPoints": 999999}`:

**Pass**: server caps to wallet balance or rejects with 400.

### A04-T08 🟠 Webhook replay protection

Capture a legit Razorpay webhook from prod logs (sanitised). Replay it
twice:

**Pass**: second call is idempotent — the payment isn't double-credited.

### A04-T09 🟡 Race condition on limited-stock item

100 concurrent orders for a stock-limited item with 5 units available.

**Pass**: exactly 5 succeed, 95 return
`Only X of "<item>" left in stock` or `out of stock`.

---

## A05: Security Misconfiguration

### A05-T01 🔴 Swagger UI disabled in production

```bash
curl -i https://api.vezeor.cloud/api/docs
curl -i https://api.vezeor.cloud/api/docs-json
```

**Pass**: both return `404`. **Fail**: either returns the full OpenAPI
spec / UI (recon goldmine).

### A05-T02 🔴 X-Powered-By header hidden

```bash
curl -sI https://api.vezeor.cloud/api/v1/health | grep -i x-powered-by
```

**Pass**: no match.

### A05-T03 🔴 CORS origin allowlist exact-match

```bash
# Untrusted origin
curl -sI -X OPTIONS https://api.vezeor.cloud/api/v1/health \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```

**Pass**: no header in response (or empty). **Fail**:
`access-control-allow-origin: https://evil.example` (origin reflection
bug).

Verify trusted origins return correctly:
```bash
curl -sI -X OPTIONS https://api.vezeor.cloud/api/v1/health \
  -H "Origin: https://admin.vezeor.cloud" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
# → Access-Control-Allow-Origin: https://admin.vezeor.cloud
```

### A05-T04 🔴 Database ports not externally reachable

From any laptop NOT on the VPS network:
```bash
nc -zv api.vezeor.cloud 3306   # MySQL
nc -zv api.vezeor.cloud 6379   # Redis
nc -zv api.vezeor.cloud 9200   # Elasticsearch (if used)
nc -zv api.vezeor.cloud 5432   # Postgres (legacy)
```

**Pass**: all four "Connection refused" or "timed out". **Fail**: any
"succeeded" — restrict via UFW.

### A05-T05 🔴 Error verbosity — production hides stack traces

Trigger a 500 (e.g., invalid input that crashes a service layer):
```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d 'malformed-json' \
  https://api.vezeor.cloud/api/v1/auth/login | jq .
```

**Pass**: response body contains a generic `{"success":false,
"statusCode":500,"message":"Internal server error"}` — no stack trace,
no file paths, no SQL fragments. **Fail**: any source path / line
number / DB error leak.

### A05-T06 🟠 Default credentials rotated

Confirm all seeded passwords (`Admin@123`, `Owner@123`, etc.) are
rotated before public launch. Easiest: try logging in with each:

```bash
for pw in 'Admin@123' 'Owner@123' 'Outlet@123' 'Chef@123' 'Cash@123' 'Store@123'; do
  RES=$(curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"phone\":\"9000000000\",\"password\":\"$pw\"}" \
    https://api.vezeor.cloud/api/v1/auth/login | jq -r .success)
  echo "$pw: $RES"
done
```

**Pass**: all `false`. **Fail**: any `true` means a default password is
still active on production.

### A05-T07 🟠 Security headers — HSTS, X-Frame-Options, etc.

```bash
curl -sI https://api.vezeor.cloud/api/v1/health | grep -iE \
  "(strict-transport-security|x-frame-options|x-content-type-options|content-security-policy|referrer-policy)"
```

**Pass** (recommended values):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

**Gap**: if missing, add helmet middleware.

### A05-T08 🟠 CSP on the SPAs

```bash
curl -sI https://admin.vezeor.cloud/ | grep -i content-security-policy
```

**Pass**: a CSP header is present, blocks inline scripts unless using a
nonce, restricts script-src + connect-src to known hosts.

### A05-T09 🟡 ENABLE_SWAGGER must not be set on prod

```bash
docker exec $(docker ps --filter "name=paynpikapi" -q | head -1) printenv | grep -i swagger
```

**Pass**: empty or `ENABLE_SWAGGER=false`.

### A05-T10 🟡 Customer SW must not be served from a non-`/` scope

Confirm `https://order.vezeor.cloud/sw.js` returns `Service-Worker-Allowed:`
header only for the root scope (no scope escalation).

---

## A06: Vulnerable and Outdated Components

### A06-T01 🔴 npm audit — no critical vulns

```bash
cd apps/api && npm audit --audit-level=critical
cd apps/customer && npm audit --audit-level=critical
cd apps/web && npm audit --audit-level=critical
```

**Pass**: `found 0 vulnerabilities`. **Fail**: any critical.

### A06-T02 🟠 npm audit — no high vulns in production deps

```bash
npm audit --audit-level=high --production
```

**Pass**: zero. Document any exception with a clear "won't fix" reason.

### A06-T03 🟠 Pinned base image versions

Dockerfiles must not use `:latest`:
```bash
grep -rE "FROM .+:latest" apps/api apps/web apps/customer mobile/
```

**Pass**: no match.

### A06-T04 🟡 Capacitor + Android SDK versions current

- Capacitor: at least the LTS major (`@capacitor/core` v6+)
- targetSdkVersion: latest stable (Android 14 / API 34+) — Play Store
  enforces minimum target.

### A06-T05 🟡 Dependency review on PR

If using GitHub: `github/dependency-review-action@v4` should block PRs
that add high-severity advisories.

---

## A07: Identification and Authentication Failures

### A07-T01 🔴 OTP single-use + expiry

Request OTP, use it once, attempt to reuse:
```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"phone":"9555000001","otp":"<used-otp>"}' \
  https://api.vezeor.cloud/api/v1/auth/customer/verify-otp
```

**Pass**: `401 Invalid OTP` (single-use enforcement).

Also verify expiry: wait `OTP_TTL` seconds past request time.

**Pass**: after expiry, even the correct OTP returns 401.

### A07-T02 🔴 Phone enumeration via OTP request

```bash
# Existing phone
curl -s -X POST -d '{"phone":"9000000000"}' \
  https://api.vezeor.cloud/api/v1/auth/customer/request-otp

# Non-existent phone
curl -s -X POST -d '{"phone":"9999999999"}' \
  https://api.vezeor.cloud/api/v1/auth/customer/request-otp
```

**Pass**: identical response shape, same status code, same body content
between existing vs non-existent phones. **Fail**: differentiating
response (allows attackers to enumerate registered users).

### A07-T03 🔴 Login error message — no user-enumeration leak

```bash
# Wrong password, real phone
curl -s -X POST -d '{"phone":"9000000000","password":"wrong"}' \
  https://api.vezeor.cloud/api/v1/auth/login
# Non-existent phone
curl -s -X POST -d '{"phone":"9999999999","password":"wrong"}' \
  https://api.vezeor.cloud/api/v1/auth/login
```

**Pass**: both responses are identical — e.g.,
`{"success":false,"statusCode":401,"message":"Invalid credentials"}`.

### A07-T04 🔴 JWT expiry enforced

```bash
# Manually craft an expired JWT (or capture one near expiry)
EXPIRED=$(node -e "console.log(require('jsonwebtoken').sign({sub:'cmptxch3g'},'$JWT_SECRET',{expiresIn:'-1h'}))")
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $EXPIRED" \
  https://api.vezeor.cloud/api/v1/auth/me
```

**Pass**: `401`. **Fail**: `200` (expiry not validated).

### A07-T05 🔴 JWT algorithm pinning — reject `none` and HS256→RS256 confusion

Craft a token with `{"alg":"none"}`:
```bash
NONE=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '=' | tr '/+' '_-').$(echo -n '{"sub":"cmptxch3g","exp":9999999999}' | base64 | tr -d '=' | tr '/+' '_-').
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $NONE" \
  https://api.vezeor.cloud/api/v1/auth/me
```

**Pass**: `401`. **Fail**: `200` (alg=none accepted = no auth).

### A07-T06 🟠 Password complexity on staff registration

Try setting passwords `123456`, `password`, `aaaaaa` for a staff user
via the user-management flow:

**Pass**: rejected with a clear policy error. **Fail**: accepted.

### A07-T07 🟠 Account lockout after N failed logins

After ~10 wrong attempts against a real account, attempt with the
correct password:

**Pass**: rejected for a cool-down window (or requires admin reset).
**Fail**: accepted immediately.

### A07-T08 🟠 Concurrent session limit / detection

Log in from device A, then from device B with the same account. Have
device A perform an action.

**Pass**: either A continues to work (multi-device allowed by design)
OR A is logged out (single-session policy). Whatever is chosen, it's
deterministic.

### A07-T09 🟡 Refresh token rotation

After using a refresh token to issue a new access token, the old
refresh token must no longer be valid.

### A07-T10 🟡 No password in URLs / logs

```bash
docker logs $(docker ps --filter "name=paynpikapi" -q) --tail 1000 | grep -iE "(password=|otp=|secret=)"
```

**Pass**: empty.

---

## A08: Software and Data Integrity Failures

### A08-T01 🔴 Razorpay webhook signature validation (deep)

In addition to A02-T05, verify the signature is HMAC-SHA256 with the
expected secret, **and** that timing-safe comparison is used (no early
return on first character mismatch).

Code path: `apps/api/src/modules/payments/razorpay.service.ts ::
verifyWebhookSignature`.

### A08-T02 🔴 Idempotency interceptor — body bound to key

Send the same Idempotency-Key with a different body:
```bash
KEY=$(uuidgen)
curl -X POST -H "Idempotency-Key: $KEY" -d '{"a":1}' .../orders
curl -X POST -H "Idempotency-Key: $KEY" -d '{"a":2}' .../orders
```

**Pass**: first response replayed (server ignores second body) OR `409`
(server detects the inconsistency).

### A08-T03 🟠 Software supply chain — package-lock integrity

Confirm `package-lock.json` files are tracked in git and that CI uses
`npm ci` (not `npm install`) to enforce the lockfile.

```bash
grep -rn "npm install" .github/workflows/
```

**Pass**: only `npm ci` in CI.

### A08-T04 🟠 Capacitor APK — release signing key not in repo

```bash
cd /Users/Naren/Documents/Prod/paynpik_v2
git ls-files | grep -iE "(\.keystore|\.jks|keystore.properties)"
```

**Pass**: empty.

### A08-T05 🟡 Build artifact integrity

Verify the GitHub Actions APK build produces deterministic output
(same SHA-256 for identical source) and that the signed APK's
fingerprint matches the one registered with Google.

---

## A09: Security Logging and Monitoring Failures

### A09-T01 🔴 Failed login attempts logged

Trigger 5 failed logins, then check the API logs.

**Pass**: each failure produces a log line with timestamp, phone (or
hashed phone), IP, user-agent. **Fail**: silent.

### A09-T02 🔴 Privilege changes audited

When a platform admin grants `PLATFORM_ADMIN` to a user, a row appears
in `paynpik_audit_logs` with the actor, target, and timestamp.

```sql
SELECT * FROM paynpik_audit_logs
  WHERE action LIKE '%role%' OR action LIKE '%permission%'
  ORDER BY createdAt DESC LIMIT 10;
```

**Pass**: rows exist and cover all sensitive ops.

### A09-T03 🟠 No sensitive data in logs

```bash
docker logs $(docker ps --filter "name=paynpikapi" -q) --since 24h \
  | grep -iE "(password|otp|jwt|razorpay_key_secret|credit.?card|cvv)"
```

**Pass**: no match.

### A09-T04 🟠 MySQL slow query log enabled

Long-running queries should surface in logs so a denial-of-service via
malicious filters can be detected.

### A09-T05 🟡 Backup verification — restore drill

Restore the most recent MySQL backup to a scratch container and verify
key tables (`paynpik_orders`, `paynpik_payments`, `paynpik_users`) are
intact and queryable.

---

## A10: Server-Side Request Forgery (SSRF)

### A10-T01 🔴 Image upload from URL — no internal access

If any endpoint accepts an image URL (e.g., profile pic, business
logo), try internal targets:
```bash
curl -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"imageUrl":"http://169.254.169.254/latest/meta-data/"}' \
  https://api.vezeor.cloud/api/v1/businesses/<id>/images
```

**Pass**: URL is rejected — host validation enforces an allowlist (or
the field is not URL-fetched, only multipart upload).

### A10-T02 🔴 Bhashini / Lingva URL config

`LINGVA_URL` env var lets you override the translation host. Confirm
this is not user-controllable — only set by the operator at deploy
time.

### A10-T03 🟠 Razorpay outbound calls — pinned hosts

The API hits `api.razorpay.com` only. Confirm no environment variable
or DB field controls the destination URL of payment-create calls (so
a tenant cannot redirect payment creation to an attacker host).

### A10-T04 🟡 WhatsApp / SMS provider URLs

Same as above — Twilio / Gupshup endpoints hardcoded, not configurable
per outlet.

---

## Mobile-Specific (M-series — OWASP Mobile Top 10)

The Capacitor wrapper inherits all the PWA risks above but also adds a
small native surface.

### M01 🔴 Camera permission gating (the one you asked for)

Confirm: deny camera permission, app shows blocking dialog with
Open Settings / Exit. Grant via Settings → app unblocks.

(Already validated empirically in `mobile-v0.1.5`.)

### M02 🟠 WebView allowNavigation allowlist

`capacitor.config.ts` lists `order.vezeor.cloud`, `api.vezeor.cloud`,
`*.razorpay.com`, `api.razorpay.com`. Confirm a link in the WebView
to a non-allowlisted host opens externally (or fails) rather than
loading inside the WebView with the app's storage / cookies.

Test by typing `https://evil.example` in a `window.open(...)` call
from the dev console.

**Pass**: opens in system browser, not in the WebView.

### M03 🟠 Universal/deep-link validation

When App Links are enabled, only `https://order.vezeor.cloud/s/*`
URLs should open the app. A spoofed link like
`https://evil.example.com/s/table/x` must NOT open the app.

(Will need verification once assetlinks.json is in place.)

### M04 🟡 Insecure storage of token

The PWA stores the JWT in `localStorage`. In the WebView this maps to
WebView storage on disk. Confirm:

- Storage is in app-private directory (`/data/data/<package>/...`)
- Cannot be read by other apps without root

**Pass**: `adb shell ls /data/data/cloud.vezeor.paynpik.customer.staging/`
returns `permission denied` on a non-rooted device.

### M05 🟡 ProGuard / R8 enabled for release builds

Open the release APK with `apktool` — confirm Java code is obfuscated
(class names like `a.b.c`, not `MainActivity`).

### M06 🟡 Root / Frida detection

Optional: refuse to run on rooted devices (or warn the user). Not
required for a restaurant ordering app but worth considering for
payment flows.

### M07 🟢 No debug build distributed

Confirm only signed release APKs are uploaded to Play Store — no debug
APKs in distribution channels.

---

## End-to-End Pen-Test Scenarios

Beyond the individual checks above, run these full-flow attack
scenarios at minimum once before launch and once per quarter.

### PT-01 — Multi-tenant data leak walkthrough

Goal: as Outlet Admin of business A, see ANY data from business B.

Walk through every endpoint enumeratable from the API surface (Swagger
generates the list — use a local-only Swagger build for testing).
Attempt parameter tampering, IDOR, query-string smuggling.

**Pass**: zero data leaks across the audit.

### PT-02 — Payment double-charge

Goal: trigger a real Razorpay charge twice for one order.

Try: network blip during verify, refresh during checkout, hit `verify`
endpoint twice with same payload, send mismatched signature, replay
captured webhook.

**Pass**: customer is charged exactly once per order in all paths.

### PT-03 — Phantom order

Goal: place an order without paying (or with payment going to a
different account).

Try: hit `POST /orders` with `payment.mode=CASH` from customer PWA,
modify `paymentStatus` via `PATCH /payments/:id/confirm`, exploit
race conditions between order create and payment verify.

**Pass**: all phantom-order attempts rejected.

### PT-04 — Reward / coupon abuse

Goal: pay less than the menu price.

Try: stack coupons, apply expired coupon, redeem rewards beyond
balance, edit `discountAmount` via the create order payload.

**Pass**: server-side recompute catches all tampering.

---

## CI integration

Add a `security-checks` GitHub Actions job that runs the deterministic
subset of these on every push to `main`:

```yaml
- name: Critical security regressions
  run: |
    bash docs/security-checks.sh   # to be created — invokes A05-T01,
                                    # A05-T02, A05-T03, A02-T01, A07-T05
```

Tests that need a running prod instance (most of the A01 / A07 family)
stay manual — run them quarterly and before major releases.

---

## Reporting template

When a test fails:

```
TEST-ID: <e.g. A01-T03>
SEVERITY: <copied from above>
REPRODUCTION:
  <exact commands + expected vs actual>
IMPACT:
  <1-3 sentences on real-world consequence>
RECOMMENDED FIX:
  <where in code + what change>
WORKAROUND (if any):
  <env var toggle, config flag, etc.>
```

File as a GitHub issue with the `security` label.
