import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Thermal-style receipt — designed to render at ~80mm width so html2pdf
 * can rasterise it for a thermal printer (or download as PDF).
 *
 * Layout follows the "VEZEOR Olive-Mithai-Shop" format: centered header,
 * customer block (with masked phone), items table, totals, Payment
 * Summary, Tax Summary, footer. Matches the customer-side ThermalReceipt
 * (apps/customer/src/components/ThermalReceipt.tsx) so a customer's
 * PWA download and the admin's printed bill look identical.
 */

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  gstRate?: number | string | null;
  // Per-line tax snapshot — sum across same-rate items to print one
  // Tax-Summary row per slab when the cart mixes rates.
  gstAmount?: number | string | null;
  notes?: string | null;
  // Frozen names captured at order creation. Prefer these on a reprint
  // so the bill always shows what the customer actually ordered, even
  // after the menu item is renamed or removed.
  itemNameSnapshot?: string | null;
  variantNameSnapshot?: string | null;
  // Combo (bundle) parent — when set, this OrderItem is one expansion
  // of a combo. The customer-facing print collapses all OrderItems
  // sharing the same bundleId back into one combo line.
  bundleId?: string | null;
  bundleParent?: { id?: string; name?: string } | null;
  item?: { name?: string; hsnCode?: string | null } | null;
  variant?: { name?: string } | null;
};

type ReceiptRow =
  | { kind: 'item'; item: OrderItem }
  | { kind: 'bundle'; bundleId: string; name: string; children: OrderItem[]; quantity: number; totalPrice: number };

function groupBundles(items: OrderItem[]): ReceiptRow[] {
  const out: ReceiptRow[] = [];
  const seen = new Map<string, Extract<ReceiptRow, { kind: 'bundle' }>>();
  for (const it of items) {
    if (it.bundleId) {
      let bundle = seen.get(it.bundleId);
      if (!bundle) {
        bundle = {
          kind: 'bundle',
          bundleId: it.bundleId,
          name: it.bundleParent?.name || 'Combo',
          children: [],
          quantity: 0,
          totalPrice: 0,
        };
        seen.set(it.bundleId, bundle);
        out.push(bundle);
      }
      bundle.children.push(it);
      bundle.totalPrice += Number(it.totalPrice ?? 0);
      if (Number(it.totalPrice ?? 0) > 0) {
        bundle.quantity += Number(it.quantity ?? 0);
      }
    } else {
      out.push({ kind: 'item', item: it });
    }
  }
  for (const row of out) {
    if (row.kind === 'bundle' && row.quantity === 0 && row.children.length > 0) {
      row.quantity = Number(row.children[0].quantity ?? 1);
    }
  }
  return out;
}

// Frozen outlet header captured on Order at create time (column added
// 2026-06-11). Legacy orders missing this fall back to the live
// `order.outlet` relation.
type OutletSnapshot = {
  name?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstNumber?: string | null;
  fssaiNumber?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
};

type Payment = {
  mode: string;
  amount: number | string;
  status: string;
};

type CouponUsage = {
  discountAmount: number | string;
  coupon?: { code?: string | null; name?: string | null } | null;
};

type RewardRedeem = {
  points: number;
  amountValue: number | string | null;
};

export type ReceiptOrder = {
  id: string;
  orderNumber: string;
  tokenNumber?: number | null;
  createdAt: string | Date;
  isParcel?: boolean;
  table?: { number?: string | null } | null;
  subtotal: number | string;
  taxAmount: number | string;
  sgstAmount?: number | string | null;
  cgstAmount?: number | string | null;
  parcelAmount?: number | string | null;
  discountAmount?: number | string | null;
  totalAmount: number | string;
  customer?: { name?: string | null; phone?: string | null } | null;
  staff?: { name?: string | null } | null;
  outletSnapshot?: OutletSnapshot | null;
  outlet?: {
    name?: string;
    address?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstNumber?: string | null;
    fssaiNumber?: string | null;
    phone?: string | null;
  } | null;
  items?: OrderItem[];
  payments?: Payment[];
  couponUsages?: CouponUsage[];
  rewardTransactions?: RewardRedeem[];
};

