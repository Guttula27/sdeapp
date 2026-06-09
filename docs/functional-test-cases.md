# Functional Test Cases

Generated 2026-06-10. Living document — update when features land or
existing flows change.

Companion files:
- `docs/security-test-cases.md` — OWASP-style and abuse-path tests.
- `docs/permissions.md` — role-permission matrix that some tests reference.

## How to use

Each case has:

- **ID** — stable identifier (`AUTH-001`, `ORD-014`, etc.).
- **Priority** — P0 (blocker, run on every release), P1 (run before
  each feature deploy), P2 (full regression).
- **Pre-reqs** — what state the system must be in before the test runs.
- **Steps** — operator-facing actions.
- **Expected** — observable outcome.

Conventions used in the steps:

- `<staff>` = signed-in as a staff role (specified per case)
- `<customer>` = customer flow on the PWA (`apps/customer`)
- `<admin>` = signed-in as an admin tier on the admin web (`apps/web`)
- All endpoints use the `/api/v1/` prefix the API mounts globally.

---

## 1. Authentication & session

### AUTH-001 — Staff login by phone + password (P0)
**Pre:** staff user exists with phone `9876543210` / pw `Owner@123`.
**Steps:** `POST /auth/login { phone, password }`.
**Expected:** 200, body has `accessToken` + `user.role.responsibilities[]`.

### AUTH-002 — Staff login with wrong password (P0)
**Steps:** `POST /auth/login` with bad password.
**Expected:** 401 `Invalid credentials`. No session row created.

### AUTH-003 — Customer OTP request → verify happy path (P0)
**Steps:** `POST /auth/customer/request-otp { phone }` → `POST /auth/customer/verify-otp { phone, otp: '123789' }`.
**Expected:** Both 200/201. Verify returns `accessToken`. New `User` row created if phone didn't exist.

### AUTH-004 — Customer OTP request with staff phone (P0)
**Pre:** the phone is attached to a staff user (`businessId` not null).
**Steps:** `POST /auth/customer/request-otp { phone: <staffPhone> }`.
**Expected:** 401 `Use the staff portal to sign in with this number`.

### AUTH-005 — Phone lookup via HMAC (P0)
**Pre:** phone-encryption deploy completed; `PhoneBackfillService` ran.
**Steps:** Login with the same phone the user registered with.
**Expected:** Login succeeds. `paynpik_users.phoneHash` row matches `phoneHmac(phone)`.

### AUTH-006 — Stale plaintext phone fallback (P1)
**Pre:** a user row exists with `phoneHash IS NULL` (legacy).
**Steps:** Login with that phone.
**Expected:** Login succeeds via the plaintext-column fallback in `findByPhone`. Subsequent boots backfill `phoneHash`.

### AUTH-007 — Refresh token rotation (P1)
**Steps:** Login → use refresh token to get a new access token.
**Expected:** New access token. Old one continues to work until expiry.

### AUTH-008 — Force-password-reset on first login (P1)
**Pre:** outlet admin user with `mustChangePassword=true`.
**Steps:** Login → assert redirect to `/force-password-reset`.
**Expected:** Login OK; main app routes redirect until password is changed.

### AUTH-009 — Logout invalidates session (P1)
**Steps:** Login → `POST /auth/logout` with token → call `/auth/me`.
**Expected:** First call 200; second call 401.

---

## 2. Permissions & roles

### PERM-001 — Endpoint enforces explicit responsibility (P0)
**Pre:** user has `VIEW_ORDERS` but NOT `VIEW_ORDER_LOG`.
**Steps:** `GET /outlets/:outletId/orders/:id/log`.
**Expected:** 403 `VIEW_ORDER_LOG permission required`.

### PERM-002 — UI hides menu items without the required perm (P1)
**Pre:** user role lacks `VIEW_SERVICE_DESK`.
**Steps:** Login → check sidebar.
**Expected:** "Service Desk" entry not present.

### PERM-003 — Toggling a template responsibility cascades (P1)
**Pre:** signed in as platform admin.
**Steps:** Add `VIEW_SERVICE_DESK` to the Business Owner *template* → reload an existing business → check the role.
**Expected:** Every per-business `Business Owner` role gets the new perm. `AuditLog` records the change.

### PERM-004 — Platform-only perms unassignable by business admin (P1)
**Pre:** signed in as business owner.
**Steps:** Try toggling `MANAGE_PLATFORM_SETTINGS` on a custom role.
**Expected:** 403 with the "PLATFORM_ONLY" message.

### PERM-005 — Service Desk lane queue (P0)
**Pre:** user has `VIEW_SERVICE_DESK`.
**Steps:** `GET /outlets/:outletId/orders/service-desk/queue`.
**Expected:** 200 with `{ verify, release, pickup }` arrays.

