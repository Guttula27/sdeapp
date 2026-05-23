import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ChefHat, Timer, CheckCircle2, Flame, Play, Bell, X, Utensils } from 'lucide-react';
import { RootState } from '../../store';
import { getSocket } from '../../services/socket';
import api from '../../services/api';
import { useUserRole } from '../../hooks/useUserRole';

// Statuses considered "live" in the kitchen workflow — the default view.
const ACTIVE_KITCHEN_STATUSES = ['CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE'] as const;
const KITCHEN_FILTERS = ['ACTIVE', ...ACTIVE_KITCHEN_STATUSES, 'SERVED', 'CANCELLED'] as const;
type KitchenFilter = typeof KITCHEN_FILTERS[number];
const FILTER_LABEL: Record<KitchenFilter, string> = {
  ACTIVE: 'Active',
  CREATED: 'New',
  QUEUED: 'Queued',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_SERVICE: 'Out for Service',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};

type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

const ITEM_STATUS: Record<ItemStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { label: 'Pending',   bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  PREPARING: { label: 'Preparing', bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  READY:     { label: 'Ready',     bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#10b981' },
  SERVED:    { label: 'Served',    bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', dot: '#14b8a6' },
  CANCELLED: { label: 'Cancelled', bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#ef4444' },
};

const NEXT_ITEM: Partial<Record<ItemStatus, ItemStatus>> = {
  PENDING:   'PREPARING',
  PREPARING: 'READY',
  READY:     'SERVED',
};

const NEXT_ITEM_LABEL: Partial<Record<ItemStatus, { label: string; icon: any }>> = {
  PENDING:   { label: 'Start',  icon: Play },
  PREPARING: { label: 'Ready',  icon: Bell },
  READY:     { label: 'Served', icon: Utensils },
};

const STEP_ORDER: ItemStatus[] = ['PENDING', 'PREPARING', 'READY', 'SERVED'];

function timerColor(mins: number) {
  if (mins < 10) return { card: '#f0fdf4', border: '#86efac', timer: '#15803d', badge: '#dcfce7', badgeText: '#166534' };
  if (mins < 20) return { card: '#fff7ed', border: '#fdba74', timer: '#c2410c', badge: '#ffedd5', badgeText: '#9a3412' };
  return       { card: '#fff1f2', border: '#fca5a5', timer: '#be123c', badge: '#ffe4e6', badgeText: '#9f1239' };
}

export default function KitchenPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  // Business owners shouldn't operate kitchens — that's outlet-level.
  if (tier === 'business') return <Navigate to="/dashboard" replace />;
  const readOnly = tier === 'platform';
  const [orders, setOrders] = useState<any[]>([]);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [myStation, setMyStation] = useState<{ id: string; name: string; isMaster?: boolean } | null>(null);
  const [filter, setFilter] = useState<KitchenFilter>('ACTIVE');
  const outletId = user?.outletId || 'demo-outlet';

  const fetchForFilter = useCallback(async (f: KitchenFilter) => {
    const statuses = f === 'ACTIVE' ? [...ACTIVE_KITCHEN_STATUSES] : [f];
    const results = await Promise.all(
      statuses.map((s) => api.get(`/outlets/${outletId}/orders`, { params: { status: s, limit: 100 } })),
    );
    const merged = results.flatMap((r) => r.data.data.orders || []);
    const seen = new Set<string>();
    const unique = merged.filter((o) => !seen.has(o.id) && seen.add(o.id));
    // Oldest first so the kitchen sees the longest-waiting order at the top.
    unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setOrders(unique);
  }, [outletId]);

  useEffect(() => {
    api.get(`/outlets/${outletId}/kitchen-stations/mine`)
      .then(r => setMyStation(r.data.data || null))
      .catch(() => setMyStation(null));
  }, [outletId]);

  useEffect(() => { fetchForFilter(filter).catch(() => {}); }, [filter, fetchForFilter]);

  useEffect(() => {
    const socket = getSocket(outletId);
    socket.emit('joinKitchen', outletId);

    const matchesCurrentFilter = (status: string) =>
      filter === 'ACTIVE'
        ? (ACTIVE_KITCHEN_STATUSES as readonly string[]).includes(status)
        : status === filter;

    const onCreated = (o: any) => {
      if (matchesCurrentFilter(o.status)) {
        setOrders((p) => {
          if (p.some((x) => x.id === o.id)) return p;
          const next = [...p, o];
          next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return next;
        });
        toast('🔔 New order!', { duration: 5000 });
      }
    };
    const onUpdated = (o: any) => {
      setOrders((p) => {
        const exists = p.some((x) => x.id === o.id);
        if (!matchesCurrentFilter(o.status)) {
          return exists ? p.filter((x) => x.id !== o.id) : p;
        }
        if (exists) return p.map((x) => (x.id === o.id ? o : x));
        const next = [...p, o];
        next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return next;
      });
    };

    socket.on('orderCreated', onCreated);
    socket.on('orderStatusUpdated', onUpdated);

    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      socket.off('orderCreated', onCreated);
      socket.off('orderStatusUpdated', onUpdated);
      clearInterval(interval);
    };
  }, [outletId, filter]);

  const advanceItem = async (orderId: string, itemId: string, currentStatus: ItemStatus) => {
    const next = NEXT_ITEM[currentStatus];
    if (!next) return;
    setPendingItem(itemId);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${orderId}/items/${itemId}/status`, { status: next });
      // Backend returns { order, rolledUp }; the socket emit will refresh too, but update local immediately
      if (data.data?.order) {
        setOrders(p => {
          const updated = data.data.order;
          if (['SERVED', 'CANCELLED', 'RESOLVED', 'REFUND_COMPLETE'].includes(updated.status)) {
            return p.filter(o => o.id !== orderId);
          }
          return p.map(o => o.id === orderId ? updated : o);
        });
      }
      if (data.data?.rolledUp) {
        toast.success(`Order moved to ${data.data.rolledUp}`);
      }
    } catch (e: any) { toast.error(e.response?.data?.message || 'Update failed'); }
    finally { setPendingItem(null); }
  };

  const cancelItem = async (orderId: string, itemId: string) => {
    if (!confirm('Cancel this item?')) return;
    setPendingItem(itemId);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${orderId}/items/${itemId}/status`, { status: 'CANCELLED' });
      if (data.data?.order) {
        setOrders(p => p.map(o => o.id === orderId ? data.data.order : o));
      }
      toast.success('Item cancelled');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Cancel failed'); }
    finally { setPendingItem(null); }
  };

  const mins = (t: string) => Math.floor((Date.now() - new Date(t).getTime()) / 60000);

  const visibleOrders = !myStation || myStation.isMaster
    ? orders
    : orders
        .map((o) => ({
          ...o,
          items: (o.items || []).filter((it: any) => it.item?.kitchenStationId === myStation.id),
        }))
        .filter((o) => o.items.length > 0);

  // Aggregate item quantities for the panel — only "active" items (excludes
  // per-item SERVED / CANCELLED so totals reflect outstanding kitchen work).
  const itemAggregates = (() => {
    const totals: Record<string, { name: string; variant?: string; pending: number; preparing: number; ready: number }> = {};
    for (const o of visibleOrders) {
      for (const it of (o.items || [])) {
        const status = it.status || 'PENDING';
        if (status === 'SERVED' || status === 'CANCELLED') continue;
        const key = `${it.item?.id || it.item?.name || 'item'}|${it.variantId || ''}`;
        if (!totals[key]) {
          totals[key] = {
            name: it.item?.name || 'Item',
            variant: it.variant?.name,
            pending: 0,
            preparing: 0,
            ready: 0,
          };
        }
        const qty = it.quantity || 0;
        if (status === 'PENDING') totals[key].pending += qty;
        else if (status === 'PREPARING') totals[key].preparing += qty;
        else if (status === 'READY') totals[key].ready += qty;
      }
    }
    return Object.values(totals)
      .map((r) => ({ ...r, total: r.pending + r.preparing + r.ready }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  })();
  const grandTotal = itemAggregates.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-gradient-orange">
            <ChefHat size={18} />
          </div>
          <div>
            <h1 className="page-title">Kitchen Display</h1>
            <p className="page-subtitle">
              {myStation
                ? myStation.isMaster
                  ? `${myStation.name} (master) — all items`
                  : `${myStation.name} station only`
                : readOnly ? 'Per-item live tracking (view-only)' : 'Per-item live tracking'}
            </p>
          </div>
          {myStation && (
            <span className="ml-1 text-[10px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
              {myStation.name.toUpperCase()}
            </span>
          )}
          {readOnly && (
            <span className="ml-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              VIEW ONLY
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {visibleOrders.length > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-xl text-sm font-bold">
              <Flame size={14} /> {visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} active
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl">
            <span className="dot-live" /> Live
          </div>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="card p-3 flex flex-wrap gap-1.5">
        {KITCHEN_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx('filter-pill', filter === f ? 'filter-pill-active' : 'filter-pill-inactive')}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Orders grid + item-totals panel */}
      {visibleOrders.length === 0 ? (
        <div className="card empty-state" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="empty-state-icon" style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' }}>
            <CheckCircle2 size={26} className="text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-emerald-800">
            {myStation ? `No ${myStation.name} items pending` : filter === 'ACTIVE' ? 'Kitchen is clear!' : `No ${FILTER_LABEL[filter].toLowerCase()} orders`}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            {filter === 'ACTIVE' ? 'No pending orders — great job! 🎉' : 'Try a different status.'}
          </p>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
          {visibleOrders.map(order => {
            const m   = mins(order.createdAt);
            const clr = timerColor(m);
            return (
              <div key={order.id} className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: clr.card, border: `2px solid ${clr.border}`, boxShadow: '0 2px 8px rgb(0 0 0 / .06)' }}>
                {/* Header */}
                <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${clr.border}` }}>
                  <div>
                    <p className="text-xl font-black text-slate-900">{order.orderNumber}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {order.table && <p className="text-sm font-semibold text-slate-600">Table {order.table.number}</p>}
                      {order.isParcel && <span className="badge badge-blue">Parcel</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 font-black text-2xl" style={{ color: clr.timer }}>
                      <Timer size={18} /> {m}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: clr.badge, color: clr.badgeText }}>
                      {m < 10 ? 'On time' : m < 20 ? 'Running late' : 'Urgent!'}
                    </span>
                  </div>
                </div>

                {/* Items — each with its own status + progress + actions */}
                <div className="flex-1 px-4 py-3 space-y-3">
                  {order.items?.map((item: any) => {
                    const status = (item.status || 'PENDING') as ItemStatus;
                    const s = ITEM_STATUS[status];
                    const next = NEXT_ITEM[status];
                    const nextLabel = NEXT_ITEM_LABEL[status];
                    const isBusy = pendingItem === item.id;
                    const stepIdx = STEP_ORDER.indexOf(status);
                    const isTerminal = status === 'SERVED' || status === 'CANCELLED';

                    return (
                      <div key={item.id} className="bg-white rounded-xl p-3 border border-slate-100">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                            {item.quantity}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-sm truncate">{item.item?.name}</p>
                                {item.variant && <p className="text-xs text-slate-500">{item.variant.name}</p>}
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                                style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                                {s.label}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg mt-1.5 italic">
                                {item.notes}
                              </p>
                            )}

                            {/* Step bar */}
                            {status !== 'CANCELLED' && (
                              <div className="flex items-center gap-1 mt-2.5">
                                {STEP_ORDER.map((step, i) => (
                                  <span
                                    key={step}
                                    className="h-1.5 flex-1 rounded-full transition-colors"
                                    style={{
                                      background: i <= stepIdx ? ITEM_STATUS[step].dot : '#e2e8f0',
                                    }}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            {!isTerminal && !readOnly && (
                              <div className="flex items-center gap-2 mt-2.5">
                                {next && nextLabel && (
                                  <button
                                    onClick={() => advanceItem(order.id, item.id, status)}
                                    disabled={isBusy}
                                    className={clsx(
                                      'flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-all',
                                      isBusy ? 'opacity-50 cursor-not-allowed' : ''
                                    )}
                                    style={{
                                      background: status === 'READY'
                                        ? 'linear-gradient(135deg,#14b8a6,#0d9488)'
                                        : status === 'PREPARING'
                                          ? 'linear-gradient(135deg,#10b981,#059669)'
                                          : 'linear-gradient(135deg,#f97316,#ea580c)',
                                      color: '#fff',
                                    }}
                                  >
                                    <nextLabel.icon size={13} /> {nextLabel.label}
                                  </button>
                                )}
                                <button
                                  onClick={() => cancelItem(order.id, item.id)}
                                  disabled={isBusy}
                                  className="w-8 h-8 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Cancel item"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {order.notes && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="text-amber-500 text-sm shrink-0">⚠</span>
                      <p className="text-xs text-amber-800">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Item totals panel — only meaningful while looking at active work */}
        {filter === 'ACTIVE' && (
          <aside className="w-72 shrink-0 hidden xl:flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden self-stretch">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Item Totals</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Across {visibleOrders.length} active order{visibleOrders.length === 1 ? '' : 's'}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {itemAggregates.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">No active items</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-slate-400 text-[10px] uppercase">
                    <tr>
                      <th className="text-left font-bold py-1.5">Item</th>
                      <th className="text-right font-bold py-1.5 px-1" title="Pending">P</th>
                      <th className="text-right font-bold py-1.5 px-1" title="Preparing">Pr</th>
                      <th className="text-right font-bold py-1.5 px-1" title="Ready">R</th>
                      <th className="text-right font-bold py-1.5">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {itemAggregates.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-slate-800 truncate">
                          {r.name}
                          {r.variant && <span className="text-slate-400"> ({r.variant})</span>}
                        </td>
                        <td className="py-1.5 text-right text-slate-500">{r.pending || ''}</td>
                        <td className="py-1.5 text-right text-orange-600">{r.preparing || ''}</td>
                        <td className="py-1.5 text-right text-emerald-600">{r.ready || ''}</td>
                        <td className="py-1.5 text-right font-bold text-slate-900">{r.total}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200">
                      <td className="py-1.5 font-bold text-slate-800" colSpan={4}>Total</td>
                      <td className="py-1.5 font-black text-slate-900 text-right">{grandTotal}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        )}
        </div>
      )}
    </div>
  );
}
