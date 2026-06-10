# 02 — Permissions & roles

Covers server-side gates, UI hides, the platform-only scope wall, and
template-role cascading.

### PERM-001 — Endpoint enforces explicit responsibility (P0)
**Pre:** user has `VIEW_ORDERS` but NOT `VIEW_ORDER_LOG`.
**Steps:** `GET /outlets/:outletId/orders/:id/log`.
**Expected:** 403 `VIEW_ORDER_LOG permission required`.
**Actual Result: [SKIPPED / GAP]** There are no endpoint responsibility-checking guards implemented on endpoints in the active backend version. Staff scoping is verified (e.g. users cannot access other businesses' data), but granular responsibilities like `VIEW_ORDERS` or `VIEW_ORDER_LOG` are not gated on the API endpoints.

### PERM-002 — UI hides menu items without the required perm (P1)
**Pre:** user role lacks `VIEW_SERVICE_DESK`.
**Steps:** Login → check sidebar.
**Expected:** "Service Desk" entry not present.
**Actual Result: [N/A]** This is a frontend UI behavior test. The backend correctly includes or excludes responsibility arrays within the user payloads, allowing the client interface to conditionally hide menu items.

### PERM-003 — Toggling a template responsibility cascades (P1)
**Pre:** signed in as platform admin.
**Steps:** Add `VIEW_SERVICE_DESK` to the Business Owner *template* → reload an existing business → check the role.
**Expected:** Every per-business `Business Owner` role gets the new perm. `AuditLog` records the change.
**Actual Result: [PASSED with Gaps]** Platform admin toggling a responsibility on `business-owner-template` successfully cascades changes to all non-template roles of the same name (e.g. `business-owner-role` for the demo business). 

*Gap Identified:* No `AuditLog` was written, as the backend `RolesService` performs database updates directly without calling or implementing an audit log service.

### PERM-004 — Platform-only perms unassignable by business admin (P1)
**Pre:** signed in as business owner.
**Steps:** Try toggling `MANAGE_PLATFORM_SETTINGS` on a custom role.
**Expected:** 403 with the "PLATFORM_ONLY" message.
**Actual Result: [PASSED]** Successfully rejected with status 403. Attempting to assign `MANAGE_PLANS` (a platform-only permission) by a business owner returns: `ForbiddenException: MANAGE_PLANS can only be granted by a platform admin`.

### PERM-005 — Service Desk lane queue (P0)
**Pre:** user has `VIEW_SERVICE_DESK`.
**Steps:** `GET /outlets/:outletId/orders/service-desk/queue`.
**Expected:** 200 with `{ verify, release, pickup }` arrays.
**Actual Result: [SKIPPED]** Ignored. The Service Desk lane/endpoints are not implemented in the active working codebase branch.

### PERM-006 — Verify items requires MANAGE_SERVICE_DESK (P0)
**Pre:** user has `VIEW_SERVICE_DESK` but not `MANAGE_SERVICE_DESK`.
**Steps:** `PATCH /outlets/:outletId/orders/:id/verify-items`.
**Expected:** 403.
**Actual Result: [SKIPPED]** Ignored. The `/verify-items` endpoint is not implemented in the active working codebase branch.

### PERM-007 — Parcel desk queue gated by VIEW_PARCEL_DESK (P0)
Mirror PERM-005 against `/orders/parcel-desk/queue`.
**Actual Result: [SKIPPED]** Ignored. The Parcel Desk lane/endpoints are not implemented in the active working codebase branch.
