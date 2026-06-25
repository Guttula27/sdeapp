# Coupon Allowance — Design Note

Adds a new coupon `kind = 'ALLOWANCE'` to support **employee-style
periodic entitlements**: "one meal per day", "two tea/coffee per day",
"five items per week" — at a fixed discounted price or a percentage
off, redeemable across a configurable item / category / subcategory
scope, with a quota that resets daily / weekly / monthly inside an
overall validity window.

Existing flat-discount coupons (`kind = 'STANDARD'`) keep their
current behaviour. The data model widens; the customer-facing UX
splits into a different rendering branch when the active coupon is an
ALLOWANCE.

---

## 1. Why a new kind, not a new model

Decision (confirmed): extend `Coupon`, do not branch into a separate
table. Trade-offs accepted:

- One admin list, one quote endpoint, one usage ledger.
- Schema widens with nullable fields meaningful only to ALLOWANCE
  (`resetPeriod`, `perPeriodQuota`).
- New child rows (`CouponScope`, `CouponTargetTag`) live alongside the
  existing `CouponCustomer` so targeting and scoping share a mental
  model.

---

## 2. Behaviour spec

### 2.1 Targeting (who can use the coupon)

`Coupon.targetType` extends to three values (was two):

| `targetType` | Meaning | Required side data |
|--------------|---------|--------------------|
| `ALL` (default) | any signed-in customer of the outlet may pick it | none |
| `SPECIFIC` | only listed user ids | `CouponCustomer` rows |
| `TAG` *(new)* | any user whose outlet customer-tag matches one of the listed tags | `CouponTargetTag` rows |

A user with a matching tag at the outlet sees the coupon in their
available list. Tag assignment lives on `CustomerTagAssignment`
(`userId`, `outletId`, `customerTagId`, unique per (user, outlet)).
Tags are outlet-scoped, so an ALLOWANCE coupon using TAG targeting
must itself be outlet-scoped (`coupon.outletId IS NOT NULL`) and the
referenced tag must belong to the same outlet — enforced in
`validate`.

### 2.2 Scope (what items the coupon applies to)

A new join table `CouponScope` carries (couponId, kind, refId) rows,
each pointing at an `Item`, `Category`, or `Subcategory`. A cart line
is "eligible" if any of:

- there's a `CouponScope` row with kind=ITEM and refId = line.itemId
- there's a `CouponScope` row with kind=SUBCATEGORY and refId = line.subcategoryId
- there's a `CouponScope` row with kind=CATEGORY and refId = line.categoryId

The three are OR'd — admin can mix freely ("two coffees OR any
sandwich"). Required to be non-empty for ALLOWANCE; ignored entirely
for STANDARD (validated in service).

### 2.3 Quota and reset

`Coupon.resetPeriod` ∈ {`DAILY`, `WEEKLY`, `MONTHLY`} — required for
ALLOWANCE. `Coupon.perPeriodQuota` is the integer N units allowed per
period. Reset boundaries (UTC for v1; outlet timezone is a follow-up):

| Period | Boundary | Start of current period at time `t` |
|--------|----------|-------------------------------------|
| DAILY | midnight UTC | `t.utc.startOf('day')` |
| WEEKLY | Monday 00:00 UTC | `t.utc.startOf('isoWeek')` |
| MONTHLY | 1st 00:00 UTC | `t.utc.startOf('month')` |

The overall `validUntil` still caps everything — quota does not reset
past it.

### 2.4 Quota unit = item units (confirmed)

A line `{ itemId: 'X', qty: 2 }` consumes 2 units against the quota
when item X is in scope. The discount applies per-unit.

### 2.5 Multi-item application within one order (confirmed)

