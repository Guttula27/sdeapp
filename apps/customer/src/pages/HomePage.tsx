import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  ShoppingBag, Clock, ChevronRight, ChefHat, CheckCircle2,
  XCircle, Package2, RefreshCw, Flame, Bell, Star, X,
} from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useCustomerAlerts } from '../context/CustomerAlertsContext';

const STATUS = {
  CREATED:         { label: 'Placed',          cls: 'bg-blue-100 text-blue-700',      icon: Clock },
  QUEUED:          { label: 'Queued',          cls: 'bg-yellow-100 text-yellow-700',  icon: CheckCircle2 },
  PREPARING:       { label: 'Preparing',       cls: 'bg-orange-100 text-orange-700',  icon: ChefHat },
  READY:           { label: 'Ready',           cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  OUT_FOR_SERVICE: { label: 'On its way',      cls: 'bg-teal-100 text-teal-700',      icon: Package2 },
  SERVED:          { label: 'Served',          cls: 'bg-slate-100 text-slate-600',    icon: CheckCircle2 },
  CANCELLED:       { label: 'Cancelled',       cls: 'bg-red-100 text-red-600',        icon: XCircle },
  DISPUTED:        { label: 'Disputed',        cls: 'bg-purple-100 text-purple-700',  icon: XCircle },
  RESOLVED:        { label: 'Resolved',        cls: 'bg-sky-100 text-sky-700',        icon: CheckCircle2 },
  FOR_REFUND:      { label: 'Refund pending',  cls: 'bg-pink-100 text-pink-700',      icon: Clock },
  REFUND_COMPLETE: { label: 'Refund complete', cls: 'bg-purple-100 text-purple-700',  icon: CheckCircle2 },
} as const;

type OrderStatus = keyof typeof STATUS;
const ACTIVE_STATUSES: OrderStatus[] = ['CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE'];

function homeElapsed(t: string) {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Order {
  id: string;
  orderNumber: string;
  tokenNumber?: number | null;
  status: OrderStatus;
  totalAmount: string;
  createdAt: string;
  isParcel: boolean;
  isPostpaid?: boolean;
  billRequestedAt?: string | null;
  tableId?: string | null;
  outlet: { id: string; name: string };
  items: Array<{ id: string; quantity: number; item: { name: string }; review?: { id: string; rating: number } | null }>;
  clusterOrderId?: string | null;
  clusterOrder?: {
    id: string;
    clusterOrderNumber: string;
    paymentStatus: string;
    clusterBusiness: { id: string; name: string; logoUrl?: string | null; publicCode?: string | null };
  } | null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/orders/history?page=1&limit=20');
      setOrders(data.data.orders || []);
    } catch {
      // Silent — banner/toasts intentionally suppressed on the home screen.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const past   = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));

  // Group active orders so that the N child orders from a single cluster
  // checkout render under one shared header — visually they belong together
  // because the customer paid once. Standalone orders stay individual.
  const activeGroups: Array<{
    clusterOrderId: string | null;
    clusterName?: string;
    clusterLogo?: string | null;
    clusterPublicCode?: string | null;
    orders: Order[];
  }> = [];
  const seenClusters = new Set<string>();
  for (const o of active) {
    if (o.clusterOrderId && o.clusterOrder) {
      if (seenClusters.has(o.clusterOrderId)) continue;
      seenClusters.add(o.clusterOrderId);
      activeGroups.push({
        clusterOrderId: o.clusterOrderId,
        clusterName: o.clusterOrder.clusterBusiness.name,
        clusterLogo: o.clusterOrder.clusterBusiness.logoUrl,
        clusterPublicCode: o.clusterOrder.clusterBusiness.publicCode,
        orders: active.filter((x) => x.clusterOrderId === o.clusterOrderId),
      });
    } else {
      activeGroups.push({ clusterOrderId: null, orders: [o] });
    }
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 pt-10 pb-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-slate-400 text-sm">Hello,</p>
            <p className="text-2xl font-black text-white">{user?.name?.split(' ')[0] || 'there'} 👋</p>
          </div>
          <AlertsBellButton />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* Active order */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Flame size={14} className="text-brand-500" /> Current Order
            </h2>
            <button onClick={fetch} disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-100 rounded-2xl h-28 animate-pulse" />
          ) : active.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center mb-2">
                <ShoppingBag size={18} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No active order</p>
              <p className="text-xs text-slate-400 mt-0.5">Scan a QR to place one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGroups.map((g, gi) => g.clusterOrderId ? (
                /* Cluster group — N child orders under one header */
                <div key={g.clusterOrderId} className="bg-white rounded-2xl border border-indigo-100 overflow-hidden">
                  <div
                    className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex items-center gap-2 cursor-pointer"
                    onClick={() => g.clusterPublicCode && navigate(`/cluster/${g.clusterPublicCode}`)}
                  >
                    {g.clusterLogo ? (
                      <img src={g.clusterLogo} alt="" className="w-7 h-7 rounded-lg object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">FC</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Food court order</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{g.clusterName}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {g.orders.length} outlet{g.orders.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {g.orders.map(o => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        active
                        compactGroup
                        onTrack={() => navigate(`/track/${o.id}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* Standalone — original look */
                g.orders.map(o => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    active
                    onTrack={() => navigate(`/track/${o.id}`)}
                    onPay={() => navigate('/pay', {
                      state: {
                        outletId: o.outlet.id,
                        tableId: o.tableId,
                        billOrderId: o.id,
                        total: Number(o.totalAmount),
                        outletName: o.outlet.name,
                      },
                    })}
                  />
                ))
              ))}
            </div>
          )}
        </section>

        {/* Feedback nudge — surfaces the most recent SERVED order that still
            has unrated items. Hidden once everything has been rated or
            permanently dismissed for this session. */}
        <FeedbackPrompt orders={past} />

        {/* Past orders */}
        <section className="pb-4">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Past Orders</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
          ) : past.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No past orders yet.</p>
          ) : (
            <div className="space-y-2">
              {past.map(o => (
                <OrderCard key={o.id} order={o} onTrack={() => navigate(`/track/${o.id}`)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OrderCard({ order, active, compactGroup, onTrack, onPay }: { order: Order; active?: boolean; compactGroup?: boolean; onTrack: () => void; onPay?: () => void }) {
  const s = STATUS[order.status] || STATUS.SERVED;
  const items = order.items.map(i => `${i.item.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ');
  // Bill requested but not yet paid → swap the Track button for Pay now so
  // the customer doesn't have to drill into the tracking page first.
  const billReady = !!(order.isPostpaid && order.billRequestedAt && !['SERVED','CANCELLED','REFUND_COMPLETE'].includes(order.status));
  // compactGroup: this card is being rendered INSIDE a cluster group header,
  // so we strip the outer border/shadow + the top brand strip (the group
  // header carries the cluster branding instead).
  if (compactGroup) {
    return (
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900">{order.outlet.name}</p>
              {order.tokenNumber != null && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  #{order.tokenNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{order.orderNumber} · {homeElapsed(order.createdAt)} ago</p>
          </div>
          <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', s.cls)}>
            <s.icon size={9} /> {s.label}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-1">{items}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-black text-slate-900">₹{Number(order.totalAmount).toFixed(0)}</span>
          <button onClick={onTrack} className="text-[11px] font-bold text-brand-600 inline-flex items-center gap-1 hover:text-brand-700">
            Track <ChevronRight size={11} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={clsx('bg-white rounded-2xl border shadow-sm overflow-hidden',
      active ? 'border-brand-200' : 'border-slate-100')}>
      {active && <div className="h-1 bg-gradient-to-r from-brand-500 to-orange-400" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-slate-900">{order.orderNumber}</p>
              {order.tokenNumber != null && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  Token #{order.tokenNumber}
                </span>
              )}
              {billReady && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full">
                  Bill ready
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {order.outlet.name} · {homeElapsed(order.createdAt)} ago
            </p>
          </div>
          <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', s.cls)}>
            <s.icon size={9} /> {s.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 line-clamp-1 mb-3">{items}</p>
        <div className="flex items-center justify-between">
          <p className="text-base font-black text-slate-900">₹{Number(order.totalAmount).toFixed(0)}</p>
          {billReady && onPay ? (
            <button onClick={onPay}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors">
              Pay now <ChevronRight size={12} />
            </button>
          ) : (
            <button onClick={onTrack}
              className={clsx('flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors',
                active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {active ? 'Track' : 'View'} <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertsBellButton() {
  const navigate = useNavigate();
  const { unreadCount } = useCustomerAlerts();
  return (
    <button
      onClick={() => navigate('/alerts')}
      className="relative w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      aria-label="Alerts"
    >
      <Bell size={18} className="text-white" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

/* ── Feedback nudge ─────────────────────────────────────────────
   Picks the most recent SERVED order with at least one unrated item and
   invites the customer to rate it. A small ✕ dismisses for the session. */
function FeedbackPrompt({ orders }: { orders: Order[] }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem('feedback-prompt-dismissed') === '1'; } catch { return false; }
  });
  const target = orders.find(
    o => o.status === 'SERVED' && o.items.some(i => !i.review),
  );
  if (dismissed || !target) return null;
  const unratedCount = target.items.filter(i => !i.review).length;
  return (
    <section className="mb-3">
      <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-100 relative">
        <button
          onClick={() => {
            setDismissed(true);
            try { sessionStorage.setItem('feedback-prompt-dismissed', '1'); } catch {}
          }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/60 flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Star size={18} fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">How was your order?</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Your feedback will be valuable for improving our services and also help other customers like you choose better.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/track/${target.id}`)}
          className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs py-2.5 rounded-xl shadow"
        >
          Rate {unratedCount === 1 ? 'this item' : `${unratedCount} items`} on {target.outlet.name}
        </button>
      </div>
    </section>
  );
}