interface Props {
  order: ReceiptOrder;
  paperWidth?: string;
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card',
  WALLET: 'Wallet', NET_BANKING: 'Net Banking',
};

function paymentTotals(payments?: Payment[]) {
  const out: Record<string, number> = { CASH: 0, CARD: 0, UPI: 0, WALLET: 0, NET_BANKING: 0 };
  for (const p of payments || []) {
    if (p.status !== 'SUCCESS') continue;
    out[p.mode] = (out[p.mode] || 0) + Number(p.amount);
  }
  return out;
}

// Mask the leading 5 digits of a phone number. Anything shorter than 6
// digits stays unmodified — there's nothing meaningful to hide. Indian
// mobiles are 10 digits + optional country code; masking 5 leaves enough
// trailing digits for the customer to recognise their own number while
// protecting them from shoulder-surfing off a paper bill.
function maskMobile(phone?: string | null) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 5) return digits;
  return '*'.repeat(5) + digits.slice(5);
}

const ThermalReceipt = forwardRef<HTMLDivElement, Props>(function ThermalReceipt({ order, paperWidth = '80mm' }, ref) {
  const items = order.items || [];
  // Collapse expanded bundle children for the customer-facing bill.
  const grouped = groupBundles(items);
  const totalItemCount = grouped.length;
  const totalQty = grouped.reduce((s, r) => {
    if (r.kind === 'bundle') return s + r.quantity;
    return s + Number(r.item.quantity);
  }, 0);
  const subtotal = Number(order.subtotal);
  const parcel = Number(order.parcelAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount);
  const taxAmount = Number(order.taxAmount);

  // Group OrderItems by GST rate so mixed-rate carts (food at 5% +
  // beverages at 18%, AC section at 9% vs non-AC at 5%, etc.) print
  // one CGST + SGST row per slab on the bill.
  // OrderItem.gstRate was snapshotted at order creation under the
  // TableType > CustomerTag > Item.gstRate > outlet default precedence,
  // so this single grouping handles every override flavour transparently.
  const taxGroups = (() => {
    const map = new Map<string, { rate: number; base: number; gstAmount: number }>();
    for (const it of items) {
      const rate = Math.round(Number(it.gstRate ?? 0) * 100) / 100;
      if (rate <= 0) continue;
      const base = Number(it.totalPrice ?? 0);
      const gst = Number(it.gstAmount ?? (base * rate) / 100);
      const key = rate.toFixed(2);
      const entry = map.get(key) || { rate, base: 0, gstAmount: 0 };
      entry.base += base;
      entry.gstAmount += gst;
      map.set(key, entry);
    }
    const rows = Array.from(map.values()).sort((a, b) => a.rate - b.rate);
    const sumGroupGst = rows.reduce((s, g) => s + g.gstAmount, 0);
    if (sumGroupGst > 0 && taxAmount > 0 && Math.abs(taxAmount - sumGroupGst) > 0.01) {
      const ratio = taxAmount / sumGroupGst;
      for (const g of rows) g.gstAmount = g.gstAmount * ratio;
    }
    return rows;
  })();
  // Inter-state detection (CGST/SGST=0 but tax>0). Drives label per group.
  const isIgst = (Number(order.sgstAmount ?? 0) === 0)
    && (Number(order.cgstAmount ?? 0) === 0)
    && taxAmount > 0;
  // Two decimals on every printed GST rate so half-rates like 2.5%
  // never get rounded up to 3%, matching Indian GST receipt convention.
  const fmtPct = (n: number) => Number.isFinite(n) && n > 0 ? n.toFixed(2) : '0.00';

  // Discount breakdown — line per coupon / reward, then the leftover as
  // a single auto-discount line. Same logic the previous layout used.
  const couponLines = (order.couponUsages || []).map((cu) => ({
    label: cu.coupon?.code ? `Coupon (${cu.coupon.code})` : 'Coupon',
    amount: Number(cu.discountAmount),
  })).filter((c) => c.amount > 0);
  const rewardLines = (order.rewardTransactions || []).map((rt) => ({
    label: `Reward points (${Math.abs(rt.points)} pts)`,
    amount: Number(rt.amountValue || 0),
  })).filter((r) => r.amount > 0);
  const explicitDiscount = couponLines.reduce((s, c) => s + c.amount, 0)
    + rewardLines.reduce((s, r) => s + r.amount, 0);
  const autoDiscount = Math.max(0, discount - explicitDiscount);

  const placedAt = dayjs(order.createdAt);
  // Prefer the frozen header so a historical reprint stays accurate even
  // after the outlet moves or updates its compliance numbers.
  const outletHeader: OutletSnapshot = order.outletSnapshot || order.outlet || {};
  const streetLines = [outletHeader.addressLine1, outletHeader.addressLine2].filter(Boolean) as string[];
  if (streetLines.length === 0 && outletHeader.address) streetLines.push(outletHeader.address);
  const cityLine = [outletHeader.city, outletHeader.state, outletHeader.pincode].filter(Boolean).join(', ');
  const counterLabel = order.isParcel
    ? 'PARCEL'
    : order.table?.number
      ? `T-${order.table.number}`
      : 'SERVE';
  const pay = paymentTotals(order.payments);
  const maskedMobile = maskMobile(order.customer?.phone);

  return (
    <div
      ref={ref}
      className="thermal-receipt"
      style={{
        width: paperWidth,
        maxWidth: '100%',
        padding: '8mm 6mm',
        background: '#fff',
        color: '#000',
        fontFamily: '"Courier New", "Menlo", monospace',
        fontSize: '12px',
        lineHeight: 1.5,
        boxSizing: 'border-box',
        margin: '0 auto',
      }}
    >
      {/* Print-time stylesheet: let the browser use the printer's native
          paper size so 58/76/80mm rolls all work. */}
      <style>{`
        @media print {
          @page { size: auto; margin: 0; }
          html, body { margin: 0; padding: 0; }
          .thermal-receipt {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: 0.5, lineHeight: 1.3 }}>
          {(outletHeader.name || 'Outlet').toUpperCase()}
        </p>
        {streetLines.map((line, i) => (
          <p key={i} style={{ margin: '3px 0 0', fontSize: 11.5 }}>{line}</p>
        ))}
        {cityLine && <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>{cityLine}</p>}
        {outletHeader.gstNumber && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>GST NO. {outletHeader.gstNumber}</p>
        )}
        {outletHeader.phone && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>Phone : {outletHeader.phone}</p>
        )}
        {outletHeader.fssaiNumber && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>FSSAI : {outletHeader.fssaiNumber}</p>
        )}
      </div>

      <Divider />

      {/* ── Customer block ─────────────────────────────────────── */}
      <KV label="Customer Name" value={order.customer?.name || ''} />
      {maskedMobile && <KV label="Customer Mob" value={maskedMobile} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 8, rowGap: 2, marginTop: 4 }}>
        <KV label="Bill No" value={order.orderNumber} compact />
        <KV label="Bill Date" value={placedAt.format('DD/MM/YY')} compact />
        <KV label="Cashier" value={order.staff?.name || 'Self'} compact />
        <KV label="Bill time" value={placedAt.format('hh:mm A')} compact />
        {order.tokenNumber != null && (
          <KV label="Token" value={`#${order.tokenNumber}`} compact />
        )}
        <KV label="Counter" value={counterLabel} compact />
      </div>

      <Divider />

      {/* ── Items table ────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px', gap: 6,
        fontWeight: 700, paddingBottom: 4,
      }}>
        <span>Item Name</span>
        <span style={{ textAlign: 'right' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Rate</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>
      <Divider thin />
      {grouped.map((row) => {
        if (row.kind === 'bundle') {
          const rate = row.quantity > 0 ? row.totalPrice / row.quantity : row.totalPrice;
          return (
            <div key={`b-${row.bundleId}`} style={{ padding: '4px 0', borderBottom: '1px dotted #ccc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px', gap: 6 }}>
                <div style={{ wordBreak: 'break-word', textTransform: 'uppercase', fontWeight: 700 }}>
                  {row.name}
                </div>
                <span style={{ textAlign: 'right' }}>{row.quantity}</span>
                <span style={{ textAlign: 'right' }}>{rate.toFixed(0)}</span>
                <span style={{ textAlign: 'right' }}>{row.totalPrice.toFixed(0)}</span>
              </div>
              {row.children.map((c) => {
                const childLabel = c.itemNameSnapshot || c.item?.name || 'Item';
                const childVariant = c.variantNameSnapshot || c.variant?.name;
                return (
                  <div key={c.id} style={{ fontSize: 10.5, color: '#444', marginLeft: 12, lineHeight: 1.4 }}>
                    • {childLabel}{childVariant ? ` (${childVariant})` : ''} × {c.quantity}
                  </div>
                );
              })}
            </div>
          );
        }
        const it = row.item;
        const hsn = it.item?.hsnCode;
        const itemLabel = it.itemNameSnapshot || it.item?.name || 'Item';
        const variantLabel = it.variantNameSnapshot || it.variant?.name;
        return (
          <div key={it.id} style={{ padding: '4px 0', borderBottom: '1px dotted #ccc' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px', gap: 6 }}>
              <div style={{ wordBreak: 'break-word', textTransform: 'uppercase' }}>
                {itemLabel}{variantLabel ? ` (${variantLabel})` : ''}
                {it.notes && (
                  <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic', textTransform: 'none' }}>
                    {it.notes}
                  </div>
                )}
              </div>
              <span style={{ textAlign: 'right' }}>{it.quantity}</span>
              <span style={{ textAlign: 'right' }}>{Number(it.unitPrice).toFixed(0)}</span>
              <span style={{ textAlign: 'right' }}>{Number(it.totalPrice).toFixed(0)}</span>
            </div>
            {hsn && (
              <div style={{ fontSize: 10, color: '#444', marginLeft: 4 }}>HSN&nbsp;&nbsp;{hsn}</div>
            )}
          </div>
        );
      })}

      <Divider />

      {/* ── Bill calculation ─────────────────────────────────────── */}
      {/* Sub Total → discount lines (each coupon / reward / leftover
          auto-discount on its own row, negative) → parcel → GST →
          Grand Total. A "You saved ₹X" footer makes the savings
          jump out so the customer sees exactly what the promo did. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>Tot Items : <strong>{totalItemCount}</strong></span>
        <span>Tot Qty : <strong>{totalQty}</strong></span>
      </div>
      <Row label="Sub Total" value={subtotal.toFixed(2)} />
      {couponLines.map((c, i) => (
        <Row key={`c-${i}`} label={c.label} value={`− ${c.amount.toFixed(2)}`} />
      ))}
      {rewardLines.map((r, i) => (
        <Row key={`r-${i}`} label={r.label} value={`− ${r.amount.toFixed(2)}`} />
      ))}
      {autoDiscount > 0 && (
        <Row
          label={explicitDiscount > 0 ? 'Other discount' : 'Discount'}
          value={`− ${autoDiscount.toFixed(2)}`}
        />
      )}
      {parcel > 0 && <Row label="Parcel charge" value={parcel.toFixed(2)} />}
      {taxAmount > 0 && <Row label="GST (CGST + SGST)" value={taxAmount.toFixed(2)} />}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontWeight: 900, fontSize: 15, marginTop: 4, paddingTop: 4,
        borderTop: '1px solid #000',
      }}>
        <span>Grand Total</span>
        <span>₹{total.toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div style={{
          textAlign: 'center', marginTop: 4, fontSize: 12, fontWeight: 700,
          color: '#0a7a3f',
        }}>
          You saved ₹{discount.toFixed(2)} on this bill
        </div>
      )}

      <Divider />

      {/* ── Payment Summary ────────────────────────────────────── */}
      <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline' }}>Payment Summary</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 8, rowGap: 2, marginTop: 2 }}>
        <KV label="Cash" value={pay.CASH.toFixed(0)} compact />
        <KV label="Card" value={pay.CARD.toFixed(0)} compact />
        <KV label="Change" value="0" compact />
        <KV label="UPI" value={pay.UPI.toFixed(0)} compact />
      </div>

      <Divider />

      {/* ── Tax Summary ────────────────────────────────────────── */}
      {/* One row per unique GST rate. Multi-rate carts (e.g. food at 5%
          + beverages at 18%, or items billed at an AC section's higher
          rate alongside non-AC items) print every slab on its own line.
          Header columns swap to IGST for inter-state orders. */}
      <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline' }}>Tax Summary</p>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr',
        gap: 2, fontSize: 10, marginTop: 2,
      }}>
        <span>{isIgst ? 'IGST%' : 'CGST%'}</span>
        <span style={{ textAlign: 'right' }}>{isIgst ? 'IGSTAMT' : 'CGSTAMT'}</span>
        <span style={{ textAlign: 'right' }}>{isIgst ? '' : 'SGST%'}</span>
        <span style={{ textAlign: 'right' }}>{isIgst ? '' : 'SGSTAMT'}</span>
        <span style={{ textAlign: 'right' }}>TAX%</span>
        <span style={{ textAlign: 'right' }}>TTA</span>
        {taxGroups.length === 0 ? (
          <FragmentRow cgstPct="0" cgstAmt="0.00" sgstPct="0" sgstAmt="0.00" taxPct="0" tta="0.00" />
        ) : taxGroups.map((g) => (
          isIgst ? (
            <FragmentRow key={g.rate.toFixed(2)}
              cgstPct={fmtPct(g.rate)}
              cgstAmt={g.gstAmount.toFixed(2)}
              sgstPct=""
              sgstAmt=""
              taxPct={fmtPct(g.rate)}
              tta={g.gstAmount.toFixed(2)}
            />
          ) : (
            <FragmentRow key={g.rate.toFixed(2)}
              cgstPct={fmtPct(g.rate / 2)}
              cgstAmt={(g.gstAmount / 2).toFixed(2)}
              sgstPct={fmtPct(g.rate / 2)}
              sgstAmt={(g.gstAmount / 2).toFixed(2)}
              taxPct={fmtPct(g.rate)}
              tta={g.gstAmount.toFixed(2)}
            />
          )
        ))}
      </div>

      <Divider />

      <div style={{ textAlign: 'center', marginTop: 4, fontWeight: 700, fontSize: 12 }}>
        Thank you &amp; Visit again
      </div>
    </div>
  );
});