When the cart has multiple eligible lines, the coupon applies to all
of them, in lowest-price-first order, until the remaining quota for
the period is exhausted. Lowest-price-first because the discount
yields a smaller absolute saving on cheap items — so if quota is
limited and the customer mixed a sandwich with a tea, the sandwich
keeps its full discount and the tea takes the leftover. (Alternative
would be highest-first, which maximises the cash benefit; we go
cheapest-first because the employee-allowance spirit is "you get N
units of *anything in scope*", not "auto-optimise the saving".)

### 2.6 Discount expression

Same `discountType` field as STANDARD: `PERCENT` or `FIXED`.
Interpretation differs:

- `PERCENT`: per eligible *unit*, discount = unitPrice × value / 100.
- `FIXED`: per eligible *unit*, discount = value capped at unitPrice
  (employee pays max ₹0 if the fixed discount exceeds the price).

`maxDiscountAmount` still caps the total discount across the order if
set. `minBillAmount` is ignored for ALLOWANCE (the discount is item-
local, not bill-local; demanding a minimum bill on a benefit coupon
feels wrong).

### 2.7 Edge cases

- **Quota reaches zero mid-order**: discount applies to as many units
  as the quota permits, the remainder pays full price. Customer is
  shown the partial application.
- **Two redemptions in one period**: the second redemption uses
  remaining quota = N − units_already_consumed_this_period.
- **Order cancelled / refunded**: the corresponding `CouponUsage` row
  remains for audit; but it **is** subtracted when computing
  per-period consumption (i.e., a cancellation restores the quota).
  Tracked via a `CouponUsage.voidedAt` column added below.
- **maxUsesPerCustomer**: still honoured for STANDARD; for ALLOWANCE,
  set it to null (per-period quota replaces it as the rate-limit).
  The admin form forces this.

---

## 3. Schema diff

### 3.1 `Coupon` — additive columns

```prisma
model Coupon {
  // ... existing fields unchanged ...

  /// 'STANDARD' (default, original behaviour) | 'ALLOWANCE' (periodic
  /// item-scoped entitlement). Required, defaulted so legacy rows keep
  /// working without backfill.
  kind String @default("STANDARD") @db.VarChar(20)

  /// ALLOWANCE only: 'DAILY' | 'WEEKLY' | 'MONTHLY'. Null for STANDARD.
  resetPeriod String? @db.VarChar(10)

  /// ALLOWANCE only: integer N units per period. Null for STANDARD.
  perPeriodQuota Int?

  scopes      CouponScope[]
  targetTags  CouponTargetTag[]
}
```

### 3.2 New: `CouponScope`

```prisma
/// Defines what an ALLOWANCE coupon discounts. Each row is one of:
/// (kind=ITEM, refId=item.id), (kind=SUBCATEGORY, refId=subcategory.id),
/// (kind=CATEGORY, refId=category.id). A cart line is eligible when
/// any of its (itemId / subcategoryId / categoryId) matches a row.
model CouponScope {
  id       String @id @default(cuid())
  couponId String
  coupon   Coupon @relation(fields: [couponId], references: [id], onDelete: Cascade)
  /// 'ITEM' | 'CATEGORY' | 'SUBCATEGORY'
  kind     String @db.VarChar(20)
  refId    String

  createdAt DateTime @default(now())

  @@unique([couponId, kind, refId])
  @@index([kind, refId])
  @@map("paynpik_coupon_scopes")
}
```

`refId` is a string FK without a relation field, on purpose — three
different parents, polymorphic. We enforce existence in the service
layer (cheaper than three nullable FK columns and matches the existing
Discount/Offer pattern).

### 3.3 New: `CouponTargetTag`

```prisma
/// ALLOWANCE/TAG targeting. Customers assigned this tag at the
/// coupon's outlet see it as available.
model CouponTargetTag {
  id            String      @id @default(cuid())
  couponId      String
  coupon        Coupon      @relation(fields: [couponId], references: [id], onDelete: Cascade)
  customerTagId String
  customerTag   CustomerTag @relation(fields: [customerTagId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([couponId, customerTagId])
  @@index([customerTagId])
  @@map("paynpik_coupon_target_tags")
}
```

### 3.4 `CouponUsage` — quota accounting

```prisma
model CouponUsage {
  // ... existing fields unchanged ...

  /// ALLOWANCE only: units this redemption consumed against the period
  /// quota. STANDARD redemptions write 0 so they don't poison the
  /// allowance period-consumed sum if a coupon is later converted.
  itemUnits Int @default(0)

  /// Set when the linked order is voided / refunded so the quota is
  /// restored. The period-consumed sum filters `voidedAt IS NULL`.
  voidedAt DateTime?

  // ...
  @@index([couponId, userId, appliedAt])
}
```

The composite index supports the period-consumed sum
`WHERE couponId=? AND userId=? AND appliedAt >= ?`.

---

## 4. Service layer changes (`CouponsService`)

### 4.1 `validate`

Branch on `kind`:

- STANDARD: today's checks, unchanged.
- ALLOWANCE:
  - `resetPeriod` ∈ {DAILY, WEEKLY, MONTHLY}.
  - `perPeriodQuota > 0`.
  - At least one `scope` row.
  - If `targetType=TAG`: `targetTagIds` non-empty; coupon must be
    outlet-scoped; each tag's `outletId` must equal the coupon's
    `outletId`.
  - `maxUsesPerCustomer` ignored (force null on write).
  - `minBillAmount` ignored (force null on write).

### 4.2 `create` / `update`

- Accept new DTO fields: `kind`, `resetPeriod`, `perPeriodQuota`,
  `scope: { kind, refId }[]`, `targetTagIds: string[]`.
- On create, write child rows in the same `$transaction`.
- On update, replace child rows the same way `CouponCustomer` is
  replaced today (deleteMany + createMany).

### 4.3 `availableFor`

Extend the targetType check:

```ts
if (c.targetType === 'TAG') {
  if (!userId) continue;
  const hasTag = await this.prisma.customerTagAssignment.findFirst({
    where: {
      userId,
      outletId,
      customerTagId: { in: c.targetTags.map(t => t.customerTagId) },
    },
    select: { id: true },
  });
  if (!hasTag) continue;
}
```

For ALLOWANCE, the customer-side list also filters out coupons whose
current-period quota is already exhausted (best-effort hint — the real
gate is in `quote`).

### 4.4 `quote` — split signature

```ts
async quote(
  couponId: string,
  userId: string,
  billSubtotal: number,
  cart?: Array<{
    itemId: string;
    subcategoryId: string;
    categoryId: string;
    qty: number;
    unitPrice: number;
  }>,
): Promise<{
  coupon: Coupon;
  discountAmount: number;
  // ALLOWANCE only — for redemption ledger + per-line UI breakdown
  itemUnits?: number;
  perLine?: Array<{ itemId: string; units: number; discount: number }>;
}>
```

- STANDARD branch: today's path, ignores `cart`.
- ALLOWANCE branch:
  1. Validity window + `isActive` + targetType check (TAG via tag
     assignment lookup).
  2. Determine `periodStart` from `resetPeriod` and now.
  3. `consumed = SUM(itemUnits) FROM CouponUsage WHERE couponId=? AND
     userId=? AND voidedAt IS NULL AND appliedAt >= periodStart`.
  4. `remaining = perPeriodQuota - consumed`. If ≤ 0 → throw "quota
     exhausted for this period".
  5. If `cart` is missing → throw "cart required for allowance quote".
  6. Build eligible-units list: for each cart line, if eligible, emit
     `qty` units at `unitPrice`. Sort ascending by `unitPrice` (see
     §2.5 — cheapest-first to spread the benefit).
  7. Walk the list, consuming units until `remaining = 0` or list
     ends. Compute per-unit discount per `discountType`.
  8. Sum discount, optionally cap with `maxDiscountAmount`.
  9. Return `{ discountAmount, itemUnits, perLine }`.

### 4.5 Redemption write (`OrdersService.create`)

Today (line 508):

```ts
await tx.couponUsage.create({
  data: { couponId, userId, orderId, discountAmount },
});
```

Becomes:

```ts
await tx.couponUsage.create({
  data: {
    couponId,
    userId,
    orderId,
    discountAmount,
    itemUnits: quoteResult.itemUnits ?? 0,
  },
});
```

`usesCount++` stays for STANDARD; for ALLOWANCE, we still bump it (it
becomes a "lifetime redemption count" instead of "lifetime use cap")
because `maxTotalUses` continues to apply globally.

### 4.6 Void/refund hook

Wherever orders flip to a void/refund terminal state, add:

```ts
await tx.couponUsage.updateMany({
  where: { orderId, voidedAt: null },
  data: { voidedAt: new Date() },
});
```

So the customer's quota is restored. Two callsites (regular order
void; cluster order void) — verify both during implementation.