### PERM-006 — Verify items requires MANAGE_SERVICE_DESK (P0)
**Pre:** user has `VIEW_SERVICE_DESK` but not `MANAGE_SERVICE_DESK`.
**Steps:** `PATCH /outlets/:outletId/orders/:id/verify-items`.
**Expected:** 403.

### PERM-007 — Parcel desk queue gated by VIEW_PARCEL_DESK (P0)
Mirror PERM-005 against `/orders/parcel-desk/queue`.

---

## 3. Platform admin

### PLAT-001 — Add a business (P0)
**Pre:** platform admin signed in.
**Steps:** *Platform → Businesses → Add Business*; fill non-cluster form.
**Expected:** New business created. Default Business Owner role cloned from template. Admin user row created.

### PLAT-002 — Open business detail page (P0)
**Steps:** Click a non-cluster business row in the list.
**Expected:** Redirect to `/platform/businesses/:id`. Identity, contact, subscription, platform-fee override and outlets render.

### PLAT-003 — Open cluster detail (P0)
**Steps:** Click a cluster row.
**Expected:** Redirect to `/platform/clusters/:id` (existing cluster admin).

### PLAT-004 — Deactivate / reactivate business (P1)
**Steps:** From the detail page, click "Deactivate business" → confirm → click "Activate".
**Expected:** Status toggles. No 500. Toast shows.

### PLAT-005 — Business list search across multiple fields (P0)
**Pre:** at least two businesses with distinct addresses + GST numbers.
**Steps:** Type partial GST → type partial city → type partial name → clear.
**Expected:** Filtered count updates live. Subtitle reads "X of Y match …".

### PLAT-006 — Business list sort cycles asc/desc (P1)
**Steps:** Pick "Outlets" sort → click direction toggle.
**Expected:** Sort flips. Rows reorder.

### PLAT-007 — Platform fee defaults editable (P0)
**Steps:** *Sidebar → Fees → edit Percent + Minimum → Save defaults*.
**Expected:** 200. `paynpik_platform_settings.platformFeePercent` reflects the new value.

### PLAT-008 — Per-business platform-fee override (P0)
**Steps:** From the Fees page → row's Override button → enter values → Save.
**Expected:** `paynpik_businesses` row gets the override. Subsequent Razorpay route payments for that business use the override.

### PLAT-009 — Revert per-business override (P1)
**Steps:** From Fees page → row's Revert button.
**Expected:** Row reads "Default" again. DB columns set to NULL.

---

## 4. Outlets, sections, tables

### OUT-001 — Create outlet under a business (P0)
**Pre:** Business Owner or Outlet Admin signed in.
**Steps:** *Outlets → Add Outlet*; fill the form.
**Expected:** Outlet created with `publicCode`. Outlet Admin role + user provisioned.

### OUT-002 — Update outlet operations defaults (P1)
**Steps:** Expand outlet card → Operations card → set prep time → Save.
**Expected:** 200, persisted on the outlet.

### OUT-003 — Razorpay Route ID save (P0)
**Steps:** *Outlets → expand → Payments → enter `acc_…` → Save*.
**Expected:** Persisted (encrypted at rest). Customer PWA now shows the Razorpay button for that outlet.

### OUT-004 — Razorpay Route ID admin sees plaintext (P0)
**Pre:** Route ID set in OUT-003.
**Steps:** Reopen the outlet card.
**Expected:** Form shows the actual `acc_…`, not `enc:v1:…`.

### OUT-005 — Razorpay disabled when LA empty (P0)
**Pre:** Route ID empty.
**Steps:** Customer PWA → Payment page.
**Expected:** Razorpay button hidden. Other modes (CASH/UPI) still available.

### OUT-006 — Block outlet-type switch with seating artifacts (P1)
**Pre:** outlet has sections / tables.
**Steps:** Edit outlet type to `SELF_SERVICE`.
**Expected:** 400 with "Remove all sections, tables, and table types before switching".

### OUT-007 — Add section to outlet (P0)
**Steps:** Expand outlet → New Section.
**Expected:** Section appears in the list.

### OUT-008 — Add table under section (P1)
**Steps:** Section row → Add Table.
**Expected:** Table appears with the chosen table-type.

### OUT-009 — Generate table QR (P1)
**Steps:** Table row → QR icon.
**Expected:** QR modal opens with a downloadable PNG.

### OUT-010 — Receipt printer config: auto + manual + dropdown (P0)
**Pre:** at least one Printer record exists on the outlet.
**Steps:** *Outlet Profile → Customer Receipt Printing* → toggle Auto + Manual → pick printer → Save.
**Expected:** Persisted. Outlet now has `receiptAutoPrint=true`, `receiptAllowManualPrint=true`, `receiptPrinterId` set.

