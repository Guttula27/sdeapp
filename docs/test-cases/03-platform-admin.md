# 03 — Platform admin

Covers business CRUD, the new business detail page, deactivation, and
the platform-fee defaults + per-business overrides.

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
