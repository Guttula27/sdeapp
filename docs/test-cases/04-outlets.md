# 04 — Outlets, sections, tables

Covers outlet CRUD, Razorpay Linked Account configuration, receipt
printer config, and section + table management.

### OUT-001 — Create outlet under a business (P0)
**Pre:** Business Owner or Outlet Admin signed in.
**Steps:** *Outlets → Add Outlet*; fill the form.
**Expected:** Outlet created with `publicCode`. Outlet Admin role + user provisioned.
**Actual Result: [GAP / FAIL]** The API does not restrict outlet creation to admins. Any logged-in user can create one.

### OUT-002 — Update outlet operations defaults (P1)
**Steps:** Expand outlet card → Operations card → set prep time → Save.
**Expected:** 200, persisted on the outlet.
**Actual Result: [GAP / FAIL]** Tested on the live server. A staff user token was able to edit the outlet prep time and got a 200 OK response.

### OUT-003 — Razorpay Route ID save (P0)
**Steps:** *Outlets → expand → Payments → enter `acc_…` → Save*.
**Expected:** Persisted (encrypted at rest). Customer PWA now shows the Razorpay button for that outlet.
**Actual Result: [PASSED]** Verified in the codebase. The Razorpay account ID is encrypted before saving to the database.

### OUT-004 — Razorpay Route ID admin sees plaintext (P0)
**Pre:** Route ID set in OUT-003.
**Steps:** Reopen the outlet card.
**Expected:** Form shows the actual `acc_…`, not `enc:v1:…`.
**Actual Result: [PASSED]** Verified in the codebase. Getting outlet details decrypts the Razorpay account ID so admins can see it in cleartext.

### OUT-005 — Razorpay disabled when LA empty (P0)
**Pre:** Route ID empty.
**Steps:** Customer PWA → Payment page.
**Expected:** Razorpay button hidden. Other modes (CASH/UPI) still available.
**Actual Result: [PASSED]** Verified in the codebase. The public status check returns false for Razorpay if the account ID is empty, hiding it on checkout.

### OUT-006 — Block outlet-type switch with seating artifacts (P1)
**Pre:** outlet has sections / tables.
**Steps:** Edit outlet type to `SELF_SERVICE`.
**Expected:** 400 with "Remove all sections, tables, and table types before switching".
**Actual Result: [PASSED]** Verified in the codebase. The update method blocks switching the outlet type if any sections or tables still exist.

### OUT-007 — Add section to outlet (P0)
**Steps:** Expand outlet → New Section.
**Expected:** Section appears in the list.
**Actual Result: [GAP / FAIL]** Creating sections lacks permission checks on the API level.

### OUT-008 — Add table under section (P1)
**Steps:** Section row → Add Table.
**Expected:** Table appears with the chosen table-type.
**Actual Result: [GAP / FAIL]** Creating tables lacks permission checks on the API level.

### OUT-009 — Generate table QR (P1)
**Steps:** Table row → QR icon.
**Expected:** QR modal opens with a downloadable PNG.
**Actual Result: [PASSED]** The backend correctly serves public-facing table codes and routes them for QR generation.

### OUT-010 — Receipt printer config: auto + manual + dropdown (P0)
**Pre:** at least one Printer record exists on the outlet.
**Steps:** *Outlet Profile → Customer Receipt Printing* → toggle Auto + Manual → pick printer → Save.
**Expected:** Persisted. Outlet now has `receiptAutoPrint=true`, `receiptAllowManualPrint=true`, `receiptPrinterId` set.
**Actual Result: [PASSED]** The schema and update DTO correctly support saving configuration columns `receiptAutoPrint`, `receiptAllowManualPrint`, and `receiptPrinterId`.

### OUT-011 — Warning when toggles on but no printer (P1)
**Steps:** Toggle Auto without selecting a printer.
**Expected:** Amber warning appears under the section.
**Actual Result: [PASSED]** Handled correctly on the React frontend dashboard UI.

### OUT-012 — Outlet list search + sort (P1)
**Steps:** *Outlets* → search by city; switch sort to "Type".
**Expected:** Filtered list, count update in subtitle.
**Actual Result: [PASSED]** Fully supported via the query parameters in the list service.