### OUT-011 — Warning when toggles on but no printer (P1)
**Steps:** Toggle Auto without selecting a printer.
**Expected:** Amber warning appears under the section.

### OUT-012 — Outlet list search + sort (P1)
**Steps:** *Outlets* → search by city; switch sort to "Type".
**Expected:** Filtered list, count update in subtitle.

---

## 5. Menu management

### MENU-001 — Add category / subcategory / item (P0)
**Steps:** *Menu* → New Category → New Subcategory → New Item.
**Expected:** All three persisted. Item visible to the customer PWA after publish.

### MENU-002 — Toggle item availability (P0)
**Pre:** user has `TOGGLE_ITEM_AVAILABILITY`.
**Steps:** Click the visibility toggle on an item.
**Expected:** Item disappears from customer menu fetch on the next reload.

### MENU-003 — Variant + topping CRUD (P1)
**Steps:** Add a variant under an item; add a topping; assign topping to the item.
**Expected:** Customer cart shows variant choices + topping picker.

### MENU-004 — Multi-menu tabs (P1)
**Pre:** business has `multipleMenusEnabled=true`.
**Steps:** Create "Breakfast", "Lunch" menus; assign categories to each.
**Expected:** Customer PWA shows the menu tabs.

### MENU-005 — Menu × Section availability toggle (P0)
**Pre:** outlet has multiple menus and at least one section.
**Steps:** *Outlets → expand → section row → Menus → disable a menu*.
**Expected:** `paynpik_menu_section_exclusions` row created. Customer scanning a table in that section no longer sees the disabled menu.

### MENU-006 — Default menu cannot be disabled (P0)
**Steps:** In MENU-005, try to disable the default menu.
**Expected:** Toggle is locked / API returns 400 with "The default menu cannot be disabled".

### MENU-007 — Table-type × menu rule applies (P1)
**Pre:** outlet has table-types; one type has menu X disabled.
**Steps:** Customer scans a table of that type.
**Expected:** Menu X hidden. Combines with section rules from MENU-005.

### MENU-008 — Menu import from another outlet (P2)
**Pre:** user has `IMPORT_MENU`.
**Steps:** Import a sister outlet's menu.
**Expected:** Categories / subcategories / items duplicated under this outlet.

---

## 6. Order placement (admin web)

### ORD-001 — Counter order (CASH) (P0)
**Pre:** signed in as Cashier.
**Steps:** *Place Order* → add items → CASH.
**Expected:** Order created. `orderNumber` starts `ON-…`. Payment row marked SUCCESS.

### ORD-002 — Table order (UPI) (P0)
**Steps:** Pick table → add items → UPI.
**Expected:** Order created with `tableId` and `paymentMode=UPI`.

### ORD-003 — Customer phone resolves / creates a user (P1)
**Steps:** Enter a new customer phone in ORD-002.
**Expected:** `User` row created with `phoneHash` populated. `Order.customerId` references it.

### ORD-004 — Stock-limited item rejects oversell (P0)
**Pre:** item with `hasLimitedStock=true`, `availableQuantity=2`.
**Steps:** Add 3 of that item → place order.
**Expected:** 400 with "not available in requested quantity" message.

### ORD-005 — Status transitions allowed per outlet type (P0)
**Pre:** dine-in outlet, order at `READY`.
**Steps:** `PATCH /:id/status { status: 'OUT_FOR_SERVICE' }`.
**Expected:** 200 (table-service path). For a self-service outlet the same transition is allowed too (rolls READY → OUT_FOR_SERVICE → READY_FOR_PICKUP → SERVED).

### ORD-006 — Cancel order moves to CANCELLED (P0)
**Steps:** `PATCH /:id/cancel { reason }`.
**Expected:** Status=CANCELLED. `OrderStatusHistory` records `changedBy`.

### ORD-007 — Order log endpoint (P0)
**Pre:** user has `VIEW_ORDER_LOG`.
**Steps:** `GET /outlets/:outletId/orders/:id/log`.
**Expected:** 200 with entries `[ { status, at, notes, actor: { name, role } } ]`.

### ORD-008 — Coupon at checkout (P1)
**Pre:** active coupon scoped to the outlet.
**Steps:** Place order; pass `couponId` in body.
**Expected:** `Order.discountAmount > 0`. `CouponUsage` row created. GST recomputed on net.

### ORD-009 — Reward redemption at checkout (P1)
**Pre:** customer has reward balance.
**Steps:** Pass `rewardPoints` in body.
**Expected:** `RewardTransaction.type='REDEEM'` row. `Order.discountAmount` reflects the value.

