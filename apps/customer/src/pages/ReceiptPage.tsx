import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Download, ChevronRight, Phone, MapPin } from 'lucide-react';
import api from '../services/api';
import dayjs from 'dayjs';
import ThermalReceipt from '../components/ThermalReceipt';
import { downloadReceiptPdf } from '../components/downloadReceiptPdf';

export default function ReceiptPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!receiptRef.current || !order) return;
    downloadReceiptPdf(receiptRef.current, `Receipt-${order.orderNumber}`);
  };

  useEffect(() => {
    if (!orderId) return;
    api.get(`/orders/${orderId}`)
      .then(({ data }) => setOrder(data.data))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }
  if (!order) return <p className="p-6 text-sm text-slate-500">Order not found.</p>;

  const payment = order.payments?.[0];
  const paid = payment?.status === 'SUCCESS';

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="max-w-md mx-auto bg-white min-h-dvh">
        {/* Header banner */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 pt-8 pb-6 text-center rounded-b-3xl shadow-lg">
          <CheckCircle2 size={42} className="mx-auto mb-2" />
          <p className="font-bold text-xl">Order placed</p>
          <p className="text-sm text-emerald-50 mt-0.5">
            Token <span className="font-black text-white">#{order.tokenNumber ?? '—'}</span>
          </p>
        </div>

        {/* Body — bill format */}
        <div className="px-5 py-5 space-y-4">
          {/* Outlet */}
          <div className="text-center border-b border-dashed border-slate-200 pb-4">
            {order.outlet?.logoUrl && (
              <img src={order.outlet.logoUrl} alt="" className="w-12 h-12 mx-auto rounded-xl object-contain bg-slate-50 p-1 mb-2" />
            )}
            <p className="text-base font-black text-slate-900">{order.outlet?.name}</p>
            {order.outlet?.address && (
              <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1">
                <MapPin size={10} /> {order.outlet.address}
              </p>
            )}
            {order.outlet?.gstNumber && (
              <p className="text-[10px] text-slate-400 mt-0.5">GSTIN: {order.outlet.gstNumber}</p>
            )}
            {order.outlet?.phone && (
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                <Phone size={9} /> {order.outlet.phone}
              </p>
            )}
          </div>

          {/* Order meta */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Order ID</span>
              <span className="font-mono font-semibold text-slate-700">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Token</span>
              <span className="font-bold text-slate-700">#{order.tokenNumber ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Placed at</span>
              <span className="font-semibold text-slate-700">{dayjs(order.createdAt).format('DD MMM, hh:mm A')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="font-semibold text-slate-700">{order.isParcel ? 'Parcel' : (order.table ? `Table ${order.table.number}` : 'Counter')}</span>
            </div>
          </div>

          {/* Items — grouped by menu when the order spans more than one. */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Items</p>
            {(() => {
              const items = (order.items as any[]) || [];
              const groups = new Map<string, { name: string; items: any[] }>();
              for (const it of items) {
                const key = it.menu?.id || it.menuId || '__none__';
                const name = it.menu?.name || '';
                if (!groups.has(key)) groups.set(key, { name, items: [] });
                groups.get(key)!.items.push(it);
              }
              const showHeaders = groups.size > 1;
              return Array.from(groups.values()).map((g, gi) => (
                <div key={g.name || `g-${gi}`} className="mb-3 last:mb-0">
                  {showHeaders && g.name && (
                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1">{g.name}</p>
                  )}
                  <div className="divide-y divide-slate-100">
                    {g.items.map((it: any) => (
                      <div key={it.id} className="py-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              <span className="text-orange-600 font-bold mr-1">{it.quantity}×</span>
                              {it.item?.name}
                              {it.variant && <span className="text-xs text-slate-500"> ({it.variant.name})</span>}
                            </p>
                            {it.notes && <p className="text-[11px] text-slate-400 mt-0.5">{it.notes}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-slate-400">@ ₹{Number(it.unitPrice).toFixed(2)}</p>
                            <p className="text-sm font-bold text-slate-800">₹{Number(it.totalPrice).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-slate-200 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span></div>
            {Number(order.taxAmount) > 0 && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>SGST</span>
                  <span>₹{Number(order.sgstAmount ?? Number(order.taxAmount) / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>CGST</span>
                  <span>₹{Number(order.cgstAmount ?? Number(order.taxAmount) / 2).toFixed(2)}</span>
                </div>
              </>
            )}
            {Number(order.parcelAmount) > 0 && (
              <div className="flex justify-between text-slate-500"><span>Parcel</span><span>₹{Number(order.parcelAmount).toFixed(2)}</span></div>
            )}
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Discount</span><span>− ₹{Number(order.discountAmount).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-black text-slate-900 text-base pt-1 border-t border-slate-200">
              <span>Total</span><span>₹{Number(order.totalAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment status */}
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between ${paid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <span className="flex items-center gap-2">
              {paid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              {paid ? 'Payment received' : 'Payment pending'}
            </span>
            <span className="text-xs">{payment?.mode || '—'}</span>
          </div>

          {/* Payment breakdown — only meaningful when multiple modes or to confirm what mode paid */}
          {order.payments?.length > 0 && (() => {
            const split: Record<string, number> = {};
            order.payments
              .filter((p: any) => p.status === 'SUCCESS')
              .forEach((p: any) => { split[p.mode] = (split[p.mode] || 0) + Number(p.amount); });
            const labels: Record<string, string> = {
              CASH: 'Cash', UPI: 'UPI', CARD: 'Card', WALLET: 'Wallet', NET_BANKING: 'Net Banking',
            };
            const rows = Object.entries(split);
            if (rows.length === 0) return null;
            return (
              <div className="border border-slate-100 rounded-xl px-3 py-2 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Paid via</p>
                {rows.map(([mode, amount]) => (
                  <div key={mode} className="flex justify-between text-xs">
                    <span className="text-slate-600">{labels[mode] || mode}</span>
                    <span className="font-bold text-slate-800">₹{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => navigate(`/track/${order.id}?outlet=${order.outletId}`)}
              className="w-full bg-gradient-to-r from-brand-500 to-orange-400 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2"
            >
              Track order <ChevronRight size={16} />
            </button>
            <button
              onClick={handleDownload}
              className="w-full bg-slate-100 text-slate-700 font-semibold py-3 rounded-2xl flex items-center justify-center gap-2"
            >
              <Download size={14} /> Download Receipt
            </button>
          </div>
        </div>
      </div>

      {/* Off-screen thermal receipt — the html2pdf source. Kept in the DOM
          (not display:none, which html2canvas can't render) but positioned
          off-canvas so it never affects the on-screen layout. */}
      <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} aria-hidden>
        <ThermalReceipt ref={receiptRef} order={order} />
      </div>
    </div>
  );
}