---

## 5. Pricing service threading

`PricingService.quoteCart` calls
`coupons.quote(couponId, customerId, preCustomerTotal)` today. Change
the call site to pass cart lines in the shape `quote` expects (it
already has the same data assembled in `lineItems`). The response's
new optional `itemUnits` and `perLine` flow up via `Quote['coupon']`
so the order's bill breakdown can show per-line splits if we want
(out of scope for v1; render only the total discount).

---

## 6. Admin UX changes

Single coupons admin page, two-mode form. Switching `Kind` toggles
which fields render:

| Field | STANDARD | ALLOWANCE |
|-------|----------|-----------|
| code | yes | yes |
| name / description | yes | yes |
| outlet (or business-wide) | yes | yes |
| discountType / discountValue | yes | yes (per unit) |
| maxDiscountAmount | optional cap | optional cap |
| minBillAmount | yes | hidden / forced null |
| validFrom / validUntil | yes | yes |
| maxUsesPerCustomer | yes | hidden / forced null |
| maxTotalUses | optional global cap | optional global cap |
| `kind` | dropdown defaulting to STANDARD | switches to ALLOWANCE |
| `resetPeriod` | hidden | required dropdown |
| `perPeriodQuota` | hidden | required integer |
| scope (item/category/subcategory multi-pick) | hidden | required, at least one |
| targetType | ALL / SPECIFIC | ALL / SPECIFIC / TAG |
| target tag picker | hidden unless TAG | shown when TAG |
| target customers | shown when SPECIFIC | shown when SPECIFIC |

