import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Thermal-style receipt — designed to render at ~80mm width so html2pdf
 * can rasterise it for a thermal printer (or download as PDF).
 *
 * Layout rules:
 *   - Outlet header: each address element on its own line, generous
 *     line-height. GST number rendered with a labelled prefix.
 *   - Dividers (horizontal rules): always with ≥8px of vertical space
 *     above and below so the receipt doesn't look cramped.
 *   - Items list: each row gets a fixed minimum height + padding so
 *     the columns line up visually even on short receipts.
 *   - Totals block: subtotal, then any deductions listed individually
 *     (coupon, reward, auto-discount fallback), then the taxable line,
 *     then GST split, then grand total. GST is computed on the
 *     *taxable* (post-discount) amount so the math reads as "discount
 *     first, then tax" — the receipt may show a small round-off line
 *     if the stored taxAmount was computed differently.
 */

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  gstRate?: number | string | null;
  notes?: string | null;
  item?: { name?: string } | null;
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
  couponUsages?: CouponUsage[];
  rewardTransactions?: RewardRedeem[];
};

interface Props {
  order: ReceiptOrder;
  /**
   * Thermal paper width. Defaults to 80mm — the most common roll size —
   * but accepts any CSS length so a 58mm or 76mm printer can re-render
   * the same component without surgery. The container also caps to
   * 100% of its parent so a preview inside a narrow modal scales down
   * gracefully. When printed via the browser's native print dialog,
   * the `@media print` block lets the page take the printer's actual
   * paper size instead of the screen-time width.
   */
  paperWidth?: string;
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card',
  WALLET: 'Wallet', NET_BANKING: 'Net Banking',
};

function formatPaidVia(payments?: Payment[]) {
  const success = (payments || []).filter((p) => p.status === 'SUCCESS');
  if (!success.length) return 'Pending';
  const modes = Array.from(new Set(success.map((p) => PAYMENT_LABEL[p.mode] || p.mode)));
  return modes.length === 1 ? modes[0] : modes.join(' + ');
}

function orderType(o: ReceiptOrder) {
  if (o.isParcel) return { label: 'Parcel', value: '1' };
  if (o.table?.number) return { label: 'Dine In', value: String(o.table.number) };
  return { label: 'Counter', value: '1' };
}

// Indian GST is intra-state (CGST+SGST, split evenly) or inter-state (IGST
// only). We treat any order whose stored cgstAmount is 0 but taxAmount > 0
// as inter-state and show IGST. Everything else is the standard split.
function gstSplit(taxAmount: number, cgst: number, sgst: number) {
  if (taxAmount <= 0) return { kind: 'none' as const };
  if (cgst === 0 && sgst === 0) return { kind: 'igst' as const, igst: taxAmount };
  if (cgst === 0 && sgst > 0) return { kind: 'igst' as const, igst: taxAmount };
  return { kind: 'cgst-sgst' as const, cgst, sgst };
}

// Pick a sensible single effective GST rate to label the breakdown
// ("CGST 2.5%" / "IGST 5%"). Derived from the stored taxAmount over the
// taxable base; falls back to the order's first item rate if math is off.
function effectiveRate(taxAmount: number, base: number, fallback: number) {
  if (base <= 0) return fallback;
  const pct = (taxAmount / base) * 100;
  return Number.isFinite(pct) ? pct : fallback;
}

