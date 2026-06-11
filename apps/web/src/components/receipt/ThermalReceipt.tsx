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
  notes?: string | null;
  item?: { name?: string; hsnCode?: string | null } | null;
  variant?: { name?: string } | null;
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
  const totalQty = items.reduce((s, it) => s + Number(it.quantity), 0);
  const subtotal = Number(order.subtotal);
  const parcel = Number(order.parcelAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount);
  const taxAmount = Number(order.taxAmount);
  const cgst = Number(order.cgstAmount ?? taxAmount / 2);
  const sgst = Number(order.sgstAmount ?? taxAmount / 2);

  const taxable = Math.max(0, subtotal - discount);
  const firstItemRate = Number(items[0]?.gstRate ?? 0);
  const totalGstPct = taxable > 0
    ? Math.round(((taxAmount / taxable) * 100) * 100) / 100
    : firstItemRate;
  const halfGstPct = Math.round((totalGstPct / 2) * 100) / 100;
  const fmtPct = (n: number) => Number.isFinite(n) && n > 0
    ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''))
    : '0';

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
          {(order.outlet?.name || 'Outlet').toUpperCase()}
        </p>
        {streetLines.map((line, i) => (
          <p key={i} style={{ margin: '3px 0 0', fontSize: 11.5 }}>{line}</p>
        ))}
        {cityLine && <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>{cityLine}</p>}
        {order.outlet?.gstNumber && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>GST NO. {order.outlet.gstNumber}</p>
        )}
        {order.outlet?.phone && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>Phone : {order.outlet.phone}</p>
        )}
        {order.outlet?.fssaiNumber && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5 }}>FSSAI : {order.outlet.fssaiNumber}</p>
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
      {items.map((it) => {
        const hsn = it.item?.hsnCode;
        return (
          <div key={it.id} style={{ padding: '4px 0', borderBottom: '1px dotted #ccc' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px', gap: 6 }}>
              <div style={{ wordBreak: 'break-word', textTransform: 'uppercase' }}>
                {it.item?.name || 'Item'}{it.variant?.name ? ` (${it.variant.name})` : ''}
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

      {/* ── Totals + discounts + parcel ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>Tot Items : <strong>{items.length}</strong></span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span>Tot Qty &nbsp;: <strong>{totalQty}</strong></span>
        <span style={{ fontWeight: 900, fontSize: 15 }}>Total : {total.toFixed(0)}</span>
      </div>

      {(couponLines.length > 0 || rewardLines.length > 0 || autoDiscount > 0 || parcel > 0) && (
        <>
          <Divider thin />
          {parcel > 0 && <Row label="Parcel charge" value={parcel.toFixed(2)} />}
          {couponLines.map((c, i) => (
            <Row key={`c-${i}`} label={c.label} value={`-${c.amount.toFixed(2)}`} />
          ))}
          {rewardLines.map((r, i) => (
            <Row key={`r-${i}`} label={r.label} value={`-${r.amount.toFixed(2)}`} />
          ))}
          {autoDiscount > 0 && (
            <Row
              label={explicitDiscount > 0 ? 'Other discount' : 'Discount'}
              value={`-${autoDiscount.toFixed(2)}`}
            />
          )}
        </>
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
