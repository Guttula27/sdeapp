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
  notes?: string | null;
  item?: { name?: string; hsnCode?: string | null } | null;
  variant?: { name?: string } | null;
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
  const sgst = Number(order.sgstAmount ?? Number(order.taxAmount) / 2);
  const cgst = Number(order.cgstAmount ?? Number(order.taxAmount) / 2);
  const total = Number(order.totalAmount);
  const taxAmount = Number(order.taxAmount);

  // Derive the GST % labels the customer sees next to each tax line.
  // Taxable base = subtotal − discount (subtotal is already net of line
  // discounts post-cutover). Falls back to the order's first item rate
  // when the math doesn't divide cleanly (legacy orders).
  const taxable = Math.max(0, subtotal - Number(order.discountAmount || 0));
  const firstItemRate = Number(items[0]?.gstRate ?? 0);
  const totalGstPct = taxable > 0
    ? Math.round(((taxAmount / taxable) * 100) * 100) / 100
    : firstItemRate;
  const halfGstPct = Math.round((totalGstPct / 2) * 100) / 100;
  const fmtPct = (n: number) => Number.isFinite(n) && n > 0
    ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''))
    : '0';

  const placedAt = dayjs(order.createdAt);
  const streetLines = [order.outlet?.addressLine1, order.outlet?.addressLine2].filter(Boolean) as string[];
  if (streetLines.length === 0 && order.outlet?.address) streetLines.push(order.outlet.address);
  const cityLine = [order.outlet?.city, order.outlet?.state, order.outlet?.pincode].filter(Boolean).join(', ');
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
          {(order.outlet?.name || 'Outlet').toUpperCase()}
        </p>
        {streetLines.map((line, i) => (
          <p key={i} style={{ margin: '2px 0 0', fontSize: 11 }}>{line}</p>
        ))}
        {cityLine && <p style={{ margin: '2px 0 0', fontSize: 11 }}>{cityLine}</p>}
        {order.outlet?.gstNumber && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>GST NO. {order.outlet.gstNumber}</p>
        )}
        {order.outlet?.phone && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>Phone : {order.outlet.phone}</p>
        )}
        {order.outlet?.fssaiNumber && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>FSSAI : {order.outlet.fssaiNumber}</p>
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
        return (
          <div key={it.id} style={{ marginTop: 3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 50px', gap: 4 }}>
              <span style={{ wordBreak: 'break-word', textTransform: 'uppercase' }}>
                {it.item?.name || 'Item'}{it.variant?.name ? ` (${it.variant.name})` : ''}
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
        <span>{fmtPct(halfGstPct)}</span>
        <span style={{ textAlign: 'right' }}>{cgst.toFixed(2)}</span>
        <span style={{ textAlign: 'right' }}>{fmtPct(halfGstPct)}</span>
        <span style={{ textAlign: 'right' }}>{sgst.toFixed(2)}</span>
        <span style={{ textAlign: 'right' }}>{fmtPct(totalGstPct)}</span>
        <span style={{ textAlign: 'right' }}>{taxAmount.toFixed(2)}</span>
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
