# 03 — Platform admin

Covers business CRUD, the new business detail page, deactivation, and
the platform-fee defaults + per-business overrides.

### PLAT-001 — Add a business (P0)
**Pre:** platform admin signed in.
**Steps:** *Platform → Businesses → Add Business*; fill non-cluster form.
**Expected:** New business created. Default Business Owner role cloned from template. Admin user row created.
**Actual Result: [GAP / FAIL]** The API does not check user roles. Any logged-in user can create a new business.

### PLAT-002 — Open business detail page (P0)
**Steps:** Click a non-cluster business row in the list.
**Expected:** Redirect to `/platform/businesses/:id`. Identity, contact, subscription, platform-fee override and outlets render.
**Actual Result: [GAP / FAIL]** Tested on the live server. A staff user token successfully fetched the list of all businesses (200 OK) and can fetch details for any business.

### PLAT-003 — Open cluster detail (P0)
**Steps:** Click a cluster row.
**Expected:** Redirect to `/platform/clusters/:id` (existing cluster admin).
**Actual Result: [GAP / FAIL]** The backend does not restrict access to cluster details, allowing any logged-in user to query them.

### PLAT-004 — Deactivate / reactivate business (P1)
**Steps:** From the detail page, click "Deactivate business" → confirm → click "Activate".
**Expected:** Status toggles. No 500. Toast shows.
**Actual Result: [GAP / FAIL]** Any logged-in user can deactivate/activate businesses because the API lacks role checks.

### PLAT-005 — Business list search across multiple fields (P0)
**Pre:** at least two businesses with distinct addresses + GST numbers.
**Steps:** Type partial GST → type partial city → type partial name → clear.
**Expected:** Filtered count updates live. Subtitle reads "X of Y match …".
**Actual Result: [GAP / FAIL]** The search endpoint is exposed to all logged-in users on the API level.

### PLAT-006 — Business list sort cycles asc/desc (P1)
**Steps:** Pick "Outlets" sort → click direction toggle.
**Expected:** Sort flips. Rows reorder.
**Actual Result: [GAP / FAIL]** Sorting lists of businesses is exposed to all logged-in users.

### PLAT-007 — Platform fee defaults editable (P0)
**Steps:** *Sidebar → Fees → edit Percent + Minimum → Save defaults*.
**Expected:** 200. `paynpik_platform_settings.platformFeePercent` reflects the new value.
**Actual Result: [PASSED with Gaps]** The settings endpoint correctly checks permissions, but since MANAGE_PLATFORM_SETTINGS can be assigned by a business owner, they can bypass this block.

### PLAT-008 — Per-business platform-fee override (P0)
**Steps:** From the Fees page → row's Override button → enter values → Save.
**Expected:** `paynpik_businesses` row gets the override. Subsequent Razorpay route payments for that business use the override.
**Actual Result: [GAP / FAIL]** Setting business overrides uses the generic business update endpoint, which lacks platform-admin authorization checks.

### PLAT-009 — Revert per-business override (P1)
**Steps:** From Fees page → row's Revert button.
**Expected:** Row reads "Default" again. DB columns set to NULL.
**Actual Result: [GAP / FAIL]** Reverting the override uses the generic business update endpoint and is completely unprotected on the API level.
