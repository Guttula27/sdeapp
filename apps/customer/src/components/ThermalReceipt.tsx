import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Thermal-style receipt that mirrors the printed Raasa Cafe format.
 * Rendered at ~80mm width so html2pdf can rasterise it into a narrow PDF
 * that prints 1:1 on a real thermal printer too.
 *
 * The component is data-driven: any field on `order` that's missing simply
 * collapses out of the layout (e.g. customer name, cashier).
 */

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  notes?: string | null;
  item?: { name?: string } | null;
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
  customer?: { name?: string | null } | null;
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

function formatPaidVia(payments?: Payment[]) {
  const success = (payments || []).filter((p) => p.status === 'SUCCESS');
  if (!success.length) return 'Pending';
  const modes = Array.from(new Set(success.map((p) => PAYMENT_LABEL[p.mode] || p.mode)));
  // The printed receipt uses the format "Other [UPI]" — keep that shape so
  // the layout matches even when the gateway label is generic.
  return modes.length === 1 ? `Other [${modes[0]}]` : modes.join(' + ');
}

function orderType(o: ReceiptOrder) {
  if (o.isParcel) return { label: 'Parcel', value: '1' };
  if (o.table?.number) return { label: 'Dine In', value: String(o.table.number) };
  return { label: 'Counter', value: '1' };
}

