import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  CheckCircle2, Clock, ChefHat, Bell, Package2,
  RotateCcw, Star, AlertTriangle, X, ChevronDown, ChevronUp,
  MessageSquare, IndianRupee, ArrowLeft, Heart, Plus,
  Info, ArrowRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useCustomerAlerts } from '../context/CustomerAlertsContext';

/* ── constants ───────────────────────────────────────────── */
// Labels come from the i18n dictionary (track.step* / track.statusTitle* /
// track.statusSub*). Icons + tailwind classes stay here as visual config —
// they don't translate.
const STEPS = [
  { status: 'CREATED',         icon: CheckCircle2, color: 'bg-blue-500' },
  { status: 'QUEUED',          icon: Clock,        color: 'bg-yellow-500' },
  { status: 'PREPARING',       icon: ChefHat,      color: 'bg-brand-700' },
  { status: 'READY',           icon: Bell,         color: 'bg-emerald-500' },
  { status: 'OUT_FOR_SERVICE', icon: Package2,     color: 'bg-teal-500' },
  { status: 'SERVED',          icon: Package2,     color: 'bg-slate-500' },
];

// Visual style per status — emoji + tailwind class. Title/sub strings
// live under track.statusTitle{status} / track.statusSub{status} in the
// dictionary. READY_FOR_PICKUP is the parcel-path counterpart to
// OUT_FOR_SERVICE and was missing a style entry before; the render
// would crash on `msg.cls` when a parcel order hit that state.
const STATUS_STYLE: Record<string, { emoji: string; cls: string }> = {
  CREATED:         { emoji: '🎉', cls: 'bg-blue-50 border-blue-200 text-blue-800' },
  QUEUED:          { emoji: '✅', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  PREPARING:       { emoji: '🍳', cls: 'bg-brand-50 border-brand-200 text-brand-800' },
  READY:           { emoji: '🔔', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  OUT_FOR_SERVICE: { emoji: '🚶', cls: 'bg-teal-50 border-teal-200 text-teal-800' },
  SERVED:          { emoji: '😋', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  CANCELLED:       { emoji: '❌', cls: 'bg-red-50 border-red-200 text-red-700' },
  DISPUTED:        { emoji: '⚠️', cls: 'bg-amber-50 border-amber-200 text-amber-800' },
  RESOLVED:        { emoji: '✅', cls: 'bg-sky-50 border-sky-200 text-sky-800' },
  FOR_REFUND:      { emoji: '💸', cls: 'bg-pink-50 border-pink-200 text-pink-800' },
  REFUND_COMPLETE: { emoji: '✅', cls: 'bg-purple-50 border-purple-200 text-purple-800' },
  READY_FOR_PICKUP:{ emoji: '🛍️', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
};
const FALLBACK_STATUS_STYLE = { emoji: '⏳', cls: 'bg-slate-50 border-slate-200 text-slate-700' };

// Dispute status visual config. Label lives under track.disputeStatus{status}.
const DISPUTE_STATUS_STYLE: Record<string, { cls: string }> = {
  OPEN:      { cls: 'bg-red-100 text-red-700 border-red-200' },
  REVIEWING: { cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  RESOLVED:  { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CLOSED:    { cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// Returns the elapsed-time chip text via the i18n t() function so the
// "min" / "h" suffix can translate alongside the rest of the page.
function elapsed(iso: string, t: (k: string, opts?: any) => string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('track.elapsedJustNow');
  if (m < 60) return t('track.elapsedMin', { count: m });
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? t('track.elapsedHoursMin', { hours: h, minutes: rest }) : t('track.elapsedHours', { hours: h });
}

// Locale-aware "26 Jun, 7:14 PM" — used on terminal orders where a
// live duration would just tick uselessly. Falls back to the raw ISO
// if Intl.DateTimeFormat blows up (older browser / weird timezone).
function formatPlacedAt(t: string): string {
  try {
    const d = new Date(t);
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d);
  } catch {
    return t;
  }
}

// Group expanded combo (bundle) children back under their parent so the
// customer sees one combo entry on the bill + tracking views, with the
// sub-items listed beneath. Standalone OrderItems pass through.
type TrackRow =
  | { kind: 'item'; item: any }
  | { kind: 'bundle'; bundleId: string; name: string; children: any[]; quantity: number; totalPrice: number };

function groupBundles(items: any[], comboFallback: string): TrackRow[] {
  const out: TrackRow[] = [];
  const seen = new Map<string, Extract<TrackRow, { kind: 'bundle' }>>();
  for (const it of items) {
    if (it?.bundleId) {
      let bundle = seen.get(it.bundleId);
      if (!bundle) {
        bundle = {
          kind: 'bundle',
          bundleId: it.bundleId,
          name: it.bundleParent?.name || comboFallback,
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
  const { t } = useTranslation();
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
    if (!description.trim()) { toast.error(t('track.describeIssueRequired')); return; }
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
      toast.success(t('track.disputeRaised'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('track.disputeFailed'));
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
        <p className="mt-4 text-base font-bold text-slate-900">{t('track.cantLoad')}</p>
        <p className="mt-1 text-sm text-slate-500">{loadError}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-3 rounded-2xl text-sm shadow"
        >
          {t('track.startOver')}
        </button>
      </div>
    </div>
  );

  /* ── loading state ──────────────────────────────────────── */
  if (!order) return (
    <div className="h-dvh flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-400">
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-white/80 text-sm mt-3 font-medium">{t('track.loadingOrder')}</p>
      </div>
    </div>
  );

  const currentIdx  = STEPS.findIndex(s => s.status === order.status);
  const isDone      = ['SERVED', 'CANCELLED', 'DISPUTED', 'RESOLVED', 'REFUND_COMPLETE'].includes(order.status);
  const canDispute  = order.status === 'SERVED' && disputes.every(d => ['RESOLVED', 'CLOSED'].includes(d.status));
  const activeDispute = disputes.find(d => !['RESOLVED', 'CLOSED'].includes(d.status));
  // Compose the status message from the i18n dictionary keyed by
  // status (track.statusTitle{S} / track.statusSub{S}). The visual
  // style (emoji + tailwind class) stays in the local STATUS_STYLE
  // map. A status the client doesn't know about falls through to
  // statusTitleFallback / statusSubFallback / FALLBACK_STATUS_STYLE.
  const _msgStyle = STATUS_STYLE[order.status] || FALLBACK_STATUS_STYLE;
  const _msgTitle = STATUS_STYLE[order.status]
    ? t(`track.statusTitle${order.status}`)
    : t('track.statusTitleFallback');
  const _msgSub = STATUS_STYLE[order.status]
    ? t(`track.statusSub${order.status}`)
    : t('track.statusSubFallback');
  const msg = { ..._msgStyle, title: _msgTitle, sub: _msgSub };
  // Bill status — for postpaid orders we surface a Pending / Paid pill
  // so the diner sees clearly that the tab is still open even after
  // food is served. Feedback prompts are gated on isPaid so the diner
  // is only asked to rate after they've actually closed the bill,
  // which prevents the staff-served-the-food-but-customer-walked-out
  // scenario from leaking partial reviews.
  const isPaid = Array.isArray(order.payments) && order.payments.some(
    (p: any) => p?.status === 'SUCCESS' && !p?.isRefund,
  );

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-10 pb-16 px-5 text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl" />

        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowLeft size={15} />
        </button>

        <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">{t('track.order')}</p>
        <p className="text-3xl font-black text-white">{order.orderNumber}</p>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          {order.tokenNumber != null && (
            <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-3 py-1">
              <span className="text-[10px] uppercase tracking-widest font-bold">{t('track.token')}</span>
              <span className="text-base font-black">#{order.tokenNumber}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-slate-300 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold">
            {/* While the order is in flight the elapsed-time chip is the
                useful signal ("Placed 12 min ago"). Once it's terminal
                (SERVED / CANCELLED / DISPUTED / RESOLVED / REFUND_COMPLETE)
                the duration becomes noise that just keeps ticking — pin
                it to the actual placement timestamp instead. */}
            <Clock size={11} />
            {isDone
              ? t('track.placedFixed', { when: formatPlacedAt(order.createdAt) })
              : t('track.placedAgo', { when: elapsed(order.createdAt, t) })}
          </span>
          {order.isPostpaid && (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border',
                isPaid
                  ? 'text-emerald-200 bg-emerald-500/15 border-emerald-400/40'
                  : 'text-amber-200 bg-amber-500/15 border-amber-400/40',
              )}
              title={isPaid ? t('track.billPaidTitle') : t('track.billPendingTitle')}
            >
              {isPaid ? t('track.billPaid') : t('track.billPending')}
            </span>
          )}
        </div>
        {order.table && <p className="text-slate-400 text-sm mt-1">{t('track.tableLabel', { number: order.table.number })}</p>}

        {/* Postpaid open-tab: let the customer add more items to the same
            order from anywhere — they don't need to re-scan the table QR. */}
        {order.isPostpaid && !order.billRequestedAt && order.tableId && !isDone && (
          <button
            onClick={() => navigate(`/order?outlet=${order.outletId}&table=${order.tableId}`)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-full font-bold shadow"
          >
            <Plus size={12} /> {t('track.addItemsToTab')}
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
            <IndianRupee size={12} /> {t('track.payNowAmount', { amount: Number(order.totalAmount).toFixed(2) })}
          </button>
        )}

        {isDone && (
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 right-4 flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full transition-colors font-medium"
          >
            <RotateCcw size={12} /> {t('track.newOrder')}
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
                        {t(`track.step${step.status}`)}
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
            <p className="text-sm font-bold text-slate-800">{t('track.yourItems')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('track.yourItemsHint')}</p>
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
                return groupBundles(items, t('track.comboFallback')).map((row: TrackRow) => {
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
                              {t('track.bundleItemsCount', { count: row.children.length })}
                            </span>
                          </p>
                        </div>
                        {row.children.map((child: any) => (
                          <ItemProgressRow
                            key={child.id}
                            item={child}
                            feedbackUnlocked={!order.isPostpaid || isPaid}
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
                      feedbackUnlocked={!order.isPostpaid || isPaid}
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
                  ? t('track.courseAnytime')
                  : (labels[key] || t('track.courseLabel', { number: key }));
                const isActive = !isAnytime && courseNum === active;
                const isHeld = !isAnytime && courseNum > active;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{courseLabel}</p>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {t('track.nowServing')}
                        </span>
                      )}
                      {isHeld && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          {t('track.upNext')}
                        </span>
                      )}
                    </div>
                    {groups.get(key)!.map((item: any) => (
                      <ItemProgressRow
                        key={item.id}
                        item={item}
                        feedbackUnlocked={!order.isPostpaid || isPaid}
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
              {t('track.billSummary')}
              {' '}·{' '}
              <span className="text-brand-600">₹{Number(order.totalAmount).toFixed(2)}</span>
            </p>
            <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', showItems && 'rotate-180')} />
          </button>

          {showItems && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-1">
              {groupBundles(order.items || [], t('track.comboFallback')).map((row: any) => {
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
                            • {c.item?.name || t('track.itemFallback')}
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
                  <span>{t('track.subtotal')}</span><span>₹{Number(order.subtotal).toFixed(2)}</span>
                </div>
                {/* Discount breakdown — each coupon / reward gets its own
                    line so the customer sees what cut the bill. */}
                {(() => {
                  const coupons = ((order as any).couponUsages || [])
                    .map((c: any) => ({
                      label: c.coupon?.code ? t('track.couponLabel', { code: c.coupon.code }) : (c.coupon?.name || t('track.couponFallback')),
                      amount: Number(c.discountAmount),
                    }))
                    .filter((c: any) => c.amount > 0);
                  const rewards = ((order as any).rewardTransactions || [])
                    .map((r: any) => ({
                      label: t('track.rewardLabel', { points: Math.abs(r.points) }),
                      amount: Number(r.amountValue || 0),
                    }))
                    .filter((r: any) => r.amount > 0);
                  const explicit = coupons.reduce((s: number, c: any) => s + c.amount, 0)
                    + rewards.reduce((s: number, r: any) => s + r.amount, 0);
                  const total = Number(order.discountAmount || 0);
                  const leftover = Math.max(0, total - explicit);
                  const lines = [
                    ...coupons,
                    ...rewards,
                    ...(leftover > 0
                      ? [{ label: explicit > 0 ? t('track.otherDiscount') : t('track.discount'), amount: leftover }]
                      : []),
                  ];
                  return lines.map((l, i) => (
                    <div key={i} className="flex justify-between text-xs text-emerald-700">
                      <span>{l.label}</span>
                      <span>− ₹{l.amount.toFixed(2)}</span>
                    </div>
                  ));
                })()}
                {Number((order as any).parcelAmount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{t('track.parcelCharge')}</span>
                    <span>₹{Number((order as any).parcelAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(order.taxAmount) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{t('track.sgst')}</span>
                      <span>₹{Number((order as any).sgstAmount ?? Number(order.taxAmount) / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{t('track.cgst')}</span>
                      <span>₹{Number((order as any).cgstAmount ?? Number(order.taxAmount) / 2).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-100">
                  <span>{t('track.total')}</span><span>₹{Number(order.totalAmount).toFixed(2)}</span>
                </div>
                {Number(order.discountAmount || 0) > 0 && (
                  <p className="text-center text-[11px] font-bold text-emerald-700 mt-1">
                    {t('track.youSaved', { amount: Number(order.discountAmount).toFixed(2) })}
                  </p>
                )}
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
                <p className="text-sm font-bold text-slate-800">{t('track.describeIssue')}</p>
              </div>
              <button onClick={() => setShowDisputeForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                {t('track.whatWentWrong')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder={t('track.issuePlaceholder')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all resize-none"
                maxLength={500}
              />
              <p className="text-xs text-slate-400 text-right mt-1">{description.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                {t('track.claimAmount')} <span className="text-slate-400 font-normal normal-case">{t('track.claimAmountOptional')}</span>
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
              <p className="text-xs text-slate-400 mt-1">{t('track.claimAmountHint')}</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDisputeForm(false)}
                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-2xl text-sm hover:bg-slate-200 transition-colors"
              >
                {t('track.cancel')}
              </button>
              <button
                onClick={raiseDispute}
                disabled={submitting || !description.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {t('track.submitDispute')}
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
              <RotateCcw size={17} /> {t('track.startNewOrder')}
            </button>
          )}

          {/* Raise dispute button */}
          {canDispute && !showDisputeForm && (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-amber-300 text-amber-700 font-semibold py-3.5 rounded-2xl text-sm hover:bg-amber-50 transition-colors"
            >
              <AlertTriangle size={15} /> {t('track.raiseDispute')}
            </button>
          )}

          {isDone && order.status !== 'CANCELLED' && !showDisputeForm && (
            <button className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl text-sm hover:bg-slate-50 transition-colors">
              <Star size={15} className="text-amber-500" /> {t('track.rateExperience')}
            </button>
          )}
        </div>
      </div>

      <TrackPageAdCard outletName={order.outlet?.name} creative={order.outlet?.trackingAdCreative} />
    </div>
  );
}

/**
 * Bottom-pinned advertisement banner on the order tracking page.
 *
 * Modelled after a Google AdMob display banner:
 *   - Tall image-forward creative (portrait-ish) so it reads as a real
 *     ad, not a brand element of the app.
 *   - Collapse handle is a chevron pill sitting ABOVE the ad frame —
 *     ties the ad and its dismiss control together visually and matches
 *     the pattern the customer already recognizes from other apps.
 *   - AdChoices "info" icon in the top-right corner — the standard
 *     industry disclosure affordance. Tap for the "why am I seeing this"
 *     hint (placeholder toast for now; hooks into a real disclosure
 *     dialog when the ad backend ships).
 *   - "SPONSORED" chip on the creative so the ad boundary is legible
 *     even when the image + CTA blur together.
 *   - CTA pill in the corner ("Learn more →") gives the click target a
 *     shape a customer recognises from banner ads.
 *
 * When no ad-server creative is available for the outlet, we fall back
 * to a fullbleed gradient with the outlet's initial as a large glyph —
 * still occupies the slot so the layout is stable when campaigns switch
 * on/off.
 *
 * Behaviour: collapsible via the chevron. sessionStorage persists the
 * hidden state per-tab so it doesn't pop back on every re-render but
 * doesn't survive across sessions (next visit re-shows the slot).
 *
 * Sticky-positioned: the nearest scroll container is BottomNav's
 * <main>, so `sticky bottom-0` pins to the viewport's lower edge.
 */
/**
 * Ad creative shape the backend will emit for this slot once the ad
 * pipeline ships. Kept optional so the fallback branch (outlet initial
 * on a gradient) still renders when no campaign is active. `videoUrl`
 * takes precedence over `imageUrl` when both are present — richer
 * medium wins. `posterUrl` is used as the video's poster so the first
 * frame doesn't flash black on iOS while the video buffers.
 */
type AdCreative = {
  imageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  headline?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

function TrackPageAdCard({
  outletName,
  creative,
}: {
  outletName?: string | null;
  creative?: AdCreative | null;
}) {
  const { t } = useTranslation();
  const storageKey = 'pwa.track.adCollapsed';
  // Default to COLLAPSED so the tracking view isn't crowded on first
  // load — customer opts in by tapping the "Show ad" pill. Only an
  // explicit '0' in sessionStorage keeps it open across renders in
  // the same tab (i.e. after the customer expanded it once).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(storageKey) !== '0'; } catch { return true; }
  });
  const setCollapsedPersisted = (v: boolean) => {
    setCollapsed(v);
    try { sessionStorage.setItem(storageKey, v ? '1' : '0'); } catch { /* private mode */ }
  };

  if (!outletName) return null;

  if (collapsed) {
    return (
      <div className="sticky bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-1 pointer-events-none">
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={() => setCollapsedPersisted(false)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-card hover:bg-slate-50"
          >
            <ChevronUp size={12} /> {t('track.showAd')}
          </button>
        </div>
      </div>
    );
  }

  const initial = outletName.trim().charAt(0).toUpperCase();

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent">
      {/* Collapse handle sits above the frame like the mockup — a small
          pill with a downward chevron. Its background matches the ad
          shell so it reads as one connected surface. */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => setCollapsedPersisted(true)}
          aria-label={t('track.hideAd')}
          title={t('track.hideAd')}
          className="inline-flex items-center justify-center w-8 h-5 rounded-t-lg bg-white border border-slate-200 border-b-0 text-slate-500 hover:text-slate-800 shadow-sm"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="relative rounded-2xl overflow-hidden shadow-card bg-white border border-slate-200">
        {/* Creative area — video wins over image wins over gradient
            fallback. Height is viewport-relative (~28% of screen) so
            the ad slot never dominates the tracking view. Min/max
            clamps keep it usable on very short (landscape phone) or
            very tall (tablet) viewports; the object-cover on the
            media inside handles any aspect mismatch. */}
        <div className="relative w-full h-[28vh] min-h-[180px] max-h-[280px] bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 overflow-hidden">
          {creative?.videoUrl ? (
            // muted + playsInline are required for iOS to autoplay
            // inline; loop keeps the slot animated for the whole
            // tracking session. The <video> covers the frame with
            // object-cover so no letterboxing shows through.
            <video
              src={creative.videoUrl}
              poster={creative.posterUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : creative?.imageUrl ? (
            <img
              src={creative.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <>
              {/* Big decorative outlet initial as the fallback "hero".
                  Sized in em relative to a 6rem base so it scales
                  cleanly across the 180-280px height clamp. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[6rem] font-black text-white/70 drop-shadow-sm select-none leading-none">
                  {initial}
                </span>
              </div>
              {/* Subtle brand-tinged plate ring the initial sits on. */}
              <div className="absolute inset-4 rounded-2xl border-4 border-white/40 pointer-events-none" />
            </>
          )}

          {/* SPONSORED chip — AdMob-style, top-left. Kept small so it
              doesn't dominate the creative but is unmistakable. */}
          <span className="absolute top-2 left-2 inline-flex items-center text-[9px] font-black tracking-widest bg-slate-900/70 text-white px-1.5 py-0.5 rounded">
            {t('track.sponsored')}
          </span>

          {/* AdChoices — the "why am I seeing this" info icon. Uses a
              toast for now; hook it up to the ad backend's disclosure
              endpoint when it ships. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast(t('track.adInfo'), { icon: 'ⓘ' });
            }}
            aria-label={t('track.adInfoLabel')}
            title={t('track.adInfoLabel')}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/85 hover:bg-white text-slate-600 hover:text-slate-900 inline-flex items-center justify-center shadow-sm"
          >
            <Info size={12} />
          </button>

          {/* Bottom text plate. Solid gradient at the very bottom so
              headline text stays legible on any creative — image,
              video, or fallback. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pt-8 pb-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">
                {creative?.subtitle || t('track.broughtToYouBy')}
              </p>
              <p className="text-sm font-black text-white truncate">
                {creative?.headline || outletName}
              </p>
            </div>
            {creative?.ctaHref ? (
              <a
                href={creative.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold bg-white text-slate-900 rounded-full px-3 py-1.5 shadow-sm hover:bg-slate-50"
              >
                {creative.ctaLabel || t('track.adLearnMore')} <ArrowRight size={11} />
              </a>
            ) : (
              <button
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold bg-white text-slate-900 rounded-full px-3 py-1.5 shadow-sm hover:bg-slate-50"
              >
                {t('track.adLearnMore')} <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Active dispute status card ──────────────────────────── */
function DisputeStatusCard({ dispute }: { dispute: any }) {
  const { t } = useTranslation();
  const style = DISPUTE_STATUS_STYLE[dispute.status] || DISPUTE_STATUS_STYLE.OPEN;
  const label = DISPUTE_STATUS_STYLE[dispute.status]
    ? t(`track.disputeStatus${dispute.status}`)
    : t('track.disputeStatusOPEN');
  return (
    <div className={clsx('rounded-3xl border p-5 space-y-3', style.cls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} />
          <p className="text-sm font-bold">{t('track.disputeBadge', { label })}</p>
        </div>
        <span className="text-xs font-semibold opacity-75">
          {new Date(dispute.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>

      <div className="bg-white/60 rounded-2xl p-3 space-y-2">
        <div>
          <p className="text-xs font-semibold opacity-70 mb-0.5">{t('track.yourConcern')}</p>
          <p className="text-sm font-medium leading-relaxed">{dispute.description}</p>
        </div>
        {dispute.claimAmount && (
          <div>
            <p className="text-xs font-semibold opacity-70 mb-0.5">{t('track.claimAmountLabel')}</p>
            <p className="text-sm font-bold">₹{Number(dispute.claimAmount).toFixed(0)}</p>
          </div>
        )}
      </div>

      {dispute.status === 'REVIEWING' && (
        <p className="text-xs opacity-75 flex items-center gap-1.5">
          <MessageSquare size={12} /> {t('track.outletReviewing')}
        </p>
      )}
    </div>
  );
}

/* ── Per-item progress row ───────────────────────────────── */
type ItemStatus = 'PENDING_VERIFICATION' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

const ITEM_STEPS: { key: ItemStatus; color: string }[] = [
  { key: 'PENDING',   color: '#94a3b8' },
  { key: 'PREPARING', color: '#0B4245' },
  { key: 'READY',     color: '#10b981' },
  { key: 'SERVED',    color: '#14b8a6' },
];

const FALLBACK_BADGE = { bg: '#fefce8', text: '#854d0e', border: '#fde68a', emoji: '🕒' };

const ITEM_BADGE: Record<ItemStatus, { bg: string; text: string; border: string; emoji: string }> = {
  PENDING_VERIFICATION: FALLBACK_BADGE,
  PENDING:   { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', emoji: '⏳' },
  PREPARING: { bg: '#e8efef', text: '#04181a', border: '#D2E5DF', emoji: '🍳' },
  READY:     { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', emoji: '🔔' },
  SERVED:    { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', emoji: '✓'  },
  CANCELLED: { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', emoji: '✕'  },
};

function ItemProgressRow({ item, onReviewSaved, feedbackUnlocked = true }: {
  item: any;
  onReviewSaved?: (review: any) => void;
  // Defaults true so prepaid orders (no bill flow) keep their
  // existing behaviour — once served, the rating form shows.
  // Postpaid orders pass false until the bill is paid so the
  // diner is asked for feedback only after they've closed out.
  feedbackUnlocked?: boolean;
}) {
  const { t } = useTranslation();
  const status = (item.status || 'PENDING') as ItemStatus;
  // Always have a valid badge object so a server-added status the
  // client doesn't know yet doesn't blow up the whole page render
  // (which is what made the tracking page go blank on postpaid
  // table orders before service desk confirmation).
  const badge = ITEM_BADGE[status] || FALLBACK_BADGE;
  const badgeLabel = ITEM_BADGE[status]
    ? t(`track.itemBadge${status}`)
    : t('track.itemBadgeFallback');
  const idx = ITEM_STEPS.findIndex(s => s.key === status);
  const isServed = status === 'SERVED';
  const canReview = isServed && feedbackUnlocked;
  // PENDING_VERIFICATION sits *before* the four-step bar — leave the
  // progress strip empty so the customer sees "Awaiting confirmation"
  // without a misleading partial-progress line.
  const isPreConfirmation = status === 'PENDING_VERIFICATION';
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
          <span className="mr-0.5">{badge.emoji}</span> {badgeLabel}
        </span>
      </div>

      {status !== 'CANCELLED' && !isPreConfirmation && (
        <div className="flex items-center gap-1 mt-3">
          {ITEM_STEPS.map((step, i) => (
            <div key={step.key} className="flex-1 flex items-center gap-1">
              <span className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= idx ? step.color : '#e2e8f0' }} />
            </div>
          ))}
        </div>
      )}
      {status !== 'CANCELLED' && !isPreConfirmation && (
        <div className="flex justify-between mt-1.5">
          {ITEM_STEPS.map((step, i) => (
            <span key={step.key} className="text-[9px] font-semibold"
              style={{ color: i <= idx ? step.color : '#94a3b8' }}>
              {t(`track.itemStep${step.key}`)}
            </span>
          ))}
        </div>
      )}
      {isPreConfirmation && (
        <p className="text-[11px] text-amber-700 mt-2 leading-snug">
          {t('track.preConfirmationHint')}
        </p>
      )}

      {/* Inline rating form — appears once this individual item is served. */}
      {canReview && onReviewSaved && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <RateItemRow orderItem={item} onSaved={onReviewSaved} />
        </div>
      )}
      {isServed && !feedbackUnlocked && (
        <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
          {t('track.feedbackLockedHint')}
        </p>
      )}
    </div>
  );
}

/* ── Resolved dispute card ───────────────────────────────── */
function ResolvedDisputeCard({ dispute }: { dispute: any }) {
  const { t } = useTranslation();
  const label = DISPUTE_STATUS_STYLE[dispute.status]
    ? t(`track.disputeStatus${dispute.status}`)
    : '';
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 space-y-3 border border-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <p className="text-sm font-bold text-slate-800">{t('track.disputeBadge', { label })}</p>
        </div>
        <span className="text-xs text-slate-400">
          {new Date(dispute.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
        <div>
          <p className="text-xs text-slate-400 font-semibold mb-0.5">{t('track.yourConcern')}</p>
          <p className="text-sm text-slate-700">{dispute.description}</p>
        </div>
        {dispute.resolution && (
          <div className="border-t border-slate-100 pt-2">
            <p className="text-xs text-emerald-600 font-semibold mb-0.5">{t('track.outletResolution')}</p>
            <p className="text-sm text-slate-700">{dispute.resolution}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FavoriteHeart({ itemId, initial }: { itemId: string; initial?: boolean }) {
  const { t } = useTranslation();
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
      title={fav ? t('track.favouriteRemove') : t('track.favouriteAdd')}
    >
      <Heart size={12} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ── Inline rating UI used inside ItemProgressRow once item is SERVED ── */
function RateItemRow({ orderItem, onSaved }: { orderItem: any; onSaved: (review: any) => void }) {
  const { t } = useTranslation();
  const existing = orderItem.review;
  const [rating, setRating]   = useState<number>(existing?.rating ?? 0);
  const [comment, setComment] = useState<string>(existing?.comment ?? '');
  const [hover, setHover]     = useState<number>(0);
  const [busy, setBusy]       = useState(false);
  const dirty =
    rating !== (existing?.rating ?? 0) ||
    (comment.trim() || '') !== ((existing?.comment ?? '').trim() || '');

  const save = async () => {
    if (!rating) { toast.error(t('track.ratingFailed')); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/order-items/${orderItem.id}/review`, {
        rating,
        comment: comment.trim() || null,
      });
      onSaved(data.data);
      toast.success(existing ? t('track.ratingUpdated') : t('track.ratingThanks'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('track.ratingSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
        <Star size={11} className="text-amber-500" fill="currentColor" /> {t('track.rateThisDish')}
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
            aria-label={t('track.ratingStarsAria', { count: n })}
          >
            <Star
              size={22}
              className={clsx('transition-colors', (hover || rating) >= n ? 'text-amber-400' : 'text-slate-200')}
              fill={(hover || rating) >= n ? 'currentColor' : 'none'}
            />
          </button>
        ))}
        {rating > 0 && <span className="ml-1 text-xs font-bold text-slate-500">{t('track.starsOfFive', { rating })}</span>}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('track.ratingPlaceholder')}
        rows={2}
        className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-brand-400 resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400">
          {existing
            ? t('track.lastUpdated', { date: new Date(existing.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) })
            : t('track.notRatedYet')}
        </span>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="text-xs font-bold bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl"
        >
          {busy ? t('track.saving') : existing ? t('track.update') : t('track.submit')}
        </button>
      </div>

      {/* Manager reply (read-only on the customer side) */}
      {existing?.replyText && (
        <div className="bg-slate-50 rounded-xl p-3 border-l-4 border-brand-300">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            {existing.replyBy?.name ? t('track.replyFrom', { name: existing.replyBy.name }) : t('track.replyLabel')}
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">{existing.replyText}</p>
        </div>
      )}

      {/* Payback acknowledgement */}
      {existing?.paybackPayment && (
        <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-700">
            {t('track.refundReceived', { amount: Number(existing.paybackPayment.amount).toFixed(2), mode: existing.paybackPayment.mode })}
          </span>
        </div>
      )}
    </div>
  );
}
