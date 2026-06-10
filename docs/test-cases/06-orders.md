# 06 — Order placement (admin web)

Covers staff-driven order creation across counter / table / parcel
modes, lifecycle transitions, the order log, and the new server-side
list search + sort.

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
