# 15 — Receipt printing (customer bill)

Covers the redesigned thermal receipt layout, discount breakdown,
CGST+SGST vs IGST split, the round-off line for legacy orders, and the
Bluetooth print path.

### REC-001 — Receipt renders multi-line outlet header (P0)
**Steps:** Open an order detail → Download Receipt.
**Expected:** Outlet name on its own line; address line 1; address line 2 (if set); city/state/pincode; Tel; GSTIN — each on its own line with breathing room.

### REC-002 — Item rows have visible separators (P1)
**Steps:** Render a receipt with ≥3 items.
**Expected:** Each row separated by a dotted line; columns aligned (Qty / Rate / Amount right-aligned).

### REC-003 — Discount breakdown lines (P0)
**Pre:** order has a coupon and reward redemption.
**Steps:** Open receipt.
**Expected:** Each component on its own line (`Coupon (CODE)`, `Reward points (N pts)`); `Other discount` line for any leftover aggregate; total adds up.

### REC-004 — GST split CGST + SGST intra-state (P0)
**Pre:** stored cgst + sgst > 0.
**Steps:** Render receipt.
**Expected:** `CGST 2.5%` + `SGST 2.5%` lines (split evenly).

### REC-005 — GST split IGST inter-state (P1)
**Pre:** stored cgst = 0 but taxAmount > 0.
**Steps:** Render receipt.
**Expected:** Single `IGST 5%` line.

### REC-006 — Round-off line absorbs old-math drift (P1)
**Pre:** legacy order persisted under the gross-tax math.
**Steps:** Render its receipt.
**Expected:** Round-off line shows ±the small delta. Grand total still matches stored value.

### REC-007 — Grand total matches stored (P0)
Across REC-003..006.

### REC-008 — PDF download via html2pdf (P1)
**Steps:** Click Download Receipt.
**Expected:** PDF downloads at 80mm width.

### REC-009 — Bluetooth print button visible when manual enabled (P0)
**Pre:** outlet `receiptAllowManualPrint=true` + printerId set.
**Steps:** Open order detail.
**Expected:** "Print Receipt" button appears next to Download.

### REC-010 — Bluetooth print auto-connects on first press (P1)
**Steps:** Click Print Receipt.
**Expected:** Web Bluetooth chooser prompt → after pairing, print fires.

### REC-011 — Auto-print on order placement (P0)
**Pre:** `receiptAutoPrint=true` + printer connected.
**Steps:** Place an order.
**Expected:** Bluetooth print fires immediately.

### REC-012 — 58mm paper width auto-aligns (P2)
**Steps:** `<ThermalReceipt paperWidth="58mm" />` in a story or test page.
**Expected:** Layout shrinks to fit; columns still align.
