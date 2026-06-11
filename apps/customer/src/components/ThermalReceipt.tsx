import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Thermal-style receipt — rendered at ~80mm width so html2pdf can
 * rasterise it into a PDF that prints 1:1 on a real thermal printer.
 *
 * Layout follows the "VEZEOR Olive-Mithai-Shop" format used by the
 * franchise: centered header block, customer block (with masked phone),
 * items table, totals, Payment Summary, Tax Summary, footer.
 *
 * The component is data-driven — missing fields collapse out of the
 * layout (e.g. customer phone, cashier, parcel charge).
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
  // Frozen names captured at order-creation. Prefer these so a reprint
  // shows the name the customer actually ordered even after the menu
  // item has been renamed or deleted; fall back to the live relation
  // for legacy rows from before the snapshot column existed.
  itemNameSnapshot?: string | null;
  variantNameSnapshot?: string | null;
  item?: { name?: string; hsnCode?: string | null } | null;
  variant?: { name?: string } | null;
};

// Frozen outlet header — populated on every Order from 2026-06-11 on.
// Falls back to the live `order.outlet` relation when null (legacy
// orders) so historical receipts still print.
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
};

interface Props {
  order: ReceiptOrder;
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card',
  WALLET: 'Wallet', NET_BANKING: 'Net Banking',
};

// Sum successful payments by mode so the Payment Summary block shows a
// row per channel (Cash / Card / UPI). Modes the bill didn't use stay
// at 0 so the customer can see at a glance how everything was settled.
function paymentTotals(payments?: Payment[]) {
  const out: Record<string, number> = { CASH: 0, CARD: 0, UPI: 0, WALLET: 0, NET_BANKING: 0 };
  for (const p of payments || []) {
    if (p.status !== 'SUCCESS') continue;
    out[p.mode] = (out[p.mode] || 0) + Number(p.amount);
  }
  return out;
}

// Replace every digit except the trailing 8 with asterisks. Phones in
// India are 10 digits + optional country code; we hide the first 5
// regardless of total length so VIPs / staff numbers don't get
// shoulder-surfed off a paper bill.
function maskMobile(phone?: string | null) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 5) return digits;
  return '*'.repeat(5) + digits.slice(5);
}

