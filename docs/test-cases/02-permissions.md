# 02 — Permissions & roles

Covers server-side gates, UI hides, the platform-only scope wall, and
template-role cascading.

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