const ThermalReceipt = forwardRef<HTMLDivElement, Props>(function ThermalReceipt({ order }, ref) {
  const totalQty = (order.items || []).reduce((s, it) => s + Number(it.quantity), 0);
  const subtotal = Number(order.subtotal);
  const sgst = Number(order.sgstAmount ?? Number(order.taxAmount) / 2);
  const cgst = Number(order.cgstAmount ?? Number(order.taxAmount) / 2);
  const total = Number(order.totalAmount);
  const exact = subtotal + sgst + cgst + Number(order.parcelAmount || 0) - Number(order.discountAmount || 0);
  const roundOff = Math.round((total - exact) * 100) / 100;

  const ot = orderType(order);
  const placedAt = dayjs(order.createdAt);
  const address = [order.outlet?.addressLine1, order.outlet?.addressLine2, order.outlet?.address]
    .filter(Boolean)
    .join(', ');
  const cityLine = [order.outlet?.city, order.outlet?.state, order.outlet?.pincode]
    .filter(Boolean)
    .join(' ');

  // Derive a GST rate label like "2.5%" from the actual tax + subtotal. Falls
  // back to whatever's on the order if the math doesn't divide cleanly.
  const gstPct = subtotal > 0
    ? +(((sgst + cgst) / subtotal) * 100).toFixed(2)
    : 0;
  const halfPct = (gstPct / 2).toFixed(gstPct % 1 === 0 ? 0 : 1);

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
        lineHeight: 1.35,
        boxSizing: 'border-box',
      }}
    >
      {/* Outlet header */}
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <p style={{ fontWeight: 800, fontSize: 14, margin: 0, letterSpacing: 0.5 }}>
          {(order.outlet?.name || 'Outlet').toUpperCase()}
        </p>
        {address && <p style={{ margin: '2px 0 0', fontSize: 11 }}>{address}</p>}
        {cityLine && <p style={{ margin: '2px 0 0', fontSize: 11 }}>{cityLine}</p>}
        {order.outlet?.gstNumber && (
          <p style={{ margin: '2px 0 0', fontSize: 11 }}>GSTIN: {order.outlet.gstNumber}</p>
        )}
      </div>

      <Divider />

      {/* Customer name */}
      <Row label="Name:" value={order.customer?.name || ''} underline />

      <Divider />

      {/* Date / type */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>Date: {placedAt.format('DD/MM/YY')}</span>
        <span style={{ fontWeight: 700 }}>{ot.label}: {ot.value}</span>
      </div>
      <div>{placedAt.format('HH:mm')}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>Cashier: {order.staff?.name || 'Self'}</span>
        <span>Bill No.: {order.orderNumber}</span>
      </div>
      <div style={{ fontWeight: 800 }}>Token No.: {order.tokenNumber ?? '-'}</div>

      <Divider />

      {/* Items table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 38px 50px', gap: 4 }}>
        <span style={{ fontWeight: 700 }}>Item</span>
        <span style={{ fontWeight: 700, textAlign: 'right' }}>Qty.</span>
        <span style={{ fontWeight: 700, textAlign: 'right' }}>Price</span>
        <span style={{ fontWeight: 700, textAlign: 'right' }}>Amount</span>
      </div>

      <Divider thin />

      {/* Group items by menu (Breakfast / Lunch / …). When the order spans a
          single menu — or the business doesn't run multiple menus — the
          group header is hidden so the receipt looks identical to before. */}
      {(() => {
        const items = order.items || [];
        const groups = new Map<string, { name: string; items: typeof items }>();
        for (const it of items) {
          const key = (it as any).menu?.id || (it as any).menuId || '__none__';
          const name = (it as any).menu?.name || '';
          if (!groups.has(key)) groups.set(key, { name, items: [] });
          groups.get(key)!.items.push(it);
        }
        const showHeaders = groups.size > 1;
        return Array.from(groups.values()).map((g, gi) => (
          <div key={g.name || `g-${gi}`}>
            {showHeaders && g.name && (
              <div style={{ fontWeight: 700, padding: '4px 0 2px', textTransform: 'uppercase', fontSize: 11 }}>
                {g.name}
              </div>
            )}
            {g.items.map((it) => (
              <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 38px 50px', gap: 4, padding: '2px 0' }}>
                <span style={{ wordBreak: 'break-word' }}>
                  {it.item?.name || 'Item'}
                  {it.variant?.name ? ` (${it.variant.name})` : ''}
                </span>
                <span style={{ textAlign: 'right' }}>{it.quantity}</span>
                <span style={{ textAlign: 'right' }}>{Number(it.unitPrice).toFixed(0)}</span>
                <span style={{ textAlign: 'right' }}>{Number(it.totalPrice).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ));
      })()}

      <Divider />

      {/* Totals block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>Total Qty: {totalQty}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ marginRight: 8 }}>Sub Total</span>
          <span style={{ display: 'inline-block', minWidth: 60, textAlign: 'right' }}>
            {subtotal.toFixed(2)}
          </span>
        </div>
      </div>
      {(cgst > 0 || sgst > 0) && (
        <>
          <Row label={`CGST ${halfPct}%`} value={cgst.toFixed(2)} mono />
          <Row label={`SGST ${halfPct}%`} value={sgst.toFixed(2)} mono />
        </>
      )}
      {Number(order.parcelAmount || 0) > 0 && (
        <Row label="Parcel" value={Number(order.parcelAmount).toFixed(2)} mono />
      )}
      {Number(order.discountAmount || 0) > 0 && (
        <Row label="Discount" value={`-${Number(order.discountAmount).toFixed(2)}`} mono />
      )}

      <Divider />

      {roundOff !== 0 && (
        <Row label="Round off" value={(roundOff >= 0 ? '' : '-') + Math.abs(roundOff).toFixed(2)} mono />
      )}

      {/* Grand total — emphasised */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 14, fontWeight: 900, marginTop: 4,
      }}>
        <span>Grand Total</span>
        <span>₹{total.toFixed(2)}</span>
      </div>

      <div style={{ marginTop: 6 }}>Paid via {formatPaidVia(order.payments)}</div>

      <Divider />

      <div style={{ textAlign: 'center', marginTop: 4, fontWeight: 700 }}>
        Thank You Visit Again..!!
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

function Row({ label, value, underline, mono }: {
  label: string; value: string | number; underline?: boolean; mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 8,
      borderBottom: underline ? '1px solid #000' : undefined,
      paddingBottom: underline ? 2 : 0,
    }}>
      <span>{label}</span>
      <span style={{
        minWidth: mono ? 60 : undefined,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>{value || ' '}</span>
    </div>
  );
}