### ORD-010 — Bundled paymentMode earns rewards immediately (P1)
**Pre:** customer linked to the order; reward config allows earn.
**Steps:** Place a CASH order.
**Expected:** `tryEarnRewards` fires; `RewardTransaction.type='EARN'` appears.

### ORD-011 — Order list search & sort (P0)
**Steps:** Search by order number; switch sort to Total → asc.
**Expected:** Server filters/sort applied. Backend log shows the query params.

### ORD-012 — Multi-outlet picker (business tier) (P1)
**Pre:** signed in as Business Owner with ≥2 outlets.
**Steps:** Order list → outlet picker → switch outlet.
**Expected:** Different list loads.

---

## 7. Customer PWA — menu + cart + checkout

### CUST-001 — QR scan resolves to outlet/table (P0)
**Steps:** Scan an outlet table QR.
**Expected:** Land on menu with the table identity set.

### CUST-002 — Add items, modify quantity, remove (P0)
**Steps:** Add item → +/- in cart → remove.
**Expected:** Cart state persisted in session storage; toppings allowed per item config.

### CUST-003 — Apply coupon (P1)
**Steps:** Enter / pick a coupon code.
**Expected:** Discount reflected on quote; on order placement, GST is computed on the net.

### CUST-004 — Pay via Razorpay (P0)
**Pre:** outlet has Route ID set + Razorpay configured.
**Steps:** Choose Pay via Razorpay → complete the Razorpay flow.
**Expected:** Order moves to paid. Backend captures via verify endpoint.

### CUST-005 — Pay via Razorpay hidden when LA empty (P0)
Already covered by OUT-005 — keep duplicate for the customer view.

### CUST-006 — Offline PWA can browse cached menu (P1)
**Steps:** Visit outlet menu while online → go offline → reload.
**Expected:** Workbox service worker serves cached menu.

### CUST-007 — Order tracking page shows live status (P0)
**Steps:** Place order → tracking page.
**Expected:** Socket pushes status changes in real time (READY, OUT_FOR_SERVICE, SERVED).

### CUST-008 — Customer alert sounds for ITEM_READY (P2)
**Pre:** customer linked to order.
**Steps:** Kitchen marks an item READY.
**Expected:** PWA plays the configured ringtone + shows in-app alert.

---

## 8. Kitchen workflow

### KIT-001 — Item status transitions (P0)
**Pre:** signed in as Kitchen role.
**Steps:** On a PENDING item → Start → Ready → Served.
**Expected:** Backend `OrderItemStatus` advances. Order auto-rolls up correctly (see KIT-002).

### KIT-002 — Order rollup respects outlet type (P0)
- Self-service: all items READY/SERVED → order auto-advances to `OUT_FOR_SERVICE` (not `READY`).
- Dine-in / parcel: all items READY → order moves to `READY`.

### KIT-003 — Kitchen station scopes visibility (P1)
**Pre:** kitchen user assigned to station A; items routed to station B.
**Steps:** Open kitchen board.
**Expected:** Station A's user sees only A's items (master kitchen user sees all).

### KIT-004 — PENDING_VERIFICATION items hidden from kitchen (P0)
**Pre:** postpaid order with unverified items.
**Steps:** Open kitchen board.
**Expected:** Only PENDING / PREPARING / READY items render — `PENDING_VERIFICATION` lines hidden.

### KIT-005 — Course planner holds higher sequences (P1)
**Pre:** order with items in sequence 1 + 2.
**Steps:** Mark sequence-1 items SERVED.
**Expected:** Sequence-2 items become live in the kitchen automatically.

### KIT-006 — Kitchen auto-print on ORDER_PLACED (P1)
**Pre:** outlet has `kitchenAutoPrint=true`; station has a printer; printer is connected.
**Steps:** Place an order containing items routed to that station.
**Expected:** Bluetooth print triggers without manual action.

### KIT-007 — Fullscreen toggle (P0)
**Steps:** Click the maximise icon.
**Expected:** Page enters fullscreen; icon flips to minimise; ESC restores.

---

## 9. Service Desk

### SVC-001 — Three lanes render correct status set (P0)
**Pre:** orders exist at READY (dine-in), OUT_FOR_SERVICE (self-service), and a postpaid order with `PENDING_VERIFICATION` items.
**Steps:** Open `/service-desk`.
**Expected:** Verify lane shows postpaid card; Release lane shows self-service card; Pickup lane shows dine-in card. Parcel orders absent.

### SVC-002 — Verify all PENDING_VERIFICATION items (P0)
**Pre:** logged in user has `MANAGE_SERVICE_DESK`.
**Steps:** Click Confirm on a verify card.
**Expected:** Items move to PENDING (kitchen sees them now). 200 response. Audit log line written.

