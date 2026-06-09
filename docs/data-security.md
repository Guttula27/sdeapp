# Data-Level Security Posture

Captures what's protected, how, and what's deliberately out of scope.
Updated 2026-06-09.

---

## At-rest protection

### Encrypted columns (AES-256-GCM, app-level)

| Table | Column | Notes |
|---|---|---|
| `paynpik_users` | `phoneEnc` | Encrypted phone. Plaintext `phone` column kept one cycle as a rollback safety net — drop in follow-up migration once verified. |
| `paynpik_users` | `phoneHash` | HMAC-SHA256 of normalised phone; unique-indexed for lookups. |
| `paynpik_outlets` | `razorpayLinkedAccountId` | Encrypted Linked Account ID (`acc_...`). |
| `paynpik_payments` | `gatewayRef` | Encrypted Razorpay payment reference. |
| `paynpik_payments` | `gatewayResponse` | JSON column; ciphertext stored as `{ enc: "enc:v1:..." }` to keep the column type Json without a schema migration. |

**Format.** Every encrypted value is stored with a version-tagged
prefix: `enc:v1:<base64(iv|tag|ciphertext)>`. The `decrypt()` helper
is a no-op on values that don't start with `enc:v1:`, so legacy
plaintext rows continue to read fine until they're naturally rewritten
(or the cleanup script forces a re-encrypt).

**Key source.** `APP_ENCRYPTION_KEY` env var — 32 bytes, hex-encoded
(64 hex chars). Generate once per environment with
`openssl rand -hex 32`. Boot fails in production if missing.

**Key derivation.** The HMAC sub-key (used for `phoneHash`) is derived
from the master key with a constant info string — only one secret to
manage in operations.

### Hashed (one-way)

| Table | Column | Algorithm |
|---|---|---|
| `paynpik_users` | `passwordHash` | bcrypt, cost factor 12. |

Passwords are intentionally **not encrypted** (which would be
reversible). Reset flow generates a new bcrypt hash.

### Plaintext at rest (intentional)

| Field | Reason it's plaintext |
|---|---|
| `User.email` | Lookup key for password-reset; encryption would require an HMAC twin column. Not a current priority. |
| `User.name` | Used in customer-facing receipts and order cards. |
| `Outlet.gstNumber`, `Business.gstNumber` | Required on printed bills + invoices. |
| `Order.*` financial fields | Required for reconciliation, GST filings, audit. |

---

## In-transit protection

- **API** — terminated by Dokploy / Nginx (HTTPS). Cleartext HTTP is
  not exposed.
- **Razorpay calls** — outbound HTTPS only (Razorpay SDK enforces).
- **WebSocket (`/orders` gateway)** — same origin as the API, so
  wrapped by the same TLS terminator.

---

## Logging hygiene

Winston is configured with a `redact` formatter that runs before any
transport. It strips these keys regardless of nesting depth:

```
password, passwordHash, otp, razorpaySignature, razorpay_signature,
razorpaySecret, razorpayKey, webhookSignature, token, jwt,
authorization, authToken, refreshToken
```

Replaced with `"[REDACTED]"` in both the message and any structured
context.

It also runs a phone-mask regex on string payloads:
`(+91 )?98765 43210 → ***3210` — last four digits kept so support
staff can correlate without exposing the full number.

**Log files** (rotated daily, gzip-compressed, capped at 20MB):
- `logs/app-*.log` — 14 days retention.
- `logs/audit-*.log` — 90 days retention. Captures order status
  changes, item status changes, payments, postpaid verifies,
  permission changes.

`logs/` is gitignored.

---

## Permission model

JWT carries `user.role.responsibilities[]`. Three enforcement layers:

1. **Route gate.** `@UseGuards(JwtAuthGuard)` per controller. The
   `OptionalJwtAuthGuard` is used only on public-customer endpoints
   (e.g. menu read).
