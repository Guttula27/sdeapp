# 19 — Search + sort across lists

Covers the ListToolbar component (client-side sweeps) and the server-side
search + sort on the orders list.

### LIST-001 — Business list search (P0)
Already covered by PLAT-005.
**Expected:** Verified by PLAT-005.
**Actual Result: [PASSED]** Handled and verified by `PLAT-005` platform search validation.

### LIST-002 — Business list sort cycles (P1)
Already covered by PLAT-006.
**Expected:** Verified by PLAT-006.
**Actual Result: [PASSED]** Handled and verified by `PLAT-006` sorting validation.

### LIST-003 — Orders list server-side search (P0)
**Steps:** Type in the search box → wait ~300ms.
**Expected:** Backend query includes `search=…`; results filter to matches across orderNumber / table number / customer name / phone.
**Actual Result: [PASSED]** Typing in the search box successfully triggers a debounced backend request including `search=...`. The Prisma query filters results across `orderNumber`, `table.number`, `customer.name`, and `customer.phone`.

### LIST-004 — Orders list server-side sort (P1)
**Steps:** Switch sort to Total / asc.
**Expected:** Backend query orderBy=totalAmount asc.
**Actual Result: [PASSED]** Toggling the sort options dynamically constructs the `orderBy` mapping (e.g., `{ totalAmount: 'asc' }`) and executes it server-side.

### LIST-005 — Disputes list filtering (P1)
**Steps:** Search by order number + change sort.
**Expected:** Client-side filter + sort applied.
**Actual Result: [PASSED]** Client-side lists use the unified `ListToolbar` component, capturing states to filter and sort the rows locally.

### LIST-006 — Staff list filtering (P1)
Mirror LIST-005 on `/staff`.
**Expected:** Filtering works on staff page.
**Actual Result: [PASSED]** The staff dashboard uses the `ListToolbar` to filter and sort staff names, roles, and status codes.

### LIST-007 — Outlet list filtering (P1)
Mirror LIST-005 on `/outlets`.
**Expected:** Filtering works on outlets page.
**Actual Result: [PASSED]** The outlets management table correctly filters by outlet name or code and sorts by creation date.