Scope picker: tabbed multi-select with three tabs (Items / Categories
/ Subcategories) reading from existing menu endpoints. Saved as
`scope: { kind, refId }[]`.

Tag picker: lists the outlet's `CustomerTag` rows; outlet must be set
before this control is enabled (TAG requires outlet-scoped coupon —
§2.1).

---

## 7. Customer PWA changes

The coupon code apply path on the customer cart currently posts
`{ couponId }` and reads back `{ discountAmount }`. Two extensions:

1. Pass the cart line items along (`cart` argument from §4.4).
2. For ALLOWANCE responses, render a small explainer below the
   coupon line: "Allowance: 2 of 5 / week used. ₹X off on
   1 × Sandwich, ₹Y off on 1 × Tea." Pulled from the `perLine`
   response.

If the user hits the period limit, render the rejection as a soft
warning ("Allowance exhausted today — resets tomorrow at midnight")
rather than a generic "coupon not available".

---

## 8. Migration plan

A single Prisma migration adds:

1. Three new columns on `paynpik_coupons`: `kind` (default `STANDARD`),
   `resetPeriod` (nullable), `perPeriodQuota` (nullable).
2. New tables `paynpik_coupon_scopes`, `paynpik_coupon_target_tags`.
3. Two new columns on `paynpik_coupon_usages`: `itemUnits` (default 0),
   `voidedAt` (nullable).
4. Composite index `(couponId, userId, appliedAt)` on
   `paynpik_coupon_usages`.

Backfill: none required — existing rows take the column defaults and
remain valid STANDARD coupons. The migration is forward-only and
backward-compatible (old binaries ignore the new columns).

`prisma migrate dev` may hit the shadow-DB perms issue documented in
the Phase 1/3 migrations — fall back to raw SQL under
`prisma/migrations/<ts>_coupon_allowance/migration.sql` and
`prisma migrate deploy` as we've done before.

---

## 9. Rollout

Phased deploy:

1. **Schema only.** Apply the migration. Old code continues to work;
   new columns default. No user-visible change.
2. **API.** Deploy the service + controller changes. Existing
   STANDARD path unchanged. ALLOWANCE endpoints functional but no
   coupons of that kind exist yet, so no behaviour drift.
3. **Admin UI.** Deploy the form changes. Operators can now create
   ALLOWANCE coupons.
4. **Customer PWA.** Deploy the cart-aware quote + rendering. Old
   clients still work for STANDARD; if an old client tries to redeem
   an ALLOWANCE coupon, the quote rejects ("cart required for
   allowance quote"). Acceptable — only employees can create
   ALLOWANCE coupons in the rollout window, and they need the
   updated PWA.

Steps 2–4 can ship in one release for simplicity if we're confident
no old PWA bundles linger.

---

## 10. Open follow-ups (not in this change)

- **Outlet-timezone period boundaries.** v1 uses UTC; pizza shifts
  closing at 23:00 IST will not see a fresh daily quota until 05:30
  IST. Acceptable for launch; revisit when we wire outlet TZ
  into the model.
- **Quota replenishment on partial refunds.** v1 voids the entire
  redemption on a void; partial-refund handling lives outside this
  doc.
- **Multi-tenant allowance pools.** If a business wants "two cups
  across all five outlets per day", the per-outlet scoping today
  doesn't model that. Out of scope.
- **Audit page for an employee's allowance history.** Useful but
  trivially derivable from `CouponUsage` filtered by user; skip the
  bespoke UI until requested.