export default ThermalReceipt;

/* ── helpers ────────────────────────────────────────────── */
function Divider({ thin }: { thin?: boolean }) {
  return (
    <div style={{
      borderTop: `1px ${thin ? 'dashed' : 'solid'} #000`,
      margin: thin ? '6px 0' : '8px 0',
    }} />
  );
}

function KV({ label, value, compact }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: compact ? 11 : 11.5 }}>
      <span>{label} :</span>
      <span style={{ fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>{value || ' '}</span>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 8,
      padding: '2px 0',
      fontWeight: bold ? 700 : undefined,
    }}>
      <span>{label}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value || ' '}</span>
    </div>
  );
}

// One Tax-Summary "row" rendered as six cells in the parent grid.
// Wrapped in a Fragment so multiple groups (one per GST rate) stack
// vertically inside the same 6-column grid.
function FragmentRow(props: {
  cgstPct: string; cgstAmt: string;
  sgstPct: string; sgstAmt: string;
  taxPct: string;  tta: string;
}) {
  return (
    <>
      <span>{props.cgstPct}</span>
      <span style={{ textAlign: 'right' }}>{props.cgstAmt}</span>
      <span style={{ textAlign: 'right' }}>{props.sgstPct}</span>
      <span style={{ textAlign: 'right' }}>{props.sgstAmt}</span>
      <span style={{ textAlign: 'right' }}>{props.taxPct}</span>
      <span style={{ textAlign: 'right' }}>{props.tta}</span>
    </>
  );
}
