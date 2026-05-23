import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Search, Clock, ShoppingBag, ArrowRight, X, RefreshCw, Eye, Play, Bell, Utensils, Plus, Tag as TagIcon, User, Download } from 'lucide-react';
import { RootState } from '../../store';
import { setOrders, updateOrder } from '../../store/slices/ordersSlice';
import { getSocket } from '../../services/socket';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';
import ThermalReceipt from '../../components/receipt/ThermalReceipt';
import { downloadReceiptPdf } from '../../components/receipt/downloadReceiptPdf';
import Modal from '../../components/common/Modal';

const STATUS: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  CREATED:         { label: 'Created',         dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  QUEUED:          { label: 'Queued',          dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  PREPARING:       { label: 'Preparing',       dot: '#f97316', bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  READY:           { label: 'Ready',           dot: '#10b981', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  OUT_FOR_SERVICE: { label: 'Out for Service', dot: '#14b8a6', bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
  SERVED:          { label: 'Served',          dot: '#64748b', bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  CANCELLED:       { label: 'Cancelled',       dot: '#ef4444', bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  DISPUTED:        { label: 'Disputed',        dot: '#8b5cf6', bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  RESOLVED:        { label: 'Resolved',        dot: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
  FOR_REFUND:      { label: 'For Refund',      dot: '#ec4899', bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  REFUND_COMPLETE: { label: 'Refund Complete', dot: '#a855f7', bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
};
// Manual order-level transitions — mid-stages (QUEUED → PREPARING → READY) are
// driven automatically by item statuses (rollup in the backend). After READY
// the path depends on outletType + whether the order is on a table:
//   * SELF_SERVICE, SELF_SERVICE_PARCEL  → READY → SERVED (counter collect)
//   * HYBRID without tableId             → READY → SERVED (parcel/counter)
//   * HYBRID with tableId                → READY → OUT_FOR_SERVICE → SERVED
//   * DINE_IN_PREPAID / DINE_IN_POSTPAID → READY → OUT_FOR_SERVICE → SERVED
function needsOutForService(outletType?: string | null, tableId?: string | null) {
  switch (outletType) {
    case 'SELF_SERVICE':
    case 'SELF_SERVICE_PARCEL': return false;
    case 'HYBRID':              return !!tableId;
    case 'DINE_IN_PREPAID':
    case 'DINE_IN_POSTPAID':    return true;
    default:                    return true;
  }
}
type StatusCtx = { outletType?: string | null; tableId?: string | null };
function nextStatusFor(current: string, ctx: StatusCtx): { next: string; label: string } | null {
  if (current === 'CREATED')         return { next: 'QUEUED', label: 'Accept' };
  if (current === 'OUT_FOR_SERVICE') return { next: 'SERVED', label: 'Mark Served' };
  if (current === 'FOR_REFUND')      return { next: 'REFUND_COMPLETE', label: 'Mark Refunded' };
  if (current === 'READY') {
    return needsOutForService(ctx.outletType, ctx.tableId)
      ? { next: 'OUT_FOR_SERVICE', label: 'Out for Service' }
      : { next: 'SERVED',          label: 'Mark Served' };
  }
  return null;
}
const FILTERS = ['ACTIVE','ALL','CREATED','QUEUED','PREPARING','READY','OUT_FOR_SERVICE','SERVED','CANCELLED','DISPUTED','RESOLVED','FOR_REFUND','REFUND_COMPLETE'];
const FILTER_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  ALL: 'All',
};
// Terminal states excluded from the default "Active" view.
const TERMINAL_STATUSES = new Set(['SERVED', 'CANCELLED']);

type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

const ITEM_STATUS: Record<ItemStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { label: 'Pending',   bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  PREPARING: { label: 'Preparing', bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  READY:     { label: 'Ready',     bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#10b981' },
  SERVED:    { label: 'Served',    bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', dot: '#14b8a6' },
  CANCELLED: { label: 'Cancelled', bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#ef4444' },
};
const NEXT_ITEM: Partial<Record<ItemStatus, { status: ItemStatus; label: string; icon: any }>> = {
  PENDING:   { status: 'PREPARING', label: 'Start',  icon: Play },
  PREPARING: { status: 'READY',     label: 'Ready',  icon: Bell },
  READY:     { status: 'SERVED',    label: 'Served', icon: Utensils },
};
const STEP_ORDER: ItemStatus[] = ['PENDING', 'PREPARING', 'READY', 'SERVED'];

function elapsed(t: string) {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h${m%60}m`;
}

export default function OrdersPage() {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const { orders } = useSelector((s: RootState) => s.orders);
  const [filter, setFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const downloadDetailReceipt = () => {
    if (!receiptRef.current || !detail) return;
    downloadReceiptPdf(receiptRef.current, `Receipt-${detail.orderNumber}`);
  };
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const isReadOnly  = tier === 'platform' || tier === 'business' || tier === 'kitchen';
  const canAccept   = tier === 'kitchen'; // chef can accept NEW orders but nothing else

  // Station scope: kitchen + counter (service desk) users only see items routed to their station
  const [myStation, setMyStation] = useState<{ id: string; name: string; isMaster?: boolean } | null>(null);
  useEffect(() => {
    if (tier !== 'kitchen' && tier !== 'counter') return;
    api.get(`/outlets/${user?.outletId || 'demo-outlet'}/kitchen-stations/mine`)
      .then(r => setMyStation(r.data.data || null))
      .catch(() => setMyStation(null));
  }, [tier, user?.outletId]);
  const visibleItems = (items: any[]) =>
    !myStation || myStation.isMaster
      ? items
      : items.filter((it: any) => it.item?.kitchenStationId === myStation.id);
  const outletId    = user?.outletId  || 'demo-outlet';
  const businessId  = user?.businessId;

  // Business owners pick which outlet's orders to view. Default = "all" (the
  // existing cross-outlet behaviour) so the dashboard is still useful.
  const [businessOutlets, setBusinessOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('ALL');
  useEffect(() => {
    if (tier !== 'business' || !businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then((r) => setBusinessOutlets(r.data.data || []))
      .catch(() => setBusinessOutlets([]));
  }, [tier, businessId]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      if (tier === 'platform') {
        const { data } = await api.get(`/orders?limit=100`);
        dispatch(setOrders(data.data.orders));
      } else if (tier === 'business' && businessId) {
        if (selectedOutletId !== 'ALL') {
          const { data } = await api.get(`/outlets/${selectedOutletId}/orders`, { params: { limit: 100 } });
          dispatch(setOrders(data.data.orders));
        } else {
          const { data } = await api.get(`/orders?businessId=${businessId}&limit=100`);
          dispatch(setOrders(data.data.orders));
        }
      } else {
        const { data } = await api.get(`/outlets/${outletId}/orders`);
        dispatch(setOrders(data.data.orders));
      }
    } finally { setLoading(false); }
  }, [tier, outletId, businessId, selectedOutletId]);

  useEffect(() => {
    fetchOrders();
    if (isReadOnly) return; // no per-outlet socket for cross-outlet views
    const socket = getSocket(outletId);
    socket.on('orderCreated', (o: any) => { dispatch(setOrders([o, ...orders])); toast.success(`New order — ${o.orderNumber}`); });
    socket.on('orderStatusUpdated', (o: any) => dispatch(updateOrder(o)));
    return () => { socket.off('orderCreated'); socket.off('orderStatusUpdated'); };
  }, [tier, outletId, businessId, selectedOutletId]);

  const advance = async (orderId: string, status: string) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${orderId}/status`, { status });
      dispatch(updateOrder(data.data));
      if (detail?.id === orderId) setDetail(data.data);
      toast.success(`→ ${STATUS[status].label}`);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const cancelOrder = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${cancelTarget.id}/cancel`, { reason: cancelReason });
      dispatch(updateOrder(data.data));
      if (detail?.id === cancelTarget.id) setDetail(data.data);
      toast.success('Order cancelled');
      setCancelTarget(null); setCancelReason('');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openDetail = async (order: any) => {
    const url = isReadOnly
      ? `/orders/${order.id}`
      : `/outlets/${order.outletId || outletId}/orders/${order.id}`;
    try { const { data } = await api.get(url); setDetail(data.data); }
    catch { setDetail(order); }
  };

  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const advanceItem = async (orderId: string, itemId: string, nextStatus: ItemStatus) => {
    setPendingItem(itemId);
    try {
      const targetOutlet = detail?.outletId || outletId;
      const { data } = await api.patch(`/outlets/${targetOutlet}/orders/${orderId}/items/${itemId}/status`, { status: nextStatus });
      if (data.data?.order) {
        const updated = data.data.order;
        dispatch(updateOrder(updated));
        if (detail?.id === orderId) setDetail(updated);
        if (data.data.rolledUp) toast.success(`Order moved to ${data.data.rolledUp}`);
        else toast.success('Item updated');
      }
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setPendingItem(null); }
  };

  const matchesFilter = (status: string) =>
    filter === 'ALL' ? true :
    filter === 'ACTIVE' ? !TERMINAL_STATUSES.has(status) :
    status === filter;
  const counts = FILTERS.reduce((a, f) => ({
    ...a,
    [f]: f === 'ALL' ? orders.length
       : f === 'ACTIVE' ? orders.filter(o => !TERMINAL_STATUSES.has(o.status)).length
       : orders.filter(o => o.status === f).length,
  }), {} as Record<string, number>);
  const filtered = orders.filter(o => matchesFilter(o.status) && (!search || o.orderNumber?.toLowerCase().includes(search.toLowerCase())));

  const renderOrderCard = (order: any) => {
    const s = STATUS[order.status] || STATUS.SERVED;
    const isNew = order.status === 'CREATED';
    const cardItems = visibleItems(order.items || []);
    // Hide cards that have no items relevant to my station
    if ((tier === 'kitchen' || tier === 'counter') && myStation && !myStation.isMaster && cardItems.length === 0) {
      return null;
    }

    // Find the common next per-item status (when all items share the same status)
    const liveItems = cardItems.filter((i: any) => i.status !== 'CANCELLED');
    const allSameStatus = liveItems.length > 0 && liveItems.every((i: any) => i.status === liveItems[0].status);
    const commonNext: any = allSameStatus ? NEXT_ITEM[liveItems[0].status as ItemStatus] : null;

    const advanceAll = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!commonNext) return;
      try {
        for (const it of liveItems) {
          await advanceItem(order.id, it.id, commonNext.status);
        }
      } catch { /* per-call toasts handle errors */ }
    };

    return (
      <div key={order.id} onClick={() => openDetail(order)}
        className={clsx('rounded-2xl border bg-white shadow-card overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow', isNew && 'ring-2 ring-blue-200')}
        style={{ borderColor: s.border }}
      >
        {/* Tinted header band — table, token, time, elapsed */}
        <div className="px-3 py-2" style={{ background: s.bg, color: s.text }}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] font-black flex items-center gap-1">
              <ShoppingBag size={12} />
              {order.table ? `Table ${order.table.number}` : order.isParcel ? 'Parcel' : 'Counter'}
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold">
              <Clock size={10} /> {elapsed(order.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            {order.tokenNumber != null && (
              <p className="text-[11px] font-bold">Token #{order.tokenNumber}</p>
            )}
            <p className="text-[10px] opacity-80">{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        {/* Items list with per-item advance */}
        <div className="px-3 py-2 flex-1 space-y-1.5" onClick={e => e.stopPropagation()}>
          {cardItems.map((item: any) => {
            const itStatus = (item.status || 'PENDING') as ItemStatus;
            const its = ITEM_STATUS[itStatus];
            const next = NEXT_ITEM[itStatus];
            const busy = pendingItem === item.id;
            const terminal = itStatus === 'SERVED' || itStatus === 'CANCELLED';
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: its.dot }}
                  title={its.label}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-slate-800 truncate">
                    {item.item?.name} <span className="text-slate-400">× {item.quantity}</span>
                  </p>
                  {item.variant && (
                    <p className="text-[10px] italic text-slate-400">{item.variant.name}</p>
                  )}
                </div>
                {!isReadOnly && !terminal && next && (
                  <button
                    onClick={() => advanceItem(order.id, item.id, next.status)}
                    disabled={busy}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                    title={`Mark ${next.label}`}
                  >
                    →
                  </button>
                )}
              </div>
            );
          })}
          {cardItems.length === 0 && (
            <p className="text-[10px] text-slate-400 italic text-center py-2">No items for your station</p>
          )}
        </div>

        {/* Footer — order-level actions */}
        <div className="px-3 py-2 border-t border-slate-50 flex items-center justify-between gap-2"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {!isReadOnly && commonNext && (
              <button
                onClick={advanceAll}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                title={`Mark all items as ${commonNext.label}`}
              >
                All → {commonNext.label}
              </button>
            )}
            {isReadOnly && canAccept && order.status === 'CREATED' && (
              <button onClick={() => advance(order.id, 'QUEUED')} disabled={saving} className="text-[10px] font-bold px-2 py-1 rounded-md bg-brand-500 text-white">
                Accept
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => openDetail(order)} className="btn-ghost p-1.5" title="Details">
              <Eye size={12} />
            </button>
            {!isReadOnly && ['CREATED','QUEUED','PREPARING','READY'].includes(order.status) && (
              <button onClick={() => setCancelTarget(order)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50" title="Cancel">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="page-title">Orders</h1>
            <p className="page-subtitle">
              {orders.length} {tier === 'platform' ? 'across the platform' : tier === 'business' ? 'across your outlets' : 'total orders today'}
            </p>
          </div>
          {isReadOnly && (
            <span className="badge badge-slate"><Eye size={10} /> View only</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tier === 'business' && businessOutlets.length > 0 && (
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="input py-2 text-sm"
              style={{ minWidth: 180 }}
            >
              <option value="ALL">All outlets</option>
              {businessOutlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <button className="btn-secondary" onClick={fetchOrders} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter + search bar */}
      <div className="card p-3 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order #…" className="input pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('filter-pill', filter === f ? 'filter-pill-active' : 'filter-pill-inactive')}>
              {FILTER_LABEL[f] ?? STATUS[f]?.label}
              {counts[f] > 0 && (
                <span className={clsx('inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ml-1',
                  filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-44 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><ShoppingBag size={22} className="text-slate-400" /></div>
          <p className="text-sm font-semibold text-slate-600">No orders found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filter or search</p>
        </div>
      ) : (
        <div className="flex gap-3" style={{ height: 'calc(100dvh - 240px)' }}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2 min-w-0">
            <div
              style={{
                columnWidth: '220px',
                columnGap: '14px',
                height: '100%',
              }}
            >
              {[...filtered]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map(order => {
                  const card = renderOrderCard(order);
                  if (!card) return null;
                  return (
                    <div
                      key={order.id}
                      className="mb-3"
                      style={{ breakInside: 'avoid' }}
                    >
                      {card}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Item Status aggregate panel */}
          <ItemStatusPanel orders={filtered} visibleItemsFn={visibleItems} />
        </div>
      )}


      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={`Order ${detail?.orderNumber}${detail?.tokenNumber != null ? `  ·  Token #${detail.tokenNumber}` : ''}`}
        subtitle={detail?.table ? `Table ${detail.table.number}` : detail?.isParcel ? 'Parcel Order' : 'Counter Order'}
        size="lg"
        footer={
          isReadOnly ? (
            <div className="flex items-center justify-between w-full">
              <span className="badge badge-slate"><Eye size={10} /> View only</span>
              <div className="flex items-center gap-2">
                {canAccept && detail?.status === 'CREATED' && (
                  <button onClick={() => advance(detail.id, 'QUEUED')} disabled={saving} className="btn-primary">
                    {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Accept <ArrowRight size={14} />
                  </button>
                )}
                <button onClick={() => setDetail(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              {detail && ['CREATED','QUEUED','PREPARING'].includes(detail.status) && (
                <button onClick={() => { setDetail(null); setCancelTarget(detail); }} className="btn-danger btn-sm">
                  <X size={13} /> Cancel
                </button>
              )}
              <div className="flex-1" />
              {(() => {
                if (!detail) return null;
                const step = nextStatusFor(detail.status, {
                  outletType: detail.outlet?.outletType,
                  tableId: detail.tableId,
                });
                if (!step) return null;
                return (
                  <button onClick={() => advance(detail.id, step.next)} disabled={saving} className="btn-primary">
                    {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {step.label} <ArrowRight size={14} />
                  </button>
                );
              })()}
              <button onClick={downloadDetailReceipt} className="btn-secondary">
                <Download size={14} /> Download Receipt
              </button>
              <button onClick={() => setDetail(null)} className="btn-secondary">Close</button>
            </div>
          )
        }>
        {detail && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: STATUS[detail.status]?.bg, border: `1px solid ${STATUS[detail.status]?.border}` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS[detail.status]?.dot }} />
              <span className="text-sm font-semibold" style={{ color: STATUS[detail.status]?.text }}>{STATUS[detail.status]?.label}</span>
            </div>

            {/* Customer + tag */}
            {detail.customer && (() => {
              const tag = detail.customer.customerTagAssignments?.find((a: any) => a.outletId === detail.outletId)?.customerTag;
              return (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 shrink-0 border border-slate-200">
                    <User size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{detail.customer.name || 'Customer'}</p>
                    <p className="text-xs text-slate-500">{detail.customer.phone}</p>
                  </div>
                  {tag && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: tag.color }}
                    >
                      <TagIcon size={10} /> {tag.name}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Items with per-item status */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Items</p>
              {detail.items?.map((item: any) => {
                const itemStatus = (item.status || 'PENDING') as ItemStatus;
                const s    = ITEM_STATUS[itemStatus];
                const next = NEXT_ITEM[itemStatus];
                const stepIdx = STEP_ORDER.indexOf(itemStatus);
                const isTerminal = itemStatus === 'SERVED' || itemStatus === 'CANCELLED';
                const isBusy = pendingItem === item.id;

                return (
                  <div key={item.id} className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-orange-100 text-orange-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                        {item.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.item?.name}</p>
                        {item.variant && <p className="text-xs text-slate-400">{item.variant.name}</p>}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                        {s.label}
                      </span>
                      <p className="text-sm font-bold text-slate-900 ml-1">₹{Number(item.totalPrice).toFixed(0)}</p>
                    </div>

                    {/* Step bar */}
                    {itemStatus !== 'CANCELLED' && (
                      <div className="flex items-center gap-1">
                        {STEP_ORDER.map((step, i) => (
                          <span key={step} className="h-1 flex-1 rounded-full transition-colors"
                            style={{ background: i <= stepIdx ? ITEM_STATUS[step].dot : '#e2e8f0' }} />
                        ))}
                      </div>
                    )}

                    {/* Per-item actions (only for editable roles + non-terminal) */}
                    {!isReadOnly && !isTerminal && (
                      <div className="flex items-center gap-2">
                        {next && (
                          <button
                            onClick={() => advanceItem(detail.id, item.id, next.status)}
                            disabled={isBusy}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 rounded-lg text-white disabled:opacity-50"
                            style={{
                              background:
                                itemStatus === 'READY'     ? 'linear-gradient(135deg,#14b8a6,#0d9488)' :
                                itemStatus === 'PREPARING' ? 'linear-gradient(135deg,#10b981,#059669)' :
                                                              'linear-gradient(135deg,#f97316,#ea580c)',
                            }}
                          >
                            <next.icon size={12} /> {next.label}
                          </button>
                        )}
                        <button
                          onClick={() => advanceItem(detail.id, item.id, 'CANCELLED')}
                          disabled={isBusy}
                          className="text-xs text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg"
                          title="Cancel item"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Totals */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>₹{Number(detail.subtotal).toFixed(2)}</span></div>
              {Number(detail.taxAmount) > 0 && (
                <>
                  <div className="flex justify-between text-xs text-slate-500"><span>SGST</span><span>₹{Number(detail.sgstAmount ?? Number(detail.taxAmount) / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>CGST</span><span>₹{Number(detail.cgstAmount ?? Number(detail.taxAmount) / 2).toFixed(2)}</span></div>
                </>
              )}
              {Number(detail.parcelAmount) > 0 && (
                <div className="flex justify-between text-xs text-slate-500"><span>Parcel</span><span>₹{Number(detail.parcelAmount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100"><span>Total</span><span>₹{Number(detail.totalAmount).toFixed(2)}</span></div>
            </div>

            {/* Payment breakdown */}
            {detail.payments?.length > 0 && (() => {
              const split: Record<string, number> = {};
              detail.payments
                .filter((p: any) => p.status === 'SUCCESS')
                .forEach((p: any) => { split[p.mode] = (split[p.mode] || 0) + Number(p.amount); });
              const labelFor: Record<string, string> = {
                CASH: 'Cash', UPI: 'UPI', CARD: 'Card', WALLET: 'Wallet', NET_BANKING: 'Net Banking',
              };
              const rows = Object.entries(split);
              if (rows.length === 0) return null;
              const paid = rows.reduce((s, [, v]) => s + v, 0);
              return (
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Paid via</p>
                  {rows.map(([mode, amount]) => (
                    <div key={mode} className="flex justify-between text-xs">
                      <span className="text-slate-600">{labelFor[mode] || mode}</span>
                      <span className="font-bold text-slate-800">₹{amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {paid < Number(detail.totalAmount) && (
                    <div className="flex justify-between text-[11px] text-amber-600 font-semibold">
                      <span>Balance due</span>
                      <span>₹{(Number(detail.totalAmount) - paid).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Timeline */}
            {detail.statusHistory?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Timeline</p>
                {detail.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS[h.status]?.dot }} />
                    <span className="font-medium text-slate-700">{STATUS[h.status]?.label}</span>
                    <span className="text-slate-400 ml-auto">{new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel modal */}
      <Modal open={!!cancelTarget} onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title="Cancel Order" subtitle={cancelTarget?.orderNumber} size="sm"
        footer={<><button className="btn-secondary" onClick={() => setCancelTarget(null)}>Back</button><button className="btn-danger" onClick={cancelOrder} disabled={saving}>Cancel Order</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">This action cannot be undone.</p>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Reason (optional)</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="input resize-none" rows={2} placeholder="Customer requested, out of stock…" />
          </div>
        </div>
      </Modal>

      {/* Off-screen receipt source for PDF export. Rendered only when an order
          is open in the detail modal; html2pdf rasterises this node on demand. */}
      {detail && (
        <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} aria-hidden>
          <ThermalReceipt ref={receiptRef} order={detail} />
        </div>
      )}
    </div>
  );
}

/* ── Item Status aggregate panel ─────────────────────────── */
const PANEL_TABS: { id: 'PENDING' | 'PREPARING' | 'READY'; label: string }[] = [
  { id: 'PENDING',   label: 'New' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'READY',     label: 'Ready' },
];

function ItemStatusPanel({ orders, visibleItemsFn }: { orders: any[]; visibleItemsFn: (items: any[]) => any[] }) {
  const [tab, setTab] = useState<'PENDING' | 'PREPARING' | 'READY'>('PENDING');

  // Aggregate item quantities by name + variant + status across all visible orders
  const totals: Record<string, number> = {};
  for (const o of orders) {
    for (const it of visibleItemsFn(o.items || [])) {
      if (it.status !== tab) continue;
      const label = `${it.item?.name || 'Item'}${it.variant ? ` (${it.variant.name})` : ''}`;
      totals[label] = (totals[label] || 0) + (it.quantity || 0);
    }
  }
  const rows = Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0]));
  const total = rows.reduce((s, [, q]) => s + q, 0);

  return (
    <aside className="w-64 shrink-0 hidden xl:flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Item Status</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Totals across visible orders</p>
      </div>
      <div className="px-2 pt-2 flex gap-1">
        {PANEL_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg ${
              tab === t.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">No items at this stage</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-400 text-[10px] uppercase">
              <tr><th className="text-left font-bold py-1.5">Item</th><th className="text-right font-bold py-1.5">Qty</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(([label, qty]) => (
                <tr key={label}>
                  <td className="py-1.5 text-slate-700 truncate">{label}</td>
                  <td className="py-1.5 font-bold text-slate-900 text-right">{qty}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200">
                <td className="py-1.5 font-bold text-slate-800">Total</td>
                <td className="py-1.5 font-black text-slate-900 text-right">{total}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </aside>
  );
}
