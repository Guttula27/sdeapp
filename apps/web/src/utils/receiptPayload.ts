import type { CustomerReceiptPayload, ReceiptDiscountLine, ReceiptItemLine } from './bluetoothPrinter';

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
  const items: ReceiptItemLine[] = (order.items ?? []).map((it: any) => ({
    itemName: it.item?.name ?? 'Item',
    variantName: it.variant?.name ?? null,
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
    totalPrice: Number(it.totalPrice),
  }));

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
    roundOff,
    total,
    paidVia,
  };
}
