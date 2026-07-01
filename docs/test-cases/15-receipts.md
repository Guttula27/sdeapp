# 15 — Receipt printing (customer bill)

Covers the redesigned thermal receipt layout, discount breakdown,
CGST+SGST vs IGST split, the round-off line for legacy orders, and the
Bluetooth print path.

### REC-001 — Receipt renders multi-line outlet header (P0)
**Steps:** Open an order detail → Download Receipt.
**Expected:** Outlet name on its own line; address line 1; address line 2 (if set); city/state/pincode; Tel; GSTIN — each on its own line with breathing room.
**Actual Result: [PASSED]** PDF and Bluetooth payloads successfully split and print outlet names, address details, and contact numbers on separate lines in the header.

### REC-002 — Item rows have visible separators (P1)
**Steps:** Render a receipt with ≥3 items.
**Expected:** Each row separated by a dotted line; columns aligned (Qty / Rate / Amount right-aligned).
**Actual Result: [PASSED]** Thermal receipt output formats each item row with dotted line dividers and aligns price and quantity columns correctly.

### REC-003 — Discount breakdown lines (P0)
**Pre:** order has a coupon and reward redemption.
**Steps:** Open receipt.
**Expected:** Each component on its own line (`Coupon (CODE)`, `Reward points (N pts)`); `Other discount` line for any leftover aggregate; total adds up.
**Actual Result: [PASSED]** Discount breakdowns show distinct lines for coupons, reward points, and other discounts.

### REC-004 — GST split CGST + SGST intra-state (P0)
**Pre:** stored cgst + sgst > 0.
**Steps:** Render receipt.
**Expected:** `CGST 2.5%` + `SGST 2.5%` lines (split evenly).
**Actual Result: [PASSED]** Intra-state orders with CGST and SGST split the tax rate in half and render CGST and SGST lines separately.

### REC-005 — GST split IGST inter-state (P1)
**Pre:** stored cgst = 0 but taxAmount > 0.
**Steps:** Render receipt.
**Expected:** Single `IGST 5%` line.
**Actual Result: [PASSED]** Inter-state orders where CGST is zero render a single IGST line at the full rate.

### REC-006 — Round-off line absorbs old-math drift (P1)
**Pre:** legacy order persisted under the gross-tax math.
**Steps:** Render its receipt.
**Expected:** Round-off line shows ±the small delta. Grand total still matches stored value.
**Actual Result: [PASSED]** Legacy math rounding differences are absorbed by a dedicated Round off line (e.g. +₹0.02 or -₹0.04) on the receipt.

### REC-007 — Grand total matches stored (P0)
Across REC-003..006.
**Expected:** Total matches.
**Actual Result: [PASSED]** The grand total value printed on the receipt matches the exact stored total in the database after all calculations.

### REC-008 — PDF download via html2pdf (P1)
**Steps:** Click Download Receipt.
**Expected:** PDF downloads at 80mm width.
**Actual Result: [PASSED]** The client download receipt trigger outputs an 80mm PDF file containing the formatted thermal style receipt.

### REC-009 — Bluetooth print button visible when manual enabled (P0)
**Pre:** outlet `receiptAllowManualPrint=true` + printerId set.
**Steps:** Open order detail.
**Expected:** "Print Receipt" button appears next to Download.
**Actual Result: [PASSED]** If receipt manual printing is allowed and a printer ID is set, the Print Receipt button displays next to the Download button.

### REC-010 — Bluetooth print auto-connects on first press (P1)
**Steps:** Click Print Receipt.
**Expected:** Web Bluetooth chooser prompt → after pairing, print fires.
**Actual Result: [PASSED]** Pressing Print Receipt invokes the browser's Web-Bluetooth selector, connecting to and pairing with the thermal printer.

### REC-011 — Auto-print on order placement (P0)
**Pre:** `receiptAutoPrint=true` + printer connected.
**Steps:** Place an order.
**Expected:** Bluetooth print fires immediately.
**Actual Result: [PASSED]** Enabling receipt auto-print sends print jobs directly to the connected printer immediately upon order completion.

### REC-012 — 58mm paper width auto-aligns (P2)
**Steps:** `<ThermalReceipt paperWidth="58mm" />` in a story or test page.
**Expected:** Layout shrinks to fit; columns still align.
**Actual Result: [PASSED]** Setting the receipt width to 58mm scales down the layout margins while preserving column alignments.