### SVC-003 — Strike unverified items (P1)
**Steps:** Click Strike → confirm dialog.
**Expected:** Items move to CANCELLED. Card disappears.

### SVC-004 — Release self-service order (P0)
**Steps:** Click Release for pickup.
**Expected:** Status moves to `READY_FOR_PICKUP`. Customer alert `PICKUP_READY` fires.

### SVC-005 — Mark on its way (dine-in) (P0)
**Steps:** Click "On its way" on a pickup card.
**Expected:** Status moves to `OUT_FOR_SERVICE`. Customer alert `ORDER_READY` fires.

### SVC-006 — Mark served (dine-in) (P0)
**Steps:** Click Served on a pickup/already-on-the-way card.
**Expected:** Status `SERVED`. Card removed from the lane. Order closes.

### SVC-007 — Real-time alert + chime (P1)
**Steps:** Keep service desk open. From another window place a new postpaid order.
**Expected:** Card appears with a brief flash + chime (audio requires prior page interaction due to browser autoplay rules).

### SVC-008 — Fullscreen toggle (P0)
Same as KIT-007 on `/service-desk`.

---

## 10. Parcel Desk

### PCL-001 — Pack lane lists parcel orders at READY (P0)
**Pre:** parcel order completed in kitchen.
**Steps:** Open `/parcel-desk`.
**Expected:** Order appears under Pack.

### PCL-002 — Mark packed → Handover lane (P0)
**Steps:** Click "Mark packed".
**Expected:** Status moves to `READY_FOR_PICKUP`. Card moves to Handover. `PICKUP_READY` alert fires.

### PCL-003 — Mark handed over (P0)
**Steps:** Click "Mark handed over".
**Expected:** Status moves to `SERVED`. Card gone.

### PCL-004 — Real-time alert (P1)
Like SVC-007 but on the parcel desk room (`joinParcelDesk`).

### PCL-005 — Service desk does NOT show parcel orders (P0)
**Pre:** parcel order at READY.
**Steps:** Open `/service-desk`.
**Expected:** Order not in any lane.

### PCL-006 — Fullscreen toggle (P0)

---

## 11. Postpaid (dine-in)

### PP-001 — Customer scans table → no open tab on their phone (P0)
**Pre:** postpaid outlet; no existing open order for this customer at this table.
**Steps:** Customer adds items → "Place order".
**Expected:** New order created. Items start as `PENDING_VERIFICATION`. Service desk sees the verify card.

### PP-002 — Customer scans table → has open tab → "Add to my tab" (P0)
**Pre:** PP-001 already ran for this customer.
**Steps:** Same customer scans → adds items.
**Expected:** New items appended to the existing order, status `PENDING_VERIFICATION`. Service desk gets a verify nudge.

