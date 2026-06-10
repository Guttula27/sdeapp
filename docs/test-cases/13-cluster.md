# 13 — Cluster checkout

Covers the cluster bundle, multi-outlet cart, Razorpay Route splits with
per-business platform fees, signature verification, and the prefix scheme.

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
