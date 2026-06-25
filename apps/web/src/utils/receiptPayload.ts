import type {
  CustomerReceiptPayload,
  PackingSlipItemLine,
  PackingSlipPayload,
  ReceiptDiscountLine,
  ReceiptItemLine,
} from './bluetoothPrinter';

/**
 * Build the CustomerReceiptPayload (ESC/POS-ready) from an order
 * response object. Same shape used by ThermalReceipt.tsx — kept here
 * so both the PDF render and the bluetooth print path consume one
 * canonical projection of the order.
 *
 * Assumes the order was fetched with the receipt-friendly includes
 * (couponUsages + rewardTransactions + outlet address breakdown).
 * Missing fields collapse gracefully.
 */
export function buildReceiptPayload(order: any): CustomerReceiptPayload {
  // Collapse expanded combo children back under their parent so the
  // printed bill mirrors the customer's mental model: one line per
  // combo, with sub-items indented. Standalone items pass through.
  const items: ReceiptItemLine[] = (() => {
    const out: ReceiptItemLine[] = [];
    const seen = new Map<string, ReceiptItemLine>();
    for (const it of (order.items ?? [])) {
      const itemName = it.itemNameSnapshot || it.item?.name || 'Item';
      const variantName = it.variantNameSnapshot ?? it.variant?.name ?? null;
      if (it.bundleId) {
        let bundle = seen.get(it.bundleId);
        if (!bundle) {
          bundle = {
            itemName: it.bundleParent?.name || 'Combo',
            variantName: null,
            quantity: 0,
            unitPrice: 0,
            totalPrice: 0,
            bundleChildren: [],
          };
          seen.set(it.bundleId, bundle);
          out.push(bundle);
        }
        bundle.totalPrice += Number(it.totalPrice ?? 0);
        // Primary row carries the combo qty + price; siblings have
        // totalPrice = 0 and we just track their names for display.
        if (Number(it.totalPrice ?? 0) > 0) {
          bundle.quantity += Number(it.quantity);
          bundle.unitPrice = bundle.quantity > 0 ? bundle.totalPrice / bundle.quantity : Number(it.unitPrice);
        }
        bundle.bundleChildren!.push({
          itemName,
          variantName,
          quantity: Number(it.quantity),
        });
      } else {
        out.push({
          itemName,
          variantName,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          totalPrice: Number(it.totalPrice),
        });
      }
    }
    // Fallback: free combos (every child totalPrice=0) — use the
    // first child's qty so the line still prints something sensible.
    for (const b of out) {
      if (b.bundleChildren && b.quantity === 0 && b.bundleChildren.length > 0) {
        b.quantity = b.bundleChildren[0].quantity;
      }
    }
    return out;
  })();

  // Discount lines: coupons first (named with their code), then reward
  // redemptions, then any leftover aggregate as a generic "Discount" so
  // the receipt totals always add up.
  const discounts: ReceiptDiscountLine[] = [];
  const totalDiscount = Number(order.discountAmount ?? 0);
  let accounted = 0;
  for (const cu of order.couponUsages ?? []) {
    const amt = Number(cu.discountAmount);
    if (amt <= 0) continue;
    discounts.push({
      label: cu.coupon?.code ? `Coupon (${cu.coupon.code})` : 'Coupon',
      amount: amt,
    });
    accounted += amt;
  }
  for (const rt of order.rewardTransactions ?? []) {
    const amt = Number(rt.amountValue ?? 0);
    if (amt <= 0) continue;
    discounts.push({
      label: `Reward points (${Math.abs(rt.points)} pts)`,
      amount: amt,
    });
    accounted += amt;
  }
  const leftover = Math.max(0, totalDiscount - accounted);
  if (leftover > 0) {
    discounts.push({
      label: accounted > 0 ? 'Other discount' : 'Discount',
      amount: leftover,
    });
  }

  const subtotal = Number(order.subtotal ?? 0);
  const parcelCharge = Number(order.parcelAmount ?? 0);
  const taxable = Math.max(0, subtotal - totalDiscount);
  const cgst = Number(order.cgstAmount ?? 0);
  const sgst = Number(order.sgstAmount ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  const total = Number(order.totalAmount ?? 0);

  // Effective GST % — derived from stored taxAmount over the taxable
  // base so the receipt label matches the actual money charged.
  const base = taxable || subtotal;
  const gstPct = base > 0 ? Number(((taxAmount / base) * 100).toFixed(2)) : 0;

  // Intra-state (cgst+sgst) vs inter-state (igst) detection — mirrors
  // the ThermalReceipt logic so the print and the on-screen receipt
  // never disagree about the split.
  const intraState = cgst > 0 || sgst > 0;
  const igst = !intraState && taxAmount > 0 ? taxAmount : 0;

  // Multi-rate breakdown — group OrderItems by their snapshotted
  // gstRate so a mixed cart (food at 5% + beverages at 18%, or items
  // billed under an AC section's rate) prints one CGST/SGST line per
  // slab. Same logic the digital ThermalReceipt uses; keeping it
  // here means the printed bill and the PDF agree even before /
  // after any auto-discount scaling.
  const taxLines: NonNullable<CustomerReceiptPayload['taxLines']> = (() => {
    const groups = new Map<string, { rate: number; baseSum: number; gstAmount: number }>();
    for (const it of order.items ?? []) {
      const rate = Math.round(Number(it.gstRate ?? 0) * 100) / 100;
      if (rate <= 0) continue;
      const itBase = Number(it.totalPrice ?? 0);
      const itGst = Number(it.gstAmount ?? (itBase * rate) / 100);
      const key = rate.toFixed(2);
      const entry = groups.get(key) || { rate, baseSum: 0, gstAmount: 0 };
      entry.baseSum += itBase;
      entry.gstAmount += itGst;
      groups.set(key, entry);
    }
    const rows = Array.from(groups.values()).sort((a, b) => a.rate - b.rate);
    // Proportional scale to the Order's stored taxAmount when promotions
    // have shifted it away from the sum of per-line tax (mirrors the
    // ThermalReceipt logic). All-line bill / coupon / reward discounts
    // are flat-proportional so a uniform ratio preserves per-rate accuracy.
    const sumGst = rows.reduce((s, g) => s + g.gstAmount, 0);
    if (sumGst > 0 && taxAmount > 0 && Math.abs(taxAmount - sumGst) > 0.01) {
      const ratio = taxAmount / sumGst;
      for (const g of rows) g.gstAmount = g.gstAmount * ratio;
    }
    return rows.map((g) => intraState
      ? { rate: g.rate, cgst: g.gstAmount / 2, sgst: g.gstAmount / 2, gstAmount: g.gstAmount }
      : { rate: g.rate, igst: g.gstAmount, gstAmount: g.gstAmount },
    );
  })();

  // Round-off absorbs any gap between stored grand total and the sum
  // of components we're about to print — usually 0 for new orders but
  // can be a few paise on legacy ones persisted under the old
  // GST-on-gross math.
  const componentsSum = taxable + parcelCharge + taxAmount;
  const roundOff = Math.round((total - componentsSum) * 100) / 100;

  const outletAddress = [
    order.outlet?.addressLine1,
    order.outlet?.addressLine2,
    [order.outlet?.city, order.outlet?.state, order.outlet?.pincode].filter(Boolean).join(', '),
  ].filter(Boolean) as string[];
  if (outletAddress.length === 0 && order.outlet?.address) {
    outletAddress.push(order.outlet.address);
  }

  const paidVia = (() => {
    const success = (order.payments ?? []).filter((p: any) => p.status === 'SUCCESS');
    if (success.length === 0) return null;
    const seen = new Set<string>();
    for (const p of success) seen.add(String(p.mode));
    return Array.from(seen).join(' + ');
  })();

  return {
    orderNumber: String(order.orderNumber),
    tokenNumber: order.tokenNumber ?? null,
    printedAt: new Date().toISOString(),
    outletName: order.outlet?.name ?? 'Outlet',
    outletAddress,
    outletGstin: order.outlet?.gstNumber ?? null,
    outletPhone: order.outlet?.phone ?? null,
    customerName: order.customer?.name ?? null,
    table: order.table?.number ?? null,
    isParcel: !!order.isParcel,
    items,
    subtotal,
    parcelCharge,
    discounts,
    taxable,
    cgst: intraState ? cgst : undefined,
    sgst: intraState ? sgst : undefined,
    igst: igst > 0 ? igst : undefined,
    gstPct,
    taxLines: taxLines.length > 0 ? taxLines : undefined,
    roundOff,
    total,
    paidVia,
  };
}

/**
 * Returns true when an order should be printed as an aggregator
 * packing slip (no prices, just items + customer notes) instead of
 * the standard customer receipt. Used by every printer entry point so
 * the decision is made in one place — auto-print on create, manual
 * "Reprint" on the order detail, and the offline-orders reprint flow
 * all route through here.
 *
 * The rule is simple: anything not on the DIRECT channel is an
 * aggregator order. Server stamps Order.channel at materialise time.
 */
export function isAggregatorOrder(order: any): boolean {
  const ch = String(order?.channel ?? 'DIRECT').toUpperCase();
  return ch !== 'DIRECT' && ch !== '';
}

/**
 * Build the packing slip payload from an order. Mirrors
 * buildReceiptPayload's collapse-bundle logic so combos print as one
 * line with indented children, but strips prices and totals entirely.
 *
 * Customer notes come from order.notes (the order-level free-text
 * field) — the aggregator typically dumps "less spicy" / "no onion"
 * there at parse time. Per-line notes still surface under each item.
 */
export function buildPackingSlipPayload(order: any): PackingSlipPayload {
  const items: PackingSlipItemLine[] = [];
  const seen = new Map<string, PackingSlipItemLine>();
  for (const it of (order.items ?? [])) {
    const itemName = it.itemNameSnapshot || it.item?.name || 'Item';
    const variantName = it.variantNameSnapshot ?? it.variant?.name ?? null;
    const toppings = (it.toppings && Array.isArray(it.toppings))
      ? it.toppings.map((t: any) => t.label ?? t.name).filter(Boolean).join(', ') || null
      : null;
    if (it.bundleId) {
      let bundle = seen.get(it.bundleId);
      if (!bundle) {
        bundle = {
          itemName: it.bundleParent?.name || 'Combo',
          variantName: null,
          quantity: Number(it.quantity),
          toppings: null,
        };
        seen.set(it.bundleId, bundle);
        items.push(bundle);
      }
      // Children get listed as toppings-style sub-rows on the slip
      // so the picker can verify each combo component is in the bag.
      items.push({
        itemName: `  - ${itemName}`,
        variantName,
        quantity: Number(it.quantity),
      });
    } else {
      items.push({
        itemName,
        variantName,
        toppings,
        quantity: Number(it.quantity),
        notes: it.notes ?? null,
      });
    }
  }

  // Pull the aggregator's order id off the side table when the API
  // included it. Falls back to null — slip still prints, just without
  // the second ID line.
  const externalOrderId = order.aggregatorOrder?.externalOrderId ?? null;
  // Customer phone often comes through proxied / masked from the
  // aggregator (e.g. Swiggy returns "+91 99999XXXXX"). Print it as-is
  // so the rider can dial directly from the slip.
  const customerPhone = order.customer?.phone ?? null;

  return {
    orderNumber: String(order.orderNumber),
    channel: String(order.channel ?? 'DIRECT'),
    tokenNumber: order.tokenNumber ?? null,
    externalOrderId,
    printedAt: new Date().toISOString(),
    outletName: order.outlet?.name ?? 'Outlet',
    customerName: order.customer?.name ?? null,
    customerPhone,
    items,
    customerNotes: order.notes ?? null,
  };
}
