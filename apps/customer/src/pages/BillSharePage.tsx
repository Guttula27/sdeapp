import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Users, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

/**
 * Split-bill share detail. Customer arrives here from the WhatsApp
 * deep-link OR from "My Bills". Shows:
 *   • parent order summary (outlet + items + total)
 *   • the diner's share amount + outstanding-share count
 *   • Pay button that hands off to the standard PaymentPage with
 *     splitShareId set — payment, confirmation, share settlement
 *     all flow through the existing /pay flow + the server-side
 *     hook landed in 61261790.
 *
 * Server stamps VIEWED on first auth'd GET so the operator's
 * OrdersPage panel shows when the diner saw their share.
 */
export default function BillSharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [share, setShare] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !shareId) return;
    setLoading(true);
    api.get(`/split-shares/${shareId}`)
      .then((r) => setShare(r.data?.data ?? null))
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load bill'))
      .finally(() => setLoading(false));
  }, [user, shareId]);

  if (!user) return null;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading…</div>;
  }
  if (error || !share) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <XCircle size={28} className="mx-auto text-rose-400 mb-2" />
          <p className="text-sm text-slate-700 font-semibold">{error || 'Bill not found'}</p>
          <button onClick={() => navigate('/bills')} className="btn-primary mt-4 text-sm">
            Back to My Bills
          </button>
        </div>
      </div>
    );
  }

  const order = share.order;
  const isPaid = share.status === 'PAID';
  const isCancelled = share.status === 'CANCELLED' || share.status === 'EXPIRED';
  const canPay = !isPaid && !isCancelled;

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-slate-900">Split bill share</h1>
          <p className="text-[11px] text-slate-500">Order {order?.orderNumber}</p>
        </div>
      </header>

      <main className="p-4 space-y-3">
        {/* Outlet card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden shrink-0">
            {order?.outlet?.logoUrl
              ? <img src={order.outlet.logoUrl} alt="" className="w-full h-full object-cover" />
              : <Receipt size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900 truncate">{order?.outlet?.name ?? 'Outlet'}</p>
            <p className="text-[11px] text-slate-500">Bill total · ₹{Number(order?.totalAmount ?? 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Share amount card */}
        <div className="bg-gradient-to-br from-brand-50 to-amber-50/30 rounded-2xl border border-brand-100 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold text-brand-700 mb-1">
            Your share
          </p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">
            ₹{Number(share.amount).toFixed(2)}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-white/70 border border-slate-200 px-2.5 py-1 rounded-full">
            <Users size={11} />
            {order?.splitPaidShares ?? 0} of {order?.splitTotalShares ?? 0} shares paid
          </div>
          <div className="mt-3">
            <StatusPill status={share.status} />
          </div>
        </div>

        {/* Items list (collapsed by default — most diners just want to pay) */}
        {Array.isArray(order?.items) && order.items.length > 0 && (
          <details className="bg-white rounded-2xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
              See what was ordered ({order.items.length} items)
            </summary>
            <ul className="px-4 pb-3 space-y-1.5 text-xs text-slate-600">
              {order.items.map((it: any) => (
                <li key={it.id} className="flex items-center justify-between">
                  <span className="truncate">
                    {it.quantity}× {it.item?.name ?? 'Item'}
                    {it.variant ? ` · ${it.variant.name}` : ''}
                  </span>
                  <span className="tabular-nums shrink-0 ml-2">
                    ₹{Number(it.totalPrice ?? 0).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>

      {/* Fixed bottom Pay button */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 z-30">
        <button
          disabled={!canPay}
          onClick={() => navigate('/pay', {
            state: {
              outletId: order?.outlet?.id,
              outletName: order?.outlet?.name,
              billOrderId: order?.id,
              splitShareId: share.id,
              total: Number(share.amount),
            },
          })}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors"
        >
          {isPaid ? (
            <>
              <CheckCircle2 size={16} /> Paid · thanks!
            </>
          ) : isCancelled ? (
            <>
              <XCircle size={16} /> {share.status}
            </>
          ) : (
            <>Pay ₹{Number(share.amount).toFixed(2)}</>
          )}
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { icon: any; cls: string; label: string }> = {
    PENDING:   { icon: Clock,         cls: 'bg-amber-50 text-amber-800 border-amber-200', label: 'PENDING' },
    SENT:      { icon: Clock,         cls: 'bg-amber-50 text-amber-800 border-amber-200', label: 'SENT' },
    VIEWED:    { icon: Clock,         cls: 'bg-amber-50 text-amber-800 border-amber-200', label: 'VIEWED' },
    PAID:      { icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'PAID' },
    CANCELLED: { icon: XCircle,       cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'CANCELLED' },
    EXPIRED:   { icon: XCircle,       cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'EXPIRED' },
  };
  const c = cfg[status] ?? cfg.PENDING;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.cls}`}>
      <Icon size={10} />
      {c.label}
    </span>
  );
}
