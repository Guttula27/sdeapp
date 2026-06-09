# Recent Features — Operator + Developer Reference

Captures everything added between 2026-06-08 and 2026-06-09. Use this
as the source of truth when updating the `.docx` user manuals in this
folder (they're binary so they aren't auto-edited).

---

## 1. Razorpay Route — automatic split payments per outlet

**What it does.** When an outlet has a Razorpay Linked Account (LA) ID
configured, every Razorpay payment for that outlet is captured into
the paynpik master account, the platform fee is retained, and the
remainder is auto-transferred to the outlet's LA on payment capture.

**Where to find it (admin).**
- *Outlets → expand outlet card → Payments card → "Razorpay Route ID".*
- Empty value = customer PWA hides the Razorpay option entirely (the
  outlet falls back to cash / UPI / other configured modes).
- Set to an `acc_…` ID = Razorpay button appears in checkout.

**Where to find it (platform admin).**
- *Sidebar → "Fees" → Platform fees page.*
- Default platform fee: percent + minimum floor (e.g. 2.5% with ₹2
  minimum). Applied to every Route payment unless a business overrides.
- Per-business override: same page, table at the bottom — "Override"
  button per row.

**What the customer sees.** Pays the full ticket. They never see the
LA id or the fee split — that's an internal Razorpay reference.

---

## 2. Menu × Section availability

**What it does.** Lets an outlet admin hide specific menus from
customers seated in a specific section (e.g. hide the "Bar menu" in
the "Family room" section).

**Where to find it.** *Outlets → expand outlet → section row → "Menus"
button.* Toggle each menu on/off. The outlet's default menu is always
on (locked).

**How it applies.** When the customer scans a table QR, the API
resolves the table → section → exclusions and removes the disabled
menus from the customer's menu fetch. The customer never sees the
hidden menus.

---

## 3. Outlet-aware order lifecycle

**What changed.** The order state machine now branches by outlet type
so the wording on each card matches what the staff actually does:

| Outlet type | Lifecycle |
|---|---|
| Self-service | Placed → Queued → Preparing → **On its way** (kitchen done, service desk shuttling) → **Ready** (released to pickup counter) → Served |
| Dine-in (Prepaid / Postpaid) | Placed → Queued → Preparing → Ready → On its way (server walking) → Served |
| Parcel | Placed → Queued → Preparing → Ready → Ready-for-pickup → Served (unchanged) |

**Impact on existing orders.** Backward-compatible — the validator
still accepts the legacy `READY → SERVED` direct path for self-service
orders that were already mid-flight when the change deployed.

---

## 4. Postpaid verification gate

**What it does.** For postpaid (Dine-in Postpaid) orders, new items
added by the customer sit in a `PENDING_VERIFICATION` state until a
service-desk staff member confirms the order. Only after confirm does
the kitchen see those items.

**Customer flow.** Customer scans table QR → adds items → "Add to my
tab" → items are queued for verification. Staff walks to the table,
verbally confirms the order with the customer, then taps "Confirm" on
the service desk dashboard.

**Important constraint — multi-customer tables.** A single table can
hold multiple open postpaid tabs at once (one per phone). When a
customer scans the QR with a different phone, a new tab is created —
their items aren't merged into someone else's bill.

---

## 5. Service desk dashboard

**Where to find it.** *Sidebar → "Service Desk"* (visible to roles
with `VIEW_SERVICE_DESK`).

**Three lanes:**
- **Verify** (amber) — postpaid orders with items awaiting confirmation.
  Actions: Confirm | Strike.
- **Release** (blue) — self-service orders kitchen has finished;
  service desk releases to the pickup counter.
  Action: Release for pickup.
- **Pick up** (green) — dine-in orders kitchen has finished;
  service desk picks up to deliver.
  Actions: On its way | Served.

**Real-time.** Cards flash + a chime plays when a new item enters a
lane (Socket.IO push). Browser autoplay rules block the chime until
the page is interacted with once.

---

## 6. Per-order log (audit trail)

**Where to find it.** *Orders page → click any order → "Order log"
section in the detail panel.* Visible to roles with `VIEW_ORDER_LOG`
(default for Outlet Admin and Kitchen Manager).

**Shows.** Each stage transition with timestamp, the staff member's
name + role, and any notes. The non-permissioned roles still see the
old basic timeline (status + time only).

---

## 7. Encryption + logging (platform-level)

**Field encryption at rest.**
- `User.phone` → `phoneEnc` (AES-256-GCM) + `phoneHash` (HMAC for
  lookups, unique-indexed). Plaintext column is kept one cycle as a
  safety net.
- `Outlet.razorpayLinkedAccountId` → encrypted.
- `Payment.gatewayRef` and `Payment.gatewayResponse` → encrypted.
- Decryption happens at the service boundary so the admin UI sees
  cleartext when editing.

**Passwords.** Already bcrypt-hashed at cost 12; no change.

**Winston logging.**
- `logs/app-*.log` — request + framework events (14d retention).
- `logs/audit-*.log` — state changes (90d retention): order status,
  item status, payments, postpaid verifies, role-permission grants.
- Built-in redaction strips secret-bearing keys and masks phone
  numbers in any log line.

**Required env var:** `APP_ENCRYPTION_KEY` (32 bytes hex). In prod,
boot fails without it. Dev has a deterministic fallback (loud warn).

---

## 8. Permission catalogue additions

New responsibilities. Run `npm run db:seed` after deploying to
register them; the seed is now idempotent.

| Permission | Module | Granted by default to |
|---|---|---|
| `VIEW_ORDER_LOG` | ORDERS | Outlet Admin, Kitchen Manager |
| `VIEW_SERVICE_DESK` | KITCHEN | Outlet Admin, Cashier |
| `MANAGE_SERVICE_DESK` | KITCHEN | Outlet Admin, Cashier |
| `MANAGE_PLATFORM_SETTINGS` | PLATFORM | Platform Admin |

---

## Updating the user manuals

The following `.docx` files in this folder need manual edits:

- **`PayNPik-Business-Features.docx`** — sections on Outlet config
  should add the Razorpay Route ID + Payments card.
- **`PayNPik-Outlet-Features.docx`** — add the Service Desk dashboard
  workflow + Per-section menu availability.
- **`PayNPik-Stations-Staff-Operations-Manual.docx`** — replace the
  order lifecycle section with the new outlet-type-aware flow and
  document the postpaid verification step.
- **`PayNPik-Customer-Features.docx`** — note that customers on the
  same table now see only their own tab (phone-scoped).
- **`PayNPik-Menu-User-Manual.docx`** — add the Section × Menu
  availability toggle.

Use this file (`docs/recent-features.md`) as the copy source.