const ThermalReceipt = forwardRef<HTMLDivElement, Props>(function ThermalReceipt({ order, paperWidth = '80mm' }, ref) {
  const totalQty = (order.items || []).reduce((s, it) => s + Number(it.quantity), 0);
  const subtotal = Number(order.subtotal);
  const parcel = Number(order.parcelAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount);
  const taxAmount = Number(order.taxAmount);
  const cgst = Number(order.cgstAmount ?? 0);
  const sgst = Number(order.sgstAmount ?? 0);

  // Taxable subtotal under the "discount before tax" model. From
  // 2026-06-09 the backend persists taxAmount + totalAmount computed
  // on this base, so the receipt math reconciles cleanly without a
  // forced round-off line. Pre-cutover orders still render correctly
  // — their stored taxAmount was on gross, the round-off line absorbs
  // the small gap so the customer's total matches what they paid.
  const taxable = Math.max(0, subtotal - discount);
  const firstItemRate = Number((order.items || [])[0]?.gstRate ?? 0);
  const rate = effectiveRate(taxAmount, taxable || subtotal, firstItemRate);
  const halfRateLabel = formatPct(rate / 2);
  const fullRateLabel = formatPct(rate);
  const split = gstSplit(taxAmount, cgst, sgst);

  // Round-off = (stored grand total) − (sum of components as displayed).
  // Should be ~0 for new orders post-cutover; non-zero only on legacy
  // orders persisted under the old gross-tax math. Renders as
  // "Round off  +0.02 / -0.05" when present.
  const componentsSum = taxable + parcel + taxAmount;
  const roundOff = Math.round((total - componentsSum) * 100) / 100;

  // Discount breakdown (coupon + reward + leftover auto-discount).
  // Receipts list each component individually; if neither exists we
  // fall back to a single "Discount" line so the older orders still
  // render correctly.
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

  const ot = orderType(order);
  const placedAt = dayjs(order.createdAt);

  // Address lines — each element on its own row. Street ('addressLine1'
  // + 'addressLine2') first, then city / state / pincode, then the
  // outlet phone if present. The legacy single-field 'address' is a
  // fallback for outlets that haven't filled the breakdown.
  const streetLines = [
    order.outlet?.addressLine1,
    order.outlet?.addressLine2,
  ].filter(Boolean) as string[];
  if (streetLines.length === 0 && order.outlet?.address) {
    streetLines.push(order.outlet.address);
  }
  const cityLine = [
    order.outlet?.city,
    order.outlet?.state,
    order.outlet?.pincode,
  ].filter(Boolean).join(', ');

  return (
    <div
      ref={ref}
      className="thermal-receipt"
      style={{
        // Auto-align to the configured paper width but cap at 100% so a
        // preview inside a narrower container shrinks instead of bleeding.
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
          paper size (so 58mm/76mm/80mm rolls all work) and drop any
          screen-time max-width so we get the full roll width. The
          `@page` size 'auto' is the right hint to the browser/driver. */}
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
      {/* ── Outlet header — one element per line, larger name ───── */}
      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontWeight: 800, fontSize: 16, margin: 0,
          letterSpacing: 0.5, lineHeight: 1.3,
        }}>
          {(order.outlet?.name || 'Outlet').toUpperCase()}
        </p>
        {streetLines.map((line, i) => (
          <p key={i} style={{ margin: '4px 0 0', fontSize: 11.5 }}>{line}</p>
        ))}
        {cityLine && (
          <p style={{ margin: '4px 0 0', fontSize: 11.5 }}>{cityLine}</p>
        )}
        {order.outlet?.phone && (
          <p style={{ margin: '4px 0 0', fontSize: 11.5 }}>Tel: {order.outlet.phone}</p>
        )}
        {order.outlet?.gstNumber && (
          <p style={{ margin: '6px 0 0', fontSize: 11.5, fontWeight: 700 }}>
            GSTIN: {order.outlet.gstNumber}
          </p>
        )}
      </div>

      <Divider />

      {/* ── Customer + bill meta ──────────────────────────────── */}
      {order.customer?.name && (
        <div style={{ marginBottom: 2 }}>
          <strong>Name: </strong>{order.customer.name}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
        <span>Date: {placedAt.format('DD/MM/YYYY HH:mm')}</span>
        <span style={{ fontWeight: 700 }}>{ot.label}: {ot.value}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
        <span>Cashier: {order.staff?.name || 'Self'}</span>
        <span>Bill No.: {order.orderNumber}</span>
      </div>
      {order.tokenNumber != null && (
        <div style={{ fontWeight: 800, marginTop: 4, textAlign: 'center', fontSize: 13 }}>
          Token #{order.tokenNumber}
        </div>
      )}

      <Divider />

      {/* ── Items header ─────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px', gap: 6,
        fontWeight: 700, paddingBottom: 4,
      }}>
        <span>Item</span>
        <span style={{ textAlign: 'right' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Rate</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>

      <Divider thin />

      {/* ── Items rows ───────────────────────────────────────── */}
      {(order.items || []).map((it) => (
        <div
          key={it.id}
          style={{
            display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px',
            gap: 6,
            padding: '6px 0',
            borderBottom: '1px dotted #ccc',
          }}
        >
          <div style={{ wordBreak: 'break-word' }}>
            <div>{it.item?.name || 'Item'}</div>
            {it.variant?.name && (
              <div style={{ fontSize: 10.5, color: '#444' }}>{it.variant.name}</div>
            )}
            {it.notes && (
              <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                {it.notes}
              </div>
            )}
          </div>
          <span style={{ textAlign: 'right' }}>{it.quantity}</span>
          <span style={{ textAlign: 'right' }}>{Number(it.unitPrice).toFixed(2)}</span>
          <span style={{ textAlign: 'right' }}>{Number(it.totalPrice).toFixed(2)}</span>
        </div>
      ))}

      <Divider />

      {/* ── Totals block ─────────────────────────────────────── */}
      <Row label={`Sub Total  (${totalQty} item${totalQty === 1 ? '' : 's'})`} value={subtotal.toFixed(2)} />

      {parcel > 0 && (
        <Row label="Parcel charge" value={parcel.toFixed(2)} />
      )}

      {/* Discounts: list each component individually if known, else
          fall back to the aggregate line. All negative-signed. */}
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

      {/* Taxable amount — only shown when there's actually a deduction.
          Otherwise subtotal IS the taxable amount and printing both is
          noise. */}
      {discount > 0 && (
        <>
          <Divider thin />
          <Row label="Taxable amount" value={taxable.toFixed(2)} bold />
        </>
      )}

      {/* GST split — CGST + SGST for intra-state, IGST for inter-state. */}
      {split.kind === 'cgst-sgst' && (
        <>
          <Row label={`CGST ${halfRateLabel}`} value={split.cgst.toFixed(2)} />
          <Row label={`SGST ${halfRateLabel}`} value={split.sgst.toFixed(2)} />
        </>
      )}
      {split.kind === 'igst' && (
        <Row label={`IGST ${fullRateLabel}`} value={split.igst.toFixed(2)} />
      )}

      {roundOff !== 0 && (
        <Row
          label="Round off"
          value={(roundOff >= 0 ? '+' : '-') + Math.abs(roundOff).toFixed(2)}
        />
      )}

      <Divider />

      {/* ── Grand total — emphasised ─────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 15, fontWeight: 900,
        padding: '4px 0',
      }}>
        <span>GRAND TOTAL</span>
        <span>₹{total.toFixed(2)}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        Paid via: <strong>{formatPaidVia(order.payments)}</strong>
      </div>

      <Divider />

      <div style={{
        textAlign: 'center', marginTop: 6,
        fontWeight: 700, fontSize: 12,
      }}>
        Thank you — visit again!
      </div>
    </div>
  );
});

export default ThermalReceipt;

/* ── helpers ────────────────────────────────────────────── */
function Divider({ thin }: { thin?: boolean }) {
  return (
    <div
      style={{
        borderTop: `1px ${thin ? 'dashed' : 'solid'} #000`,
        margin: thin ? '8px 0' : '10px 0',
      }}
    />
  );
}

function Row({ label, value, bold }: {
  label: string; value: string | number; bold?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 8,
      padding: '3px 0',
      fontWeight: bold ? 700 : undefined,
    }}>
      <span>{label}</span>
      <span style={{
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>{value || ' '}</span>
    </div>
  );
}

function formatPct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0%';
  return n % 1 === 0 ? `${n.toFixed(0)}%` : `${n.toFixed(1)}%`;
}
