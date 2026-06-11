import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  CheckCircle2, Clock, ChefHat, Bell, Package2,
  RotateCcw, Star, AlertTriangle, X, ChevronDown,
  MessageSquare, IndianRupee, ArrowLeft, Heart, Plus,
} from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useCustomerAlerts } from '../context/CustomerAlertsContext';

/* ── constants ───────────────────────────────────────────── */
const STEPS = [
  { status: 'CREATED',         label: 'Placed',          icon: CheckCircle2, color: 'bg-blue-500' },
  { status: 'QUEUED',          label: 'Queued',          icon: Clock,        color: 'bg-yellow-500' },
  { status: 'PREPARING',       label: 'Preparing',       icon: ChefHat,      color: 'bg-brand-700' },
  { status: 'READY',           label: 'Ready',           icon: Bell,         color: 'bg-emerald-500' },
  { status: 'OUT_FOR_SERVICE', label: 'On its way',      icon: Package2,     color: 'bg-teal-500' },
  { status: 'SERVED',          label: 'Served',          icon: Package2,     color: 'bg-slate-500' },
];

const STATUS_MSG: Record<string, { title: string; sub: string; emoji: string; cls: string }> = {
  CREATED:         { title: 'Order placed!',          sub: 'Waiting for confirmation.',         emoji: '🎉', cls: 'bg-blue-50 border-blue-200 text-blue-800' },
  QUEUED:          { title: 'Order queued',           sub: 'Sending to kitchen now.',           emoji: '✅', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  PREPARING:       { title: 'Chef is cooking…',       sub: 'Sit tight — almost there!',         emoji: '🍳', cls: 'bg-brand-50 border-brand-200 text-brand-800' },
  READY:           { title: 'Your food is ready!',    sub: 'Please collect your order.',        emoji: '🔔', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  OUT_FOR_SERVICE: { title: 'On its way to you',      sub: 'Our staff is bringing it across.',  emoji: '🚶', cls: 'bg-teal-50 border-teal-200 text-teal-800' },
  SERVED:          { title: 'Enjoy your meal!',       sub: 'Hope you love every bite.',         emoji: '😋', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  CANCELLED:       { title: 'Order cancelled',        sub: 'Contact the outlet for help.',      emoji: '❌', cls: 'bg-red-50 border-red-200 text-red-700' },
  DISPUTED:        { title: 'Dispute raised',         sub: 'The outlet is reviewing your concern.', emoji: '⚠️', cls: 'bg-amber-50 border-amber-200 text-amber-800' },
  RESOLVED:        { title: 'Dispute resolved',       sub: 'Thanks for your patience.',         emoji: '✅', cls: 'bg-sky-50 border-sky-200 text-sky-800' },
  FOR_REFUND:      { title: 'Refund pending',         sub: 'Your refund is being processed.',   emoji: '💸', cls: 'bg-pink-50 border-pink-200 text-pink-800' },
  REFUND_COMPLETE: { title: 'Refund complete',        sub: 'Money returned to your account.',   emoji: '✅', cls: 'bg-purple-50 border-purple-200 text-purple-800' },
};

const DISPUTE_STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  OPEN:      { cls: 'bg-red-100 text-red-700 border-red-200',    label: 'Open' },
  REVIEWING: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Under Review' },
  RESOLVED:  { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Resolved' },
  CLOSED:    { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Closed' },
};

function elapsed(t: string) {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

// Group expanded combo (bundle) children back under their parent so the
// customer sees one combo entry on the bill + tracking views, with the
// sub-items listed beneath. Standalone OrderItems pass through.
type TrackRow =
  | { kind: 'item'; item: any }
  | { kind: 'bundle'; bundleId: string; name: string; children: any[]; quantity: number; totalPrice: number };

function groupBundles(items: any[]): TrackRow[] {
  const out: TrackRow[] = [];
  const seen = new Map<string, Extract<TrackRow, { kind: 'bundle' }>>();
  for (const it of items) {
    if (it?.bundleId) {
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
      if (Number(it.totalPrice ?? 0) > 0) bundle.quantity += Number(it.quantity ?? 0);
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

/* ── component ───────────────────────────────────────────── */
export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const location    = useLocation();
  const { isLoggedIn } = useCustomerAuth();

  const initialOutletId = searchParams.get('outlet') || 'demo-outlet';
  // Order summary handed to us by the previous page (OrderPage) renders instantly.
  const seedOrder = (location.state as any)?.order || null;

  const [order, setOrder]         = useState<any>(seedOrder);
  const [disputes, setDisputes]   = useState<any[]>(seedOrder?.disputes || []);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Pre-load viewer favourites so hearts on items show the right initial state
  useEffect(() => {
    api.get('/users/me/favorites')
      .then(({ data }) => setFavoriteIds(new Set((data.data || []).map((f: any) => f.itemId))))
      .catch(() => {});
  }, []);
  const [outletId, setOutletId]   = useState(seedOrder?.outletId || initialOutletId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setTick]               = useState(0);

  // Re-render every 30s so elapsed time stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [description, setDescription]         = useState('');
  const [claimAmount, setClaimAmount]         = useState('');
  const [showItems, setShowItems]             = useState(false);

  /* ── fetch order ────────────────────────────────────────── */
  useEffect(() => {
    const outletForFetch = seedOrder?.outletId || initialOutletId;
    api.get(`/outlets/${outletForFetch}/orders/${orderId}`)
      .then(({ data }) => {
        setOrder(data.data);
        setOutletId(data.data.outletId || outletForFetch);
        setDisputes(data.data.disputes || []);
      })
      .catch((err) => {
        // If we already have a seed order from navigation state, fail silently
        // and keep showing the summary — live status updates just won't refresh.
        if (seedOrder) return;
        setLoadError(
          err?.response?.status === 404
            ? "We couldn't find this order. The link may be incorrect."
            : err?.response?.data?.message || 'Failed to load your order. Please try again.'
        );
      });
  }, [orderId, initialOutletId]);

  /* ── live updates ───────────────────────────────────────── */
  useEffect(() => {
    if (!orderId) return;
    const socket = io(`${import.meta.env.VITE_WS_URL || 'http://localhost:3001'}/orders`);
    socket.emit('joinOrder', orderId);
    if (order?.tableId) socket.emit('joinTable', { outletId, tableId: order.tableId });
    socket.on('orderStatusUpdated', (u: any) => {
      if (u.id === orderId) {
        setOrder(u);
        if (u.disputes) setDisputes(u.disputes);
      }
    });
    return () => { socket.disconnect(); };
  }, [outletId, orderId, order?.tableId]);

  /* ── raise dispute ──────────────────────────────────────── */
  const raiseDispute = async () => {
    if (!description.trim()) { toast.error('Please describe the issue'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/disputes', {
        orderId,
        description: description.trim(),
        claimAmount: claimAmount ? Number(claimAmount) : undefined,
      });
      setDisputes(prev => [data.data, ...prev]);
      setOrder((o: any) => o ? { ...o, status: 'DISPUTED' } : o);
      setShowDisputeForm(false);
      setDescription('');
      setClaimAmount('');
      toast.success('Dispute raised — the outlet will review it shortly');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to raise dispute');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── error state ────────────────────────────────────────── */
  if (loadError) return (
    <div className="h-dvh flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-400 px-6">
      <div className="bg-white rounded-3xl shadow-pop p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle size={22} />
        </div>
        <p className="mt-4 text-base font-bold text-slate-900">Can't load this order</p>
        <p className="mt-1 text-sm text-slate-500">{loadError}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-3 rounded-2xl text-sm shadow"
        >
          Start over
        </button>
      </div>
    </div>
  );

  /* ── loading state ──────────────────────────────────────── */
  if (!order) return (
    <div className="h-dvh flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-400">
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-white/80 text-sm mt-3 font-medium">Loading order…</p>
      </div>
    </div>
  );

  const currentIdx  = STEPS.findIndex(s => s.status === order.status);
  const isDone      = ['SERVED', 'CANCELLED', 'DISPUTED', 'RESOLVED', 'REFUND_COMPLETE'].includes(order.status);
  const canDispute  = order.status === 'SERVED' && disputes.every(d => ['RESOLVED', 'CLOSED'].includes(d.status));
  const activeDispute = disputes.find(d => !['RESOLVED', 'CLOSED'].includes(d.status));
  const msg         = STATUS_MSG[order.status];

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-10 pb-16 px-5 text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl" />

        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowLeft size={15} />
        </button>

        <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Order</p>
        <p className="text-3xl font-black text-white">{order.orderNumber}</p>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          {order.tokenNumber != null && (
            <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-3 py-1">
              <span className="text-[10px] uppercase tracking-widest font-bold">Token</span>
              <span className="text-base font-black">#{order.tokenNumber}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-slate-300 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold">
            <Clock size={11} /> Placed {elapsed(order.createdAt)} ago
          </span>
        </div>
        {order.table && <p className="text-slate-400 text-sm mt-1">Table {order.table.number}</p>}

        {/* Postpaid open-tab: let the customer add more items to the same
            order from anywhere — they don't need to re-scan the table QR. */}
        {order.isPostpaid && !order.billRequestedAt && order.tableId && !isDone && (
          <button
            onClick={() => navigate(`/order?outlet=${order.outletId}&table=${order.tableId}`)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-full font-bold shadow"
          >
            <Plus size={12} /> Add items to this tab
          </button>
        )}

        {/* Bill requested (by staff or customer) — show Pay Now CTA so the
            customer can settle from anywhere. Hidden once order is done. */}
        {order.isPostpaid && order.billRequestedAt && !isDone && (
          <button
            onClick={() => navigate('/pay', {
              state: {
                outletId: order.outletId,
                tableId: order.tableId,
                billOrderId: order.id,
                total: Number(order.totalAmount),
                outletName: order.outlet?.name,
              },
            })}
            className="mt-3 inline-flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-full font-bold shadow animate-pulse"
          >
            <IndianRupee size={12} /> Pay now · ₹{Number(order.totalAmount).toFixed(2)}
          </button>
        )}

        {isDone && (
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 right-4 flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full transition-colors font-medium"
          >
            <RotateCcw size={12} /> New Order
          </button>
        )}
      </div>

      <div className="flex-1 px-4 -mt-8 relative z-10 space-y-3 pb-8">

        {/* ── Progress tracker ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <div className="relative">
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-100 z-0" />
              <div
                className="absolute top-4 left-4 h-0.5 bg-brand-500 z-0 transition-all duration-700"
                style={{ width: currentIdx >= 0 ? `${(currentIdx / (STEPS.length - 1)) * 92}%` : '0%' }}
              />
              <div className="relative z-10 flex justify-between">
                {STEPS.map((step, idx) => {
                  const done   = idx <= currentIdx;
                  const active = idx === currentIdx;
                  return (
                    <div key={step.status} className="flex flex-col items-center gap-1.5" style={{ width: '20%' }}>
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                        done ? step.color : 'bg-slate-100',
                        active && 'ring-4 ring-offset-2 ring-brand-400/40 scale-110',
                      )}>
                        <step.icon size={14} className={done ? 'text-white' : 'text-slate-300'} />
                      </div>
                      <p className={clsx('text-[9px] font-semibold text-center leading-tight', done ? 'text-slate-700' : 'text-slate-400')}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {msg && (
            <div className={clsx('mx-4 mb-4 mt-3 px-4 py-3 rounded-2xl border flex items-start gap-3', msg.cls)}>
              <span className="text-xl shrink-0">{msg.emoji}</span>
              <div>
                <p className="font-bold text-sm">{msg.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{msg.sub}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Active dispute banner ─────────────────────────────── */}
        {activeDispute && (
          <DisputeStatusCard dispute={activeDispute} />
        )}

        {/* ── Per-item progress ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <p className="text-sm font-bold text-slate-800">Your Items</p>
            <p className="text-xs text-slate-400 mt-0.5">Live progress and feedback for each dish</p>
          </div>
          <div className="px-5 pb-5 space-y-3">
            {(() => {
              // If the order has been sequenced into courses, group items
              // under their course label so the customer sees "Starter →
              // Main → Dessert" structure. Items with no course are
              // bundled under "Anytime" (always available to the kitchen).
              const items = order.items || [];
              const hasSequencing = items.some((i: any) => i.sequenceNumber != null);
              if (!hasSequencing) {
                // Group expanded combo children under their parent so
                // the customer sees the combo as one block with each
                // sub-item's progress (cooking / ready / served) shown
                // beneath. Standalone items render as before.
                return groupBundles(items).map((row: TrackRow) => {
                  if (row.kind === 'bundle') {
                    return (
                      <div
                        key={`b-${row.bundleId}`}
                        className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-brand-900">
                            {row.quantity}× {row.name}
                            <span className="text-[10px] font-semibold text-brand-700 ml-1.5">
                              · {row.children.length} items
                            </span>
                          </p>
                        </div>
                        {row.children.map((child: any) => (
                          <ItemProgressRow
                            key={child.id}
                            item={child}
                            onReviewSaved={(review) => {
                              setOrder((prev: any) => prev ? ({
                                ...prev,
                                items: prev.items.map((oi: any) => oi.id === child.id ? { ...oi, review } : oi),
                              }) : prev);
                            }}
                          />
                        ))}
                      </div>
                    );
                  }
                  const item = row.item;
                  return (
                    <ItemProgressRow
                      key={item.id}
                      item={item}
                      onReviewSaved={(review) => {
                        setOrder((prev: any) => prev ? ({
                          ...prev,
                          items: prev.items.map((oi: any) => oi.id === item.id ? { ...oi, review } : oi),
                        }) : prev);
                      }}
                    />
                  );
                });
              }
              const labels: Record<string, string> = order.sequenceLabels || {};
              const groups = new Map<string, any[]>();
              for (const it of items) {
                const key = it.sequenceNumber == null ? '0' : String(it.sequenceNumber);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(it);
              }
              const sortedKeys = Array.from(groups.keys()).sort((a, b) => Number(a) - Number(b));
              const active = order.activeSequence ?? 1;
              return sortedKeys.map((key) => {
                const courseNum = Number(key);
                const isAnytime = courseNum === 0;
                const courseLabel = isAnytime
                  ? 'Anytime'
                  : (labels[key] || `Course ${key}`);
                const isActive = !isAnytime && courseNum === active;
                const isHeld = !isAnytime && courseNum > active;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{courseLabel}</p>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Now serving
                        </span>
                      )}
                      {isHeld && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Up next
                        </span>
                      )}
                    </div>
                    {groups.get(key)!.map((item: any) => (
                      <ItemProgressRow
                        key={item.id}
                        item={item}
                        onReviewSaved={(review) => {
                          setOrder((prev: any) => prev ? ({
                            ...prev,
                            items: prev.items.map((oi: any) => oi.id === item.id ? { ...oi, review } : oi),
                          }) : prev);
                        }}
                      />
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* ── Bill summary (collapsible) ───────────────────────── */}
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <button
            onClick={() => setShowItems(p => !p)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <p className="text-sm font-bold text-slate-800">
              Bill summary
              {' '}·{' '}
              <span className="text-brand-600">₹{Number(order.totalAmount).toFixed(2)}</span>
            </p>
            <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', showItems && 'rotate-180')} />
          </button>

          {showItems && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-1">
              {groupBundles(order.items || []).map((row: any) => {
                if (row.kind === 'bundle') {
                  return (
                    <div key={`b-${row.bundleId}`} className="text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate flex-1 font-semibold text-slate-700">
                          {row.quantity}× {row.name}
                        </span>
                        <span className="shrink-0">₹{row.totalPrice.toFixed(2)}</span>
                      </div>
                      <ul className="pl-3 mt-0.5 space-y-0.5">
                        {row.children.map((c: any) => (
                          <li key={c.id} className="text-[11px] text-slate-400 truncate">
                            • {c.item?.name || 'Item'}
                            {c.variant?.name ? ` (${c.variant.name})` : ''} × {c.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                const item = row.item;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="truncate flex-1">{item.quantity}× {item.item?.name}{item.variant ? ` (${item.variant.name})` : ''}</span>
                    <FavoriteHeart itemId={item.itemId} initial={favoriteIds.has(item.itemId)} />
                    <span className="shrink-0">₹{Number(item.totalPrice).toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="border-t border-slate-100 mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span>
                </div>
                {Number(order.taxAmount) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>SGST</span>
                      <span>₹{Number((order as any).sgstAmount ?? Number(order.taxAmount) / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>CGST</span>
                      <span>₹{Number((order as any).cgstAmount ?? Number(order.taxAmount) / 2).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-100">
                  <span>Total</span><span>₹{Number(order.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Resolved disputes history ─────────────────────────── */}
        {disputes.filter(d => ['RESOLVED', 'CLOSED'].includes(d.status)).map(d => (
          <ResolvedDisputeCard key={d.id} dispute={d} />
        ))}

        {/* ── Raise dispute form ────────────────────────────────── */}
        {showDisputeForm && (
          <div className="bg-white rounded-3xl shadow-card p-5 space-y-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={16} />
                </div>
                <p className="text-sm font-bold text-slate-800">Describe Your Issue</p>
              </div>
              <button onClick={() => setShowDisputeForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                What went wrong? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="e.g. Wrong item delivered, food was cold, item missing from order…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all resize-none"
                maxLength={500}
              />
              <p className="text-xs text-slate-400 text-right mt-1">{description.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Claim Amount (₹) <span className="text-slate-400 font-normal normal-case">— optional</span>
              </label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={claimAmount}
                  onChange={e => setClaimAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Amount you'd like refunded or compensated</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDisputeForm(false)}
                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-2xl text-sm hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={raiseDispute}
                disabled={submitting || !description.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Submit Dispute
              </button>
            </div>
          </div>
        )}

        {/* ── Done CTAs ─────────────────────────────────────────── */}
        <div className="space-y-2">
          {isDone && (
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-4 rounded-2xl shadow-lg text-base"
            >
              <RotateCcw size={17} /> Start New Order
            </button>
          )}

          {/* Raise dispute button */}
          {canDispute && !showDisputeForm && (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-amber-300 text-amber-700 font-semibold py-3.5 rounded-2xl text-sm hover:bg-amber-50 transition-colors"
            >
              <AlertTriangle size={15} /> Raise a Dispute
            </button>
          )}

          {isDone && order.status !== 'CANCELLED' && !showDisputeForm && (
            <button className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl text-sm hover:bg-slate-50 transition-colors">
              <Star size={15} className="text-amber-500" /> Rate Your Experience
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Active dispute status card ──────────────────────────── */
function DisputeStatusCard({ dispute }: { dispute: any }) {
  const style = DISPUTE_STATUS_STYLE[dispute.status] || DISPUTE_STATUS_STYLE.OPEN;
  return (
    <div className={clsx('rounded-3xl border p-5 space-y-3', style.cls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} />
          <p className="text-sm font-bold">Dispute {style.label}</p>
        </div>
        <span className="text-xs font-semibold opacity-75">
          {new Date(dispute.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>

      <div className="bg-white/60 rounded-2xl p-3 space-y-2">
        <div>
          <p className="text-xs font-semibold opacity-70 mb-0.5">Your concern</p>
          <p className="text-sm font-medium leading-relaxed">{dispute.description}</p>
        </div>
        {dispute.claimAmount && (
          <div>
            <p className="text-xs font-semibold opacity-70 mb-0.5">Claim amount</p>
            <p className="text-sm font-bold">₹{Number(dispute.claimAmount).toFixed(0)}</p>
          </div>
        )}
      </div>

      {dispute.status === 'REVIEWING' && (
        <p className="text-xs opacity-75 flex items-center gap-1.5">
          <MessageSquare size={12} /> The outlet is reviewing your case — you'll be notified of the outcome.
        </p>
      )}
    </div>
  );
}

/* ── Per-item progress row ───────────────────────────────── */
type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

const ITEM_STEPS: { key: ItemStatus; label: string; color: string }[] = [
  { key: 'PENDING',   label: 'Queued',    color: '#94a3b8' },
  { key: 'PREPARING', label: 'Cooking',   color: '#0B4245' },
  { key: 'READY',     label: 'Ready',     color: '#10b981' },
  { key: 'SERVED',    label: 'Served',    color: '#14b8a6' },
];

const ITEM_BADGE: Record<ItemStatus, { bg: string; text: string; border: string; label: string; emoji: string }> = {
  PENDING:   { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: 'Queued',    emoji: '⏳' },
  PREPARING: { bg: '#e8efef', text: '#04181a', border: '#D2E5DF', label: 'Cooking',   emoji: '🍳' },
  READY:     { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'Ready',     emoji: '🔔' },
  SERVED:    { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', label: 'Served',    emoji: '✓'  },
  CANCELLED: { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', label: 'Cancelled', emoji: '✕'  },
};

function ItemProgressRow({ item, onReviewSaved }: { item: any; onReviewSaved?: (review: any) => void }) {
  const status = (item.status || 'PENDING') as ItemStatus;
  const badge = ITEM_BADGE[status];
  const idx = ITEM_STEPS.findIndex(s => s.key === status);
  const canReview = status === 'SERVED';
  // Blink the row while this specific item has a fresh unread
  // ITEM_READY alert AND the item itself is still in an active state.
  // Once status moves to SERVED or CANCELLED, blinking stops regardless
  // of whether the customer tapped OK.
  const { hasReadyAlertForOrderItem } = useCustomerAlerts();
  const isBlinking = hasReadyAlertForOrderItem(item.id, status);

  return (
    <div className={clsx(
      'border rounded-2xl p-3',
      isBlinking ? 'border-brand-400 animate-blink ring-2 ring-brand-300' : 'border-slate-100',
    )}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
          {item.quantity}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{item.item?.name}</p>
          {item.variant && <p className="text-xs text-slate-400">{item.variant.name}</p>}
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
          <span className="mr-0.5">{badge.emoji}</span> {badge.label}
        </span>
      </div>

      {status !== 'CANCELLED' && (
        <div className="flex items-center gap-1 mt-3">
          {ITEM_STEPS.map((step, i) => (
            <div key={step.key} className="flex-1 flex items-center gap-1">
              <span className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= idx ? step.color : '#e2e8f0' }} />
            </div>
          ))}
        </div>
      )}
      {status !== 'CANCELLED' && (
        <div className="flex justify-between mt-1.5">
          {ITEM_STEPS.map((step, i) => (
            <span key={step.key} className="text-[9px] font-semibold"
              style={{ color: i <= idx ? step.color : '#94a3b8' }}>
              {step.label}
            </span>
          ))}
        </div>
      )}

      {/* Inline rating form — appears once this individual item is served. */}
      {canReview && onReviewSaved && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <RateItemRow orderItem={item} onSaved={onReviewSaved} />
        </div>
      )}
    </div>
  );
}

/* ── Resolved dispute card ───────────────────────────────── */
function ResolvedDisputeCard({ dispute }: { dispute: any }) {
  const style = DISPUTE_STATUS_STYLE[dispute.status];
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 space-y-3 border border-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <p className="text-sm font-bold text-slate-800">Dispute {style?.label}</p>
        </div>
        <span className="text-xs text-slate-400">
          {new Date(dispute.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
        <div>
          <p className="text-xs text-slate-400 font-semibold mb-0.5">Your concern</p>
          <p className="text-sm text-slate-700">{dispute.description}</p>
        </div>
        {dispute.resolution && (
          <div className="border-t border-slate-100 pt-2">
            <p className="text-xs text-emerald-600 font-semibold mb-0.5">Outlet resolution</p>
            <p className="text-sm text-slate-700">{dispute.resolution}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FavoriteHeart({ itemId, initial }: { itemId: string; initial?: boolean }) {
  const [fav, setFav] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        const next = !fav;
        setFav(next); setBusy(true);
        try {
          if (next) await api.post(`/users/me/favorites/${itemId}`);
          else      await api.delete(`/users/me/favorites/${itemId}`);
        } catch {
          setFav(!next);
        } finally { setBusy(false); }
      }}
      className={clsx(
        'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
        fav ? 'text-red-500' : 'text-slate-300 hover:text-red-400',
      )}
      title={fav ? 'Remove from favourites' : 'Add to favourites'}
    >
      <Heart size={12} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ── Inline rating UI used inside ItemProgressRow once item is SERVED ── */
function RateItemRow({ orderItem, onSaved }: { orderItem: any; onSaved: (review: any) => void }) {
  const existing = orderItem.review;
  const [rating, setRating]   = useState<number>(existing?.rating ?? 0);
  const [comment, setComment] = useState<string>(existing?.comment ?? '');
  const [hover, setHover]     = useState<number>(0);
  const [busy, setBusy]       = useState(false);
  const dirty =
    rating !== (existing?.rating ?? 0) ||
    (comment.trim() || '') !== ((existing?.comment ?? '').trim() || '');

  const save = async () => {
    if (!rating) { toast.error('Pick a rating first'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/order-items/${orderItem.id}/review`, {
        rating,
        comment: comment.trim() || null,
      });
      onSaved(data.data);
      toast.success(existing ? 'Review updated' : 'Thanks for the rating!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
        <Star size={11} className="text-amber-500" fill="currentColor" /> Rate this dish
      </p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-0.5"
            aria-label={`${n} stars`}
          >
            <Star
              size={22}
              className={clsx('transition-colors', (hover || rating) >= n ? 'text-amber-400' : 'text-slate-200')}
              fill={(hover || rating) >= n ? 'currentColor' : 'none'}
            />
          </button>
        ))}
        {rating > 0 && <span className="ml-1 text-xs font-bold text-slate-500">{rating}/5</span>}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment for the outlet…"
        rows={2}
        className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-brand-400 resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400">
          {existing ? `Last updated ${new Date(existing.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Not rated yet'}
        </span>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="text-xs font-bold bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl"
        >
          {busy ? 'Saving…' : existing ? 'Update' : 'Submit'}
        </button>
      </div>

      {/* Manager reply (read-only on the customer side) */}
      {existing?.replyText && (
        <div className="bg-slate-50 rounded-xl p-3 border-l-4 border-brand-300">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            Reply{existing.replyBy?.name ? ` from ${existing.replyBy.name}` : ''}
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{existing.replyText}</p>
        </div>
      )}

      {/* Payback acknowledgement */}
      {existing?.paybackPayment && (
        <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-700">
            Refund received · ₹{Number(existing.paybackPayment.amount).toFixed(2)} via {existing.paybackPayment.mode}
          </span>
        </div>
      )}
    </div>
  );
}