const ThermalReceipt = forwardRef<HTMLDivElement, Props>(function ThermalReceipt({ order }, ref) {
  const items = order.items || [];
  const totalQty = items.reduce((s, it) => s + Number(it.quantity), 0);
  const subtotal = Number(order.subtotal);
  const total = Number(order.totalAmount);
  const taxAmount = Number(order.taxAmount);

  // Per-item GST grouping. Items with a non-null Item.gstRate get their
  // own rate; the rest fall back to outlet default (already baked into
  // the OrderItem.gstRate at order time by resolveOrderItems). When the
  // cart mixes rates (food at 5% + beverages at 18%) the receipt prints
  // one CGST + SGST row per rate so the customer sees the breakdown.
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
    // If discounts shifted the order's stored taxAmount away from the sum
    // of per-line gst, scale every group proportionally so the printed
    // tax lines still sum to the actual amount the customer paid.
    const sumGroupGst = rows.reduce((s, g) => s + g.gstAmount, 0);
    if (sumGroupGst > 0 && taxAmount > 0 && Math.abs(taxAmount - sumGroupGst) > 0.01) {
      const ratio = taxAmount / sumGroupGst;
      for (const g of rows) g.gstAmount = g.gstAmount * ratio;
    }
    return rows;
  })();
  const fmtPct = (n: number) => Number.isFinite(n) && n > 0
    ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''))
    : '0';

  const placedAt = dayjs(order.createdAt);
  // Prefer the frozen outletSnapshot when present so a historical
  // reprint shows the address / GSTIN / FSSAI that were in effect when
  // the customer was billed. Live outlet relation is the legacy fallback.
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
        width: '80mm',
        padding: '6mm 5mm',
        background: '#fff',
        color: '#000',
        fontFamily: '"Courier New", "Menlo", monospace',
        fontSize: '11.5px',
        lineHeight: 1.4,
        boxSizing: 'border-box',
      }}
    >
      {/* ── Header (centered) ──────────────────────────────────── */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 800, fontSize: 14, margin: 0, letterSpacing: 0.5 }}>
          {(outletHeader.name || 'Outlet').toUpperCase()}
        </p>
        {streetLines.map((line, i) => (
          <p key={i} style={{ margin: '2px 0 0', fontSize: 11 }}>{line}</p>
        ))}
        {cityLine && <p style={{ margin: '2px 0 0', fontSize: 11 }}>{cityLine}</p>}
        {outletHeader.gstNumber && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>GST NO. {outletHeader.gstNumber}</p>
        )}
        {outletHeader.phone && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>Phone : {outletHeader.phone}</p>
        )}
        {outletHeader.fssaiNumber && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>FSSAI : {outletHeader.fssaiNumber}</p>
        )}
      </div>

      <Divider />

      {/* ── Customer block ─────────────────────────────────────── */}
      <KV label="Customer Name" value={order.customer?.name || ''} />
      {maskedMobile && <KV label="Customer Mob" value={maskedMobile} />}

      {/* ── Bill meta (2-column) ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
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
        display: 'grid', gridTemplateColumns: '1fr 32px 44px 50px', gap: 4,
        fontWeight: 700, paddingBottom: 2,
      }}>
        <span>Item Name</span>
        <span style={{ textAlign: 'right' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Rate</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>
      <Divider thin />
      {items.map((it) => {
        const hsn = it.item?.hsnCode;
        // Prefer the frozen names — they reflect what the customer
        // actually saw and ordered, even after a later rename.
        const itemLabel = it.itemNameSnapshot || it.item?.name || 'Item';
        const variantLabel = it.variantNameSnapshot || it.variant?.name;
        return (
          <div key={it.id} style={{ marginTop: 3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 50px', gap: 4 }}>
              <span style={{ wordBreak: 'break-word', textTransform: 'uppercase' }}>
                {itemLabel}{variantLabel ? ` (${variantLabel})` : ''}
              </span>
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

      {/* ── Totals row ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>Tot Items : <strong>{items.length}</strong></span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span>Tot Qty &nbsp;: <strong>{totalQty}</strong></span>
        <span style={{ fontWeight: 900, fontSize: 14 }}>Total : {total.toFixed(0)}</span>
      </div>

      <Divider />

      {/* ── Payment Summary ────────────────────────────────────── */}
      <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline' }}>Payment Summary</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 2 }}>
        <KV label="Cash" value={pay.CASH.toFixed(0)} compact />
        <KV label="Card" value={pay.CARD.toFixed(0)} compact />
        <KV label="Change" value="0" compact />
        <KV label="UPI" value={pay.UPI.toFixed(0)} compact />
      </div>

      <Divider />

      {/* ── Tax Summary ────────────────────────────────────────── */}
      {/* One row per unique GST rate so mixed-rate carts (e.g. food at
          5% + beverages at 18%, or items billed under an AC section's
          rate) show each slab on its own line. Falls back to a zero
          line when the order had no taxable items. */}
      <p style={{ margin: 0, fontWeight: 700, textDecoration: 'underline' }}>Tax Summary</p>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr',
        gap: 2, fontSize: 10, marginTop: 2,
      }}>
        <span>CGST%</span>
        <span style={{ textAlign: 'right' }}>CGSTAMT</span>
        <span style={{ textAlign: 'right' }}>SGST%</span>
        <span style={{ textAlign: 'right' }}>SGSTAMT</span>
        <span style={{ textAlign: 'right' }}>TAX%</span>
        <span style={{ textAlign: 'right' }}>TTA</span>
        {taxGroups.length === 0 ? (
          <>
            <span>0</span>
            <span style={{ textAlign: 'right' }}>0.00</span>
            <span style={{ textAlign: 'right' }}>0</span>
            <span style={{ textAlign: 'right' }}>0.00</span>
            <span style={{ textAlign: 'right' }}>0</span>
            <span style={{ textAlign: 'right' }}>0.00</span>
          </>
        ) : taxGroups.map((g) => (
          <FragmentRow key={g.rate.toFixed(2)}
            cgstPct={fmtPct(g.rate / 2)}
            cgstAmt={(g.gstAmount / 2).toFixed(2)}
            sgstPct={fmtPct(g.rate / 2)}
            sgstAmt={(g.gstAmount / 2).toFixed(2)}
            taxPct={fmtPct(g.rate)}
            tta={g.gstAmount.toFixed(2)}
          />
        ))}
      </div>

      <Divider />

      <div style={{ textAlign: 'center', marginTop: 4, fontWeight: 700 }}>
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
      margin: '4px 0',
    }} />
  );
}

// One Tax-Summary "row" rendered as six cells in the parent grid.
// Wrapped in a Fragment so multiple groups (multiple GST rates) stack
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

// "Label : value" with the colon aligned. `compact` shrinks the gap so
// two pairs sit comfortably in one row of a 2-column grid.
function KV({ label, value, compact }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: compact ? 4 : 8, fontSize: compact ? 11 : 11.5 }}>
      <span>{label}{compact ? ' :' : ' :'}</span>
      <span style={{ fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>{value || ' '}</span>
    </div>
  );
}
