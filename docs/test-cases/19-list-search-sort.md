# 19 — Search + sort across lists

Covers the ListToolbar component (client-side sweeps) and the server-side
search + sort on the orders list.

### LIST-001 — Business list search (P0)
Already covered by PLAT-005.

### LIST-002 — Business list sort cycles (P1)
Already covered by PLAT-006.

### LIST-003 — Orders list server-side search (P0)
**Steps:** Type in the search box → wait ~300ms.
**Expected:** Backend query includes `search=…`; results filter to matches across orderNumber / table number / customer name / phone.

### LIST-004 — Orders list server-side sort (P1)
**Steps:** Switch sort to Total / asc.
**Expected:** Backend query orderBy=totalAmount asc.

### LIST-005 — Disputes list filtering (P1)
**Steps:** Search by order number + change sort.
**Expected:** Client-side filter + sort applied.

### LIST-006 — Staff list filtering (P1)
Mirror LIST-005 on `/staff`.

### LIST-007 — Outlet list filtering (P1)
Mirror LIST-005 on `/outlets`.