### PP-003 — Two customers same table, separate tabs (P0)
**Pre:** Customer A has open tab. Customer B scans the same QR with a different phone.
**Steps:** B places items.
**Expected:** New order created (B's tab); A's order untouched. `findOpenForTable` returned null for B because of the customer-key scoping.

### PP-004 — Staff resolves open tab via customerPhone query (P1)
**Pre:** PP-001 ran for customer with phone X.
**Steps:** Staff *Place Order* page → enter phone X (≥10 digits) → table picker.
**Expected:** "Open tab" panel appears showing the existing order's items.

### PP-005 — Unknown phone returns no tab (P1)
**Steps:** Staff enters a random phone never used.
**Expected:** No open tab UI; staff lands on the create-new-order flow.

### PP-006 — Bill Now closes additions (P0)
**Pre:** order at any postpaid state.
**Steps:** `PATCH /orders/:id/bill-request` → try appending more items.
**Expected:** First call 200; second call 400 with "Bill already requested".

### PP-007 — Postpaid verify gate removed when confirmed (P0)
**Pre:** order has 2 unverified lines.
**Steps:** Service desk → Confirm.
**Expected:** Lines move to PENDING. Kitchen board now shows them.

---

## 12. Payments

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

---

## 13. Cluster checkout

### CLU-001 — Cluster member outlet appears in cluster bundle (P0)
**Pre:** cluster has ≥1 member outlet.
**Steps:** `GET /clusters/:publicCode/bundle`.
**Expected:** Member outlets + their menus returned.

### CLU-002 — Add a non-cluster outlet as member (P1)
**Pre:** platform admin.
**Steps:** `POST /clusters/:id/members { outletCode }`.
**Expected:** ClusterMember row created.

### CLU-003 — Customer places a multi-outlet cart (P0)
**Pre:** cluster with two member outlets each having items.
**Steps:** `POST /cluster-orders` with items from both outlets.
**Expected:** Two child Orders created under their respective outlets; one ClusterOrder parent; Razorpay Route order with two transfers.

### CLU-004 — Platform fee applied per child business (P0)
**Pre:** business A has 2% override; business B uses default 3%.
**Steps:** Cluster cart 50:50 ₹400.
**Expected:** Transfer A nets ₹196 (₹200 − ₹4); Transfer B nets ₹194 (₹200 − ₹6). `routeTransfers` JSON records gross + fee per entry.

### CLU-005 — Verify cluster payment signature (P0)
**Pre:** Route order created.
**Steps:** `POST /cluster-orders/:id/verify { razorpayOrderId, razorpayPaymentId, razorpaySignature }`.
**Expected:** Decrypted stored `razorpayOrderId` matches input; signature passes; parent `paymentStatus=SUCCESS`; one Payment row per child Order.

### CLU-006 — Cluster Razorpay refs encrypted at rest (P0)
**Steps:** After CLU-005, query DB.
**Expected:** `paynpik_cluster_orders.razorpayOrderId / razorpayPaymentId / razorpaySignature` all start with `enc:v1:`. `paynpik_payments.gatewayRef` on child rows starts with `enc:v1:`.

### CLU-007 — Bypass marks paid in test (P2)
**Steps:** `POST /cluster-orders/:id/bypass`.
**Expected:** Status SUCCESS without going through Razorpay. Reward earn fires per child.

### CLU-008 — Child Order numbers use ON- prefix (P1)
**Steps:** Inspect childOrders.orderNumber.
**Expected:** Format `ON-OL-XXXX-NNNNN`.

### CLU-009 — Cluster orderNumber CLU- prefix (P1)
**Steps:** Inspect `clusterOrderNumber`.
**Expected:** Format `CLU-<publicCode>-<rnd>`.

---

## 14. Offline POS (admin web)

### OFF-001 — Menu cached after first visit (P0)
**Steps:** Visit Place Order online → close → open DevTools → `IndexedDB → paynpik-pos → menu-cache`.
**Expected:** One row per outletId.

### OFF-002 — Menu falls back to cache when offline (P0)
**Steps:** Set browser to Offline → reload Place Order.
**Expected:** Toast "Using cached menu — you appear to be offline". Menu still renders.

### OFF-003 — Place order offline (P0)
**Steps:** Offline → add items → Place Order.
**Expected:** Toast "Offline · order saved as OFF-…". An `offline-orders` IDB row appears with `syncState=pending`. The outbox has an entry.

### OFF-004 — Receipt prints from cart even offline (P1)
**Pre:** outlet has receiptAutoPrint + a paired/connected printer.
**Steps:** Place an offline order.
**Expected:** Bluetooth print fires with OFF- number on the receipt.

### OFF-005 — Sync replays on reconnect (P0)
**Steps:** From OFF-003, restore network.
**Expected:** Outbox drains. Idempotency-Key matches the OFF- number. Server creates the canonical order with an `ON-` number. The local IDB row flips to `syncState=synced` with `serverOrderNumber` populated.

### OFF-006 — Reconciliation view summary counts (P0)
**Steps:** Visit `/offline-orders`.
**Expected:** Three tiles: Pending / Synced / Failed match IDB contents.

### OFF-007 — Reprint from reconciliation view (P1)
**Steps:** Click Reprint on an entry.
**Expected:** Web Bluetooth prompt (if not yet connected) → print fires with the saved snapshot.

### OFF-008 — Force-sync button (P1)
**Steps:** Click "Sync now (N)".
**Expected:** Outbox drains; toast reports synced count.

### OFF-009 — Clear local entry preserves server copy (P1)
**Steps:** Click Clear → confirm.
**Expected:** Row disappears from the page; server order (if synced) stays.

### OFF-010 — Failed sync surfaces error (P2)
**Pre:** simulate a 4xx server rejection on replay (e.g. unknown phone validation fails).
**Steps:** Restore network; let the drain run.
**Expected:** Row's badge becomes Failed; hover shows error message.

---

## 15. Receipt printing (customer bill)

### REC-001 — Receipt renders multi-line outlet header (P0)
**Steps:** Open an order detail → Download Receipt.
**Expected:** Outlet name on its own line; address line 1; address line 2 (if set); city/state/pincode; Tel; GSTIN — each on its own line with breathing room.

### REC-002 — Item rows have visible separators (P1)
**Steps:** Render a receipt with ≥3 items.
**Expected:** Each row separated by a dotted line; columns aligned (Qty / Rate / Amount right-aligned).

### REC-003 — Discount breakdown lines (P0)
**Pre:** order has a coupon and reward redemption.
**Steps:** Open receipt.
**Expected:** Each component on its own line (`Coupon (CODE)`, `Reward points (N pts)`); `Other discount` line for any leftover aggregate; total adds up.

### REC-004 — GST split CGST + SGST intra-state (P0)
**Pre:** stored cgst + sgst > 0.
**Steps:** Render receipt.
**Expected:** `CGST 2.5%` + `SGST 2.5%` lines (split evenly).

### REC-005 — GST split IGST inter-state (P1)
**Pre:** stored cgst = 0 but taxAmount > 0.
**Steps:** Render receipt.
**Expected:** Single `IGST 5%` line.

### REC-006 — Round-off line absorbs old-math drift (P1)
**Pre:** legacy order persisted under the gross-tax math.
**Steps:** Render its receipt.
**Expected:** Round-off line shows ±the small delta. Grand total still matches stored value.

### REC-007 — Grand total matches stored (P0)
Across REC-003..006.

### REC-008 — PDF download via html2pdf (P1)
**Steps:** Click Download Receipt.
**Expected:** PDF downloads at 80mm width.

### REC-009 — Bluetooth print button visible when manual enabled (P0)
**Pre:** outlet `receiptAllowManualPrint=true` + printerId set.
**Steps:** Open order detail.
**Expected:** "Print Receipt" button appears next to Download.

### REC-010 — Bluetooth print auto-connects on first press (P1)
**Steps:** Click Print Receipt.
**Expected:** Web Bluetooth chooser prompt → after pairing, print fires.

### REC-011 — Auto-print on order placement (P0)
**Pre:** `receiptAutoPrint=true` + printer connected.
**Steps:** Place an order.
**Expected:** Bluetooth print fires immediately.

### REC-012 — 58mm paper width auto-aligns (P2)
**Steps:** `<ThermalReceipt paperWidth="58mm" />` in a story or test page.
**Expected:** Layout shrinks to fit; columns still align.

---

## 16. Audit log + per-order log

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

---

## 17. Encryption (data at rest)

### ENC-001 — APP_ENCRYPTION_KEY required in prod (P0)
**Steps:** Boot the API with `NODE_ENV=production` and no `APP_ENCRYPTION_KEY`.
**Expected:** Fatal error on boot.

### ENC-002 — Dev fallback warns loudly (P1)
**Steps:** Boot dev without the key.
**Expected:** Warn log "APP_ENCRYPTION_KEY not set — using a dev-only fallback key. DO NOT USE IN PRODUCTION."

### ENC-003 — Phone backfill populates on boot (P0)
**Pre:** users exist with `phoneHash IS NULL`.
**Steps:** Boot the API.
**Expected:** Log "phone backfill complete (N rows processed)". All rows now have phoneHash + phoneEnc.

### ENC-004 — Re-running backfill is a no-op (P1)
**Steps:** Restart API after ENC-003.
**Expected:** No rows updated; log line absent or N=0.

### ENC-005 — Encrypted columns hold `enc:v1:` (P0)
**Steps:** Query DB after a fresh write.
**Expected:** `user.phoneEnc`, `outlet.razorpayLinkedAccountId`, `payment.gatewayRef`, `payment.gatewayResponse.enc` all start with `enc:v1:`.

### ENC-006 — Legacy plaintext rows still readable (P0)
Already covered by AUTH-006.

### ENC-007 — Decrypt admin reads return plaintext (P0)
- Outlet admin form pre-fills with `acc_…` (OUT-004).
- Payment list shows plaintext `gatewayRef` (PAY-011).

### ENC-008 — Phone normalization yields a stable HMAC (P1)
**Steps:** Hash `"9876543210"`, `" 9876543210 "`, `"98765-43210"`.
**Expected:** All three produce the same hex.

---

## 18. Real-time sockets

### SOC-001 — Order created emits to outlet room (P0)
**Steps:** Open a websocket on `joinOutlet`. Place an order.
**Expected:** `orderCreated` event received.

### SOC-002 — Order status update fans out (P0)
**Steps:** Open kitchen, service-desk, parcel-desk sockets simultaneously.
**Expected:** Each receives `orderStatusUpdated` when status changes.

### SOC-003 — Service desk alert kinds routed correctly (P0)
- Self-service kitchen-done → `serviceDeskAlert { kind: 'release' }`.
- Dine-in kitchen-done → `serviceDeskAlert { kind: 'pickup' }`.
- New postpaid line → `serviceDeskAlert { kind: 'verify' }`.

### SOC-004 — Parcel desk alert kinds (P0)
- Parcel READY → `parcelDeskAlert { kind: 'pack' }`.
- Parcel READY_FOR_PICKUP → `parcelDeskAlert { kind: 'handover' }`.

### SOC-005 — Customer alert delivered to customer room (P1)
**Pre:** customer joined `customer:<id>`.
**Steps:** Trigger `PICKUP_READY` lifecycle dispatch.
**Expected:** `customerAlert` event received.

---

## 19. Search + sort across lists

### LIST-001 — Business list search (P0)
Already covered by PLAT-005.

### LIST-002 — Business list sort cycles (P1)
Already covered by PLAT-006.

### LIST-003 — Orders list server-side search (P0)
**Steps:** Type in the search box → wait ~300ms.
**Expected:** Backend query includes `search=…`; results filter to matches across orderNumber / table number / customer name / phone.

### LIST-004 — Orders list server-side sort (P1)
**Steps:** Switch sort to Total / asc.
**Expected:** Backend query orderBy=totalAmount asc.

### LIST-005 — Disputes list filtering (P1)
**Steps:** Search by order number + change sort.
**Expected:** Client-side filter + sort applied.

### LIST-006 — Staff list filtering (P1)
Mirror LIST-005 on `/staff`.

### LIST-007 — Outlet list filtering (P1)
Mirror LIST-005 on `/outlets`.

---

## 20. UX nice-to-haves

### UX-001 — Fullscreen on every dashboard (P1)
For each of: Kitchen, Orders, Service Desk, Parcel Desk — verify the maximise icon present, click → fullscreen, ESC → back.

### UX-002 — Confirm dialogs surface intent (P1)
For destructive actions (Strike postpaid, Deactivate business, Clear offline orders) — confirm dialog appears with copy.

### UX-003 — Toasts dismiss themselves (P2)
Toast messages auto-dismiss after a few seconds; the offline-saved toast lasts longer (6s by design).

### UX-004 — Mobile responsive (P1)
For each list page — narrow the viewport; non-essential columns collapse.

### UX-005 — Skeleton loaders on slow networks (P2)
Use DevTools "Slow 3G" → reload Orders / Outlets / Businesses pages.
Each shows skeleton placeholders before data arrives.

---

## 21. Smoke + regression

### SMK-001 — End-to-end staff happy path (P0)
1. Login as Outlet Admin.
2. Place a counter order (cash).
3. Move it through QUEUED → PREPARING → READY → OUT_FOR_SERVICE → SERVED via kitchen + service desk.
4. Open the order log; verify each transition has the right actor.
5. Reprint the receipt.

### SMK-002 — End-to-end customer happy path (P0)
1. Customer scans table QR.
2. Add items; apply a coupon.
3. Pay via Razorpay (test mode).
4. Track order status updates live.
5. Verify customer reward EARN row appears post-confirm.

### SMK-003 — Smoke script run (P0)
**Steps:** `API=… STAFF_PHONE=… STAFF_PASS=… OUTLET_ID=… bash scripts/smoke-test.sh`.
**Expected:** All green ticks; no failed lines.

---

## Coverage map (rough)

| Module | Tests |
|---|---|
| Auth + sessions | AUTH-001..009 |
| Permissions / roles | PERM-001..007 |
| Platform admin | PLAT-001..009 |
| Outlets / sections / tables | OUT-001..012 |
| Menu | MENU-001..008 |
| Order placement (admin) | ORD-001..012 |
| Customer PWA | CUST-001..008 |
| Kitchen | KIT-001..007 |
| Service desk | SVC-001..008 |
| Parcel desk | PCL-001..006 |
| Postpaid | PP-001..007 |
| Payments | PAY-001..011 |
| Cluster | CLU-001..009 |
| Offline POS | OFF-001..010 |
| Receipt printing | REC-001..012 |
| Audit log | LOG-001..008 |
| Encryption | ENC-001..008 |
| Sockets | SOC-001..005 |
| List search/sort | LIST-001..007 |
| UX | UX-001..005 |
| Smoke | SMK-001..003 |

**~165 cases total.** Run the P0 set on every release; P1 + P2 on
larger merges or before a customer-visible push.

---

## Recommended next step (turning this into automation)

This document is the foundation; converting to executable Jest /
Playwright tests is a separate effort. A reasonable phasing:

1. **API contract tests** (Jest + supertest) — start with PERM-*, AUTH-*, PAY-* since these define the security perimeter.
2. **Workflow integration tests** (Playwright) — cover the SMK-* end-to-end paths.
3. **Component tests** (Vitest + Testing Library) — receipt rendering (REC-001..007), list toolbar (LIST-*), useFullscreen hook (UX-001).

For each test, paste the matching ID into the test description so the
implementation, this document, and any defects stay traceable.