2. **Responsibility check.** Inside the handler, `assertResponsibility(user, 'NAME')`
   throws 403 unless the user holds the named permission.
3. **Tenant scope.** `scopeFor(user)` returns `platform | business | outlet`
   based on the JWT claims; controllers branch on this for cross-tenant
   reads.

**Highly-sensitive endpoints** (write permissions, money operations):
- `PATCH /platform/settings` → `MANAGE_PLATFORM_SETTINGS`
- `PATCH /orders/:id/verify-items` → `MANAGE_SERVICE_DESK`
- `GET /orders/:id/log` → `VIEW_ORDER_LOG`
- `GET /orders/service-desk/queue` → `VIEW_SERVICE_DESK`

---

## Idempotency + replay protection

- All mutating customer-PWA endpoints accept an `Idempotency-Key`
  header (stamped by the client axios interceptor). The
  `IdempotencyInterceptor` stores `{key, scope, response}` keyed on
  the header and replays the cached response on retry; 409 if the same
  key is reused on a different route.
- Razorpay webhook signatures are verified with HMAC-SHA256 before any
  state change.

---

## Audit trail

Two complementary records:

1. **`OrderStatusHistory` table** — every status transition on every
   order. `changedBy` is now a real FK to `User` (with `ON DELETE SET NULL`
   so deleting staff doesn't break the trail).
2. **`logs/audit-*.log`** — JSON event stream for forensic queries
   beyond the order surface (payments, role grants, service-desk
   actions).

The per-order log is exposed in the admin UI at
*Orders → click order → Order log*, gated by `VIEW_ORDER_LOG`.

---

## Key management

| Secret | Where it lives | Rotation |
|---|---|---|
| `APP_ENCRYPTION_KEY` | Dokploy → service → Environment tab | Manual; requires re-encrypting all rows before the old key is dropped (write a one-off script when rotating). |
| `JWT_SECRET` | Same | Manual rotation invalidates every session — schedule a maintenance window. |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Same | Rotate via Razorpay dashboard; update env var simultaneously. |
| DB credentials | Same | Rotate via VPS DB admin; update env var. |

**Backup.** All secrets should live in a password manager outside
Dokploy. Losing `APP_ENCRYPTION_KEY` after rows are encrypted means
those rows are permanently unrecoverable.

---

## What's deliberately out of scope (today)

- **DB-level encryption (TDE).** Would protect against stolen disks
  but doesn't add value on top of field-level encryption for the
  sensitive columns. Revisit if SOC2 / DPDP requires it.
- **Hardware key store (KMS / HSM).** App-level key from env is fine
  for the current scale. Move to AWS KMS / Vault when scale or
  compliance demands.
- **Per-tenant encryption keys.** Currently one platform-wide key. If
  a single tenant ever demands BYOK, this is the natural extension
  point.
- **Tokenisation of payment metadata.** Razorpay tokens are already
  scoped + revocable on their side; storing the references is fine.
- **PII scrubbing in `customer_alerts` payloads.** WhatsApp / SMS
  message bodies are stored as rendered text for delivery audit. They
  contain customer names + order numbers but no phones / payment
  details. Sufficient for now.

---

## Verification checklist before sensitive deploys

- [ ] `APP_ENCRYPTION_KEY` set in target env (don't reuse dev fallback).
- [ ] Boot log does NOT contain `using a dev-only fallback key`.
- [ ] Boot log contains `phone backfill complete (N rows processed)`
      after the first deploy with phone encryption.
- [ ] Sample row in `paynpik_users` has both `phoneEnc` and `phoneHash`
      populated.
- [ ] Sample row in `paynpik_payments` after a test payment has
      `gatewayRef` starting with `enc:v1:`.
- [ ] `logs/audit-*.log` is being written (test by triggering one
      order status change).
- [ ] Razorpay webhook signature verification passes (test by sending
      a `payment.captured` event from Razorpay's dashboard).
