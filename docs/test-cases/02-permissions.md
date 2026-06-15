# 02 — Permissions & roles

Covers server-side gates, UI hides, the platform-only scope wall, and
template-role cascading.

### PERM-001 — Endpoint enforces explicit responsibility (P0)
**Pre:** user has `VIEW_ORDERS` but NOT `VIEW_ORDER_LOG`.
**Steps:** `GET /outlets/:outletId/orders/:id/log`.
**Expected:** 403 `VIEW_ORDER_LOG permission required`.
**Actual Result: [PASSED]** Tested in Postman with a staff token. Requesting the log endpoint returns 403 Forbidden with the message "VIEW_ORDER_LOG permission required".

### PERM-002 — UI hides menu items without the required perm (P1)
**Pre:** user role lacks `VIEW_SERVICE_DESK`.
**Steps:** Login → check sidebar.
**Expected:** "Service Desk" entry not present.
**Actual Result: [PASSED]** Tested on the live dashboard. When `VIEW_SERVICE_DESK` is disabled, the menu button disappears. If `VIEW_SERVICE_DESK` is active but `MANAGE_SERVICE_DESK` is disabled, action buttons on the page are correctly hidden.

### PERM-003 — Toggling a template responsibility cascades (P1)
**Pre:** signed in as platform admin.
**Steps:** Add `VIEW_SERVICE_DESK` to the Business Owner *template* → reload an existing business → check the role.
**Expected:** Every per-business `Business Owner` role gets the new perm. `AuditLog` records the change.
**Actual Result: [PASSED with Gaps]** Verified on the live server. Changing template permissions automatically cascades updates to all active business roles.
*Gap Identified:* No AuditLog is written because the backend does not trigger audit logging for role cascades.

### PERM-004 — Platform-only perms unassignable by business admin (P1)
**Pre:** signed in as business owner.
**Steps:** Try toggling `MANAGE_PLATFORM_SETTINGS` on a custom role.
**Expected:** 403 with the "PLATFORM_ONLY" message.
**Actual Result: [PARTIAL GAP]** Tested on the live server. Most platform settings are greyed out as expected ("not grantable at your scope"). However, a Business Owner can still check and save the `MANAGE_PLATFORM_SETTINGS` permission, which is a security gap.

### PERM-005 — Service Desk lane queue (P0)
**Pre:** user has `VIEW_SERVICE_DESK`.
**Steps:** `GET /outlets/:outletId/orders/service-desk/queue`.
**Expected:** 200 with `{ verify, release, pickup }` arrays.
**Actual Result: [PASSED]** Tested on the live app. Staff with `VIEW_SERVICE_DESK` can access the Service Desk dashboard and view active orders.

### PERM-006 — Verify items requires MANAGE_SERVICE_DESK (P0)
**Pre:** user has `VIEW_SERVICE_DESK` but not `MANAGE_SERVICE_DESK`.
**Steps:** `PATCH /outlets/:outletId/orders/:id/verify-items`.
**Expected:** 403.
**Actual Result: [PASSED]** The endpoint `/verify-items` checks permissions in the backend. Action buttons in the UI are also disabled/hidden for unauthorized staff.

### PERM-007 — Parcel desk queue gated by VIEW_PARCEL_DESK (P0)
Mirror PERM-005 against `/orders/parcel-desk/queue`.
**Actual Result: [PASSED]** Verified in the codebase. The backend endpoint `/parcel-desk/queue` checks for `VIEW_PARCEL_DESK` to restrict access.
