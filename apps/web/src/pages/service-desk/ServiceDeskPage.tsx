import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircle2, XCircle, ChefHat, Bell, Truck, Utensils, Clock, ChevronDown, ChevronUp, Maximize2, Minus, Plus, Armchair, Edit2, Banknote, Smartphone } from 'lucide-react';
import { RootState } from '../../store';
import { getSocket } from '../../services/socket';
import { useUserRole } from '../../hooks/useUserRole';
import { useFullscreen } from '../../hooks/useFullscreen';
import FullscreenToggle from '../../components/common/FullscreenToggle';
import api from '../../services/api';
import CoursePlanner from '../../components/orders/CoursePlanner';

type Lane = 'verify' | 'release' | 'pickup';

type OrderRow = {
  id: string;
  orderNumber: string;
  outletId: string;
  tableId: string | null;
  status: string;
  isPostpaid: boolean;
  billRequestedAt?: string | null;
  totalAmount?: string | number | null;
  createdAt: string;
  activeSequence?: number | null;
  sequenceLabels?: Record<string, string> | null;
  table?: { id: string; number: string; sectionId?: string | null; section?: { id: string; name: string } | null } | null;
  customer?: { id: string; name?: string | null; phone?: string | null } | null;
  payments?: Array<{ id: string; status: string; isRefund?: boolean; mode?: string }>;
  items: Array<{
    id: string;
    quantity: number;
    status: string;
    notes?: string | null;
    sequenceNumber?: number | null;
    item?: { id: string; name: string } | null;
    variant?: { id: string; name: string } | null;
  }>;
};

type Queue = { verify: OrderRow[]; release: OrderRow[]; pickup: OrderRow[] };

const EMPTY_QUEUE: Queue = { verify: [], release: [], pickup: [] };

const LANE_META: Record<Lane, { title: string; subtitle: string; tint: string; accent: string; icon: any }> = {
  verify: {
    title: 'Verify',
    subtitle: 'Postpaid lines awaiting your confirmation with the customer.',
    tint: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
    icon: ChefHat,
  },
  release: {
    title: 'Release',
    subtitle: 'Kitchen is done — move the dish to the pickup counter, then release.',
    tint: 'bg-sky-50 border-sky-200',
    accent: 'text-sky-700',
    icon: Bell,
  },
  pickup: {
    title: 'Pick up',
    subtitle: 'Kitchen is done — pick up from the pass and walk it to the table.',
    tint: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
    icon: Truck,
  },
};

// Cheap browser chime. No assets to manage and no AudioContext leak —
// the context is closed after the beep finishes.
function chime() {
  try {
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* sound is non-critical */
  }
}

function elapsedMins(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function ServiceDeskPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier, has } = useUserRole();
  // useFullscreen MUST sit above any conditional `return` below so the
  // Rules of Hooks aren't violated — earlier versions called it after
  // the outletId guard and the hook state ended up wired to the wrong
  // slot, which is why the toggle did nothing.
  const { ref: pageRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  // Outlet-tier admins always have access; everyone else needs the
  // explicit responsibility (Cashier role gets it by default).
  const allowed = tier === 'outlet' || tier === 'business' || has('VIEW_SERVICE_DESK');
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const outletId = user?.outletId || '';
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  // Open tabs — every unpaid postpaid order at this outlet, kept around
  // across verify → preparing → ready → served → bill → payment, only
  // disappearing once the payment lands. The service desk works
  // primarily from this surface; the original verify/release/pickup
  // lanes below stay for the task-focused views.
  const [openTabs, setOpenTabs] = useState<OrderRow[]>([]);

  // Outlet type drives which lanes render + whether Open Tabs is
  // populated at all. Self-service outlets don't have postpaid tabs
  // (no tables) and only need the Release lane — verify and pickup
  // are noise for them.
  const [outletType, setOutletType] = useState<string | null>(null);
  useEffect(() => {
    if (!outletId) return;
    api.get(`/outlets/${outletId}`)
      .then(({ data }) => setOutletType(data.data?.outletType ?? null))
      .catch(() => setOutletType(null));
  }, [outletId]);
  const isSelfService = outletType === 'SELF_SERVICE' || outletType === 'SELF_SERVICE_PARCEL';
  // Lanes to render for this outlet. Self-service collapses to a
  // single Release lane; the others stay hidden.
  const visibleLanes: Lane[] = isSelfService ? ['release'] : (['verify', 'release', 'pickup'] as Lane[]);
  // Add-item modal target. When non-null, the AddItemModal renders for
  // this specific order. Set from each tab card's "Add item" button —
  // also from the per-line "Replace" affordance, in which case
  // prefocusItemId carries the base Item id so the modal opens the
  // config sheet for that item immediately. Replace strikes the
  // existing line first, so the new one is what gets verified.
  const [addItemTarget, setAddItemTarget] = useState<{
    orderId: string;
    orderNumber: string;
    tableNumber?: string;
    prefocusItemId?: string;
  } | null>(null);
  const replaceLine = async (
    orderId: string,
    orderNumber: string,
    tableNumber: string | undefined,
    itemRowId: string,
    baseItemId: string,
    label: string,
  ) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, {
        action: 'strike',
        itemIds: [itemRowId],
      });
      toast.success(`Replaced "${label}" — pick the new config`, { duration: 2500 });
      setAddItemTarget({ orderId, orderNumber, tableNumber, prefocusItemId: baseItemId });
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not replace line');
    }
  };
  const [loading, setLoading] = useState(true);
  // Order ids that just changed — used to trigger the brief blink animation.
  const [flash, setFlash] = useState<Set<string>>(new Set());
  // Force a per-minute re-render so the "elapsed Xm" labels keep ticking.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!outletId) return;
    try {
      const [qRes, tabsRes] = await Promise.all([
        api.get(`/outlets/${outletId}/orders/service-desk/queue`),
        api.get(`/outlets/${outletId}/orders/service-desk/open-tabs`),
      ]);
      setQueue((qRes.data.data as Queue) || EMPTY_QUEUE);
      setOpenTabs((tabsRes.data.data as OrderRow[]) || []);
    } catch {
      // best-effort; the socket-driven path will pick up the next nudge
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Socket: join the service-desk room so the API can push targeted
  // verify/release/pickup nudges. Each nudge plays a chime, flags the
  // order id to flash, and refetches the queue (cheaper and simpler
  // than mutating local state line-by-line).
  useEffect(() => {
    if (!outletId) return;
    const socket = getSocket(outletId);
    socket.emit('joinServiceDesk', outletId);

    const onAlert = (payload: { kind: Lane; orderId: string; orderNumber?: string }) => {
      chime();
      setFlash((prev) => {
        const next = new Set(prev);
        next.add(payload.orderId);
        return next;
      });
      window.setTimeout(() => {
        setFlash((prev) => {
          const next = new Set(prev);
          next.delete(payload.orderId);
          return next;
        });
      }, 4000);
      fetchQueue();
    };

    // Any order status change in this outlet might move a card between
    // lanes; refetch is the simplest correct thing here.
    const onStatusUpdated = () => fetchQueue();

    socket.on('serviceDeskAlert', onAlert);
    socket.on('orderStatusUpdated', onStatusUpdated);
    return () => {
      socket.off('serviceDeskAlert', onAlert);
      socket.off('orderStatusUpdated', onStatusUpdated);
    };
  }, [outletId, fetchQueue]);

  // ── Per-lane actions ────────────────────────────────────────────────
  const confirmOrder = async (orderId: string) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, { action: 'confirm' });
      toast.success('Lines confirmed — kitchen is picking them up');
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not confirm');
    }
  };
  const strikeOrder = async (orderId: string) => {
    if (!window.confirm('Strike every unverified line on this order?')) return;
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, { action: 'strike' });
      toast.success('Lines cancelled');
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not cancel');
    }
  };
  // Per-line edit handlers — used in the verify lane when the customer
  // tweaks the order ("drop the lassi", "make it two not one") at the
  // point of confirmation. Both paths re-fetch the queue afterwards so
  // the totals and line list stay in sync with the socket update.
  const strikeOneLine = async (orderId: string, itemId: string, label: string) => {
    if (!window.confirm(`Remove "${label}" from this order?`)) return;
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, {
        action: 'strike',
        itemIds: [itemId],
      });
      toast.success('Line removed');
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not remove line');
    }
  };
  const setLineQty = async (orderId: string, itemId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    try {
      await api.patch(
        `/outlets/${outletId}/orders/${orderId}/items/${itemId}/quantity`,
        { quantity },
      );
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not update quantity');
    }
  };
  const advanceStatus = async (orderId: string, next: string) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/status`, { status: next });
      toast.success('Updated');
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not update');
    }
  };

  // Serve every currently-READY item on an order. Used by the pickup
  // and release lanes — order-level OUT_FOR_SERVICE / SERVED can't be
  // taken when only some items are ready (the kitchen is still
  // cooking the rest), but per-item READY → SERVED is always valid.
  // The order rollup auto-advances to SERVED once every live item is
  // SERVED, so the order disappears from the lane when truly done.
  const serveReadyItems = async (order: OrderRow) => {
    const ready = order.items.filter((i) => i.status === 'READY');
    if (ready.length === 0) return;
    try {
      // Run in parallel since each PATCH is independent (different
      // itemIds) and the rollup is computed off the final state.
      await Promise.all(ready.map((it) =>
        api.patch(`/outlets/${outletId}/orders/${order.id}/items/${it.id}/status`, { status: 'SERVED' }),
      ));
      toast.success(`Served ${ready.length} item${ready.length === 1 ? '' : 's'}`);
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not mark served');
    }
  };
  const requestBill = async (orderId: string) => {
    if (!window.confirm('Request the bill? No more items can be added after this.')) return;
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/bill-request`);
      toast.success('Bill requested — awaiting payment');
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not request bill');
    }
  };
  // Capture payment at the service desk — used when the customer pays
  // outside the customer PWA (cash, or UPI / online where the staff
  // verifies the gateway transfer in person). Mirrors PlaceOrderPage's
  // payBill but operates against any open tab. CASH auto-confirms
  // server-side; UPI returns a PENDING payment row we immediately
  // confirm because staff already saw the money land.
  const [payingId, setPayingId] = useState<string | null>(null);
  const capturePayment = async (orderId: string, mode: 'CASH' | 'UPI', amount: number) => {
    setPayingId(orderId);
    try {
      const { data } = await api.post('/payments/initiate', { orderId, mode, amount });
      if (mode === 'UPI' && data?.data?.paymentId) {
        await api.post(`/payments/${data.data.paymentId}/confirm`, { gatewayRef: '' });
      }
      toast.success(`Payment recorded · ₹${amount.toFixed(2)}`);
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to record payment');
    } finally {
      setPayingId(null);
    }
  };

  // Section → table → orders. Service desk staff walk the room; this
  // grouping mirrors the physical layout so they find the right tab
  // by walking to the table. Unsectioned tables and counter orders
  // (no table) land in their own buckets.
  const sectionGroups = useMemo(() => {
    type TableGroup = { tableId: string; tableNumber: string; orders: OrderRow[] };
    type Section = { id: string; name: string; tables: TableGroup[] };
    const map = new Map<string, Section>();
    const COUNTER = '__counter__';
    const UNSECTIONED = '__unsectioned__';
    for (const o of openTabs) {
      const sectionId = o.table?.section?.id ?? (o.table ? UNSECTIONED : COUNTER);
      const sectionName = o.table?.section?.name
        ?? (o.table ? 'Unsectioned tables' : 'Counter / no table');
      if (!map.has(sectionId)) map.set(sectionId, { id: sectionId, name: sectionName, tables: [] });
      const section = map.get(sectionId)!;
      const tableKey = o.table?.id ?? '__counter__';
      const tableNumber = o.table?.number ?? 'Counter';
      let group = section.tables.find((t) => t.tableId === tableKey);
      if (!group) {
        group = { tableId: tableKey, tableNumber, orders: [] };
        section.tables.push(group);
      }
      group.orders.push(o);
    }
    // Stable order: counter last; tables sorted by number.
    const sections = Array.from(map.values()).sort((a, b) => {
      if (a.id === COUNTER) return 1;
      if (b.id === COUNTER) return -1;
      return a.name.localeCompare(b.name);
    });
    for (const s of sections) {
      s.tables.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
    }
    return sections;
  }, [openTabs]);

  // Visual treatment for an item line based on its lifecycle state.
  const itemLineCls = (status: string): string => {
    if (status === 'PENDING_VERIFICATION') return 'bg-amber-50 text-amber-900 border-amber-100';
    if (status === 'CANCELLED') return 'bg-slate-50 text-slate-400 line-through border-slate-100';
    if (status === 'READY') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
    if (status === 'SERVED') return 'bg-slate-50 text-slate-500 border-slate-100';
    if (status === 'PREPARING') return 'bg-brand-50/40 text-brand-900 border-brand-100';
    return 'bg-white text-slate-700 border-slate-100';
  };

  // Verify-lane items are a subset of order.items (only PENDING_VERIFICATION
  // lines should render in this lane's preview). Other lanes show every
  // live line so the staff can confirm what they're carrying.
  const verifyItemsFor = (o: OrderRow) =>
    o.items.filter((i) => i.status === 'PENDING_VERIFICATION');
  const liveItemsFor = (o: OrderRow) =>
    o.items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'PENDING_VERIFICATION');

  const counts = useMemo(
    () => ({ verify: queue.verify.length, release: queue.release.length, pickup: queue.pickup.length }),
    [queue],
  );

  // Lane expansion — when set, that lane stretches to ~80% of the
  // horizontal space and the others shrink to vertical "diary tab"
  // spines. Click a tab to swap focus; click the expanded lane's
  // header chevron to collapse back to the equal-column layout.
  const [expandedLane, setExpandedLane] = useState<Lane | null>(null);

  // Vertical accordion focus — whichever section the operator is
  // working in expands to fill the available height, the other
  // collapses to a header strip they can click to swap focus. Keeps
  // the whole service desk fitting in one viewport without page
  // scrolling, which the operator asked for so they don't lose
  // either surface when they're moving between them.
  //
  // Default = 'tabs' on table-service outlets (Open Tabs is the
  // primary working surface) and 'lanes' on self-service (no postpaid
  // tabs, so Release is the only thing they touch).
  const [focused, setFocused] = useState<'tabs' | 'lanes'>(() =>
    (outletType === 'SELF_SERVICE' || outletType === 'SELF_SERVICE_PARCEL') ? 'lanes' : 'tabs',
  );
  // Re-anchor the default when outletType comes in async — only on
  // the first resolution, so manual operator clicks aren't overridden.
  const didAnchorFocusRef = useRef(false);
  useEffect(() => {
    if (didAnchorFocusRef.current) return;
    if (outletType == null) return;
    setFocused(isSelfService ? 'lanes' : 'tabs');
    didAnchorFocusRef.current = true;
  }, [outletType, isSelfService]);
  // Compact-card behaviour — every card is collapsed by default
  // (header only) and toggles its body on click. Same pattern as the
  // Orders page so staff who jump between the two have one mental
  // model.
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) =>
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!outletId) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Service desk is per-outlet. Your account isn't linked to an outlet yet.
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className={clsx(
        'mx-auto flex flex-col',
        // Fullscreen takes the whole viewport; the normal-mode layout
        // sits inside the admin shell — h-[calc(100dvh-64px)] matches
        // PlaceOrderPage's trick of claiming all remaining space below
        // the global header. Either way the page itself never
        // scrolls; each accordion section handles its own overflow.
        isFullscreen
          ? 'p-3 bg-slate-50 h-screen'
          : 'p-3 lg:p-4 max-w-[1600px] h-[calc(100dvh-64px)]',
      )}
    >
      <header className="flex items-center justify-between mb-3 gap-2 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Service desk</h1>
          <p className="text-xs text-slate-500">
            {isSelfService
              ? 'Release self-service orders as they come off the kitchen.'
              : 'Verify postpaid lines, release self-service orders, and run table-service pickups.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            {loading
              ? 'Loading…'
              : isSelfService
                ? `${counts.release} open`
                : `${counts.verify + counts.release + counts.pickup} open`}
          </div>
          <FullscreenToggle active={isFullscreen} onClick={toggleFullscreen} />
        </div>
      </header>

      {/* ── Open tabs (primary working surface) ─────────────────
          Grouped by section → table. Stays visible across the whole
          tab lifecycle until payment lands. Each table card shows
          the order and surfaces the actions a server would take
          (add an item, request the bill). The lanes below remain
          for task-focused views.

          Accordion: when focused = 'tabs', the section takes all
          available height; when focused = 'lanes', it collapses to
          a clickable header strip. */}
      <section
        className={clsx(
          'flex flex-col min-h-0 transition-all',
          focused === 'tabs' ? 'flex-1 mb-3' : 'shrink-0 mb-2',
        )}
      >
        <button
          type="button"
          onClick={() => setFocused('tabs')}
          className={clsx(
            'flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg w-full text-left transition-colors',
            focused === 'tabs' ? 'bg-transparent cursor-default' : 'bg-slate-100 hover:bg-slate-200 cursor-pointer',
          )}
        >
          <div className="flex items-center gap-2">
            {focused === 'lanes' && <ChevronUp size={14} className="text-slate-500" />}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Open tabs</h2>
              {focused === 'tabs' && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  All un-paid postpaid orders for this outlet, by table.
                </p>
              )}
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            {openTabs.length} open · {sectionGroups.reduce((s, g) => s + g.tables.length, 0)} tables
          </span>
        </button>
        {focused === 'tabs' && (
        <div className="flex-1 min-h-0 overflow-auto mt-2">
        {openTabs.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-2 py-6 text-center bg-white border border-slate-100 rounded-xl">
            No open tabs right now.
          </p>
        ) : (
          <div className="space-y-3">
            {sectionGroups.map((sec) => (
              <div key={sec.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {sec.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    · {sec.tables.length} {sec.tables.length === 1 ? 'table' : 'tables'}
                  </span>
                </div>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                  {sec.tables.map((tg) => (
                    <article key={tg.tableId} className="bg-white rounded-xl border border-slate-200 p-2.5 flex flex-col gap-2">
                      <header className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-brand-50 text-brand-800 border border-brand-100 rounded px-2 py-0.5">
                            <Armchair size={11} /> {tg.tableNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {tg.orders.length} order{tg.orders.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </header>
                      {tg.orders.map((o) => {
                        const live = o.items.filter((i) => i.status !== 'CANCELLED');
                        const billed = !!o.billRequestedAt;
                        return (
                          <div key={o.id} className="border border-slate-100 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">#{o.orderNumber}</span>
                                {billed && (
                                  <span className="text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 px-1.5 py-0.5 rounded">
                                    Bill requested
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-700">
                                ₹{Number(o.totalAmount ?? 0).toFixed(2)}
                              </span>
                            </div>
                            {(o.customer?.name || o.customer?.phone) && (
                              <p className="text-[10px] text-slate-500 mb-1.5 truncate">
                                {o.customer?.name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                              </p>
                            )}
                            <ul className="space-y-1 mb-2">
                              {live.length === 0 && (
                                <li className="text-[11px] italic text-slate-400">No active lines.</li>
                              )}
                              {live.map((it) => {
                                const isUnverified = it.status === 'PENDING_VERIFICATION';
                                return (
                                <li
                                  key={it.id}
                                  className={clsx('flex items-center gap-1.5 text-[11px] rounded border px-1.5 py-1', itemLineCls(it.status))}
                                >
                                  <span className="font-bold min-w-[1.25rem]">×{it.quantity}</span>
                                  <span className="flex-1 truncate">
                                    {it.item?.name || 'Item'}
                                    {it.variant?.name ? ` — ${it.variant.name}` : ''}
                                  </span>
                                  {isUnverified && it.item?.id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        replaceLine(o.id, o.orderNumber, tg.tableNumber, it.id, it.item!.id, it.item?.name || 'this line');
                                      }}
                                      title="Replace — change variant or toppings"
                                      className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-amber-700 hover:bg-amber-100"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                  )}
                                  {isUnverified && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        strikeOneLine(o.id, it.id, it.item?.name || 'this line');
                                      }}
                                      title="Remove this line"
                                      className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-rose-500 hover:bg-rose-100"
                                    >
                                      <XCircle size={10} />
                                    </button>
                                  )}
                                </li>
                                );
                              })}
                            </ul>
                            {!billed && live.length > 0 && (
                              <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                                <CoursePlanner
                                  order={o as any}
                                  compact
                                  onSaved={(updated: any) => {
                                    setOpenTabs((prev) =>
                                      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } as OrderRow : t)),
                                    );
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {!billed && (
                                <button
                                  onClick={() => setAddItemTarget({ orderId: o.id, orderNumber: o.orderNumber, tableNumber: tg.tableNumber })}
                                  className="text-[10px] font-bold bg-brand-600 hover:bg-brand-700 text-white rounded px-2 py-1 inline-flex items-center gap-1"
                                >
                                  <Plus size={10} /> Add item
                                </button>
                              )}
                              {!billed && live.length > 0 && (
                                <button
                                  onClick={() => requestBill(o.id)}
                                  className="text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded px-2 py-1 inline-flex items-center gap-1"
                                >
                                  <Bell size={10} /> Bill Now
                                </button>
                              )}
                              {billed && (
                                <>
                                  <span className="text-[10px] text-slate-500 font-semibold mr-1 inline-flex items-center">
                                    Pay
                                  </span>
                                  <button
                                    onClick={() => capturePayment(o.id, 'CASH', Number(o.totalAmount ?? 0))}
                                    disabled={payingId === o.id}
                                    className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Banknote size={10} /> Cash
                                  </button>
                                  <button
                                    onClick={() => capturePayment(o.id, 'UPI', Number(o.totalAmount ?? 0))}
                                    disabled={payingId === o.id}
                                    className="text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Smartphone size={10} /> Online
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        )}
      </section>

      {/* ── Lanes section ───────────────────────────────────────
          Same accordion shell as Open Tabs above. When focused =
          'lanes' the section claims the available height + the
          existing 3-lane flex row renders inside. When focused =
          'tabs', it collapses to a clickable header strip pinned to
          the bottom. Inside the section, the operator can still
          expand a single lane to ~80% width via the existing
          expandedLane mechanism. */}
      <section
        className={clsx(
          'flex flex-col min-h-0 transition-all',
          focused === 'lanes' ? 'flex-1' : 'shrink-0',
        )}
      >
        <button
          type="button"
          onClick={() => setFocused('lanes')}
          className={clsx(
            'flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg w-full text-left mb-2 transition-colors',
            focused === 'lanes' ? 'bg-transparent cursor-default' : 'bg-slate-100 hover:bg-slate-200 cursor-pointer',
          )}
        >
          <div className="flex items-center gap-2">
            {focused === 'tabs' && <ChevronDown size={14} className="text-slate-500" />}
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              {isSelfService ? 'Release' : 'Lanes'}
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            {visibleLanes.reduce((s, l) => s + counts[l], 0)} pending
          </span>
        </button>

        {focused === 'lanes' && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4 overflow-hidden">
        {visibleLanes.map((lane) => {
          const meta = LANE_META[lane];
          const rows = queue[lane];
          const Icon = meta.icon;
          const isExpanded = expandedLane === lane;
          const isCollapsedTab = expandedLane !== null && !isExpanded;
          // Flex weights: 8/1/1 when one lane is expanded, otherwise
          // equal. The `lg:` prefix keeps mobile a vertical stack.
          const flexBasis = expandedLane === null ? 1 : isExpanded ? 8 : 1;

          if (isCollapsedTab) {
            // Diary-tab spine — click to swap focus to this lane.
            return (
              <button
                key={lane}
                onClick={() => setExpandedLane(lane)}
                style={{ flex: flexBasis }}
                className={clsx(
                  'hidden lg:flex flex-col items-center justify-center gap-3 rounded-2xl border p-3 transition-all hover:brightness-95',
                  meta.tint,
                )}
                title={`Expand ${meta.title}`}
              >
                <Icon size={18} className={meta.accent} />
                <span
                  className={clsx('text-[11px] font-bold uppercase tracking-wider', meta.accent)}
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {meta.title}
                </span>
                <span className="text-xs font-bold bg-white/80 rounded-full px-2 py-0.5 text-slate-700">
                  {rows.length}
                </span>
              </button>
            );
          }

          return (
            <section
              key={lane}
              style={{ flex: flexBasis }}
              className={clsx(
                'rounded-2xl border p-3 min-h-[60vh] flex flex-col min-w-0',
                meta.tint,
              )}
            >
              <header className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={16} className={meta.accent} />
                  <h2 className={clsx('text-sm font-bold uppercase tracking-wider', meta.accent)}>
                    {meta.title}
                  </h2>
                  <span className="text-xs font-semibold bg-white/70 rounded-full px-2 py-0.5 text-slate-600">
                    {rows.length}
                  </span>
                </div>
                <button
                  onClick={() => setExpandedLane(isExpanded ? null : lane)}
                  className={clsx(
                    'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
                    isExpanded
                      ? 'bg-white/80 text-slate-700 hover:bg-white'
                      : 'bg-white/50 text-slate-500 hover:bg-white/80',
                  )}
                  title={isExpanded ? 'Collapse to equal columns' : 'Expand this lane'}
                >
                  <Maximize2 size={13} />
                </button>
              </header>
              {/* Subtitle hidden when expanded so vertical space goes to cards. */}
              {!isExpanded && (
                <p className="text-[11px] text-slate-500 px-1 mb-3">{meta.subtitle}</p>
              )}

              {rows.length === 0 && (
                <p className="text-xs text-slate-400 italic px-2 py-6 text-center">Nothing in this lane.</p>
              )}

              {/* CSS multi-column masonry — mirrors the Kitchen layout.
                  Cards are pinned at ~240px wide, so a 30%-wide lane
                  fits one column and an 80%-expanded lane packs five or
                  six side-by-side. `break-inside: avoid` (on each card
                  below) keeps a card from being split between columns. */}
              <div
                className="overflow-y-auto pr-1"
                style={{ columnWidth: '240px', columnGap: '8px' }}
              >
                {rows.map((o) => {
                  const items = lane === 'verify' ? verifyItemsFor(o) : liveItemsFor(o);
                  const mins = elapsedMins(o.createdAt);
                  const flashing = flash.has(o.id);
                  const isCardOpen = openCards.has(o.id);
                  const readyCount = items.filter((i) => i.status === 'READY').length;
                  return (
                    <article
                      key={o.id}
                      onClick={() => toggleCard(o.id)}
                      style={{ breakInside: 'avoid' }}
                      className={clsx(
                        'bg-white rounded-xl border p-2.5 transition-all cursor-pointer hover:border-slate-300 mb-2 inline-block w-full',
                        flashing
                          ? 'border-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.25)] animate-pulse'
                          : 'border-slate-200',
                      )}
                    >
                      {/* Compact header — always visible. */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">#{o.orderNumber}</span>
                          {o.table?.number ? (
                            // Table numbers are stored as already-formatted
                            // strings (e.g. "T01", "5", "Patio 3"). Show as
                            // received with a chair icon so it reads "Table"
                            // without the old hard-coded T prefix (which
                            // double-stamped values like "T01" → "TT01").
                            <span className="text-[11px] font-bold bg-brand-50 text-brand-800 px-2 py-0.5 rounded inline-flex items-center gap-1 border border-brand-100">
                              <Armchair size={11} /> {o.table.number}
                            </span>
                          ) : (
                            // No table = walk-in counter order. Surface that
                            // explicitly so service desk doesn't go hunting.
                            <span className="text-[10px] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                              Counter
                            </span>
                          )}
                          {o.isPostpaid && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              Postpaid
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500">
                            {items.length} item{items.length === 1 ? '' : 's'}
                          </span>
                          {readyCount > 0 && lane !== 'verify' && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                              {readyCount} ready
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock size={11} /> {mins}m
                          </span>
                          <ChevronDown
                            size={14}
                            className={clsx(
                              'text-slate-400 transition-transform',
                              isCardOpen && 'rotate-180',
                            )}
                          />
                        </div>
                      </div>
                      {/* Customer line (one row) */}
                      {(o.customer?.name || o.customer?.phone) && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {o.customer?.name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                        </p>
                      )}

                      {/* Expanded body — items + actions. */}
                      {isCardOpen && (
                        <>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {items.map((it) => {
                              // Verify-lane lines get editable controls:
                              // a +/- qty stepper + a remove button so the
                              // service desk can edit the order while
                              // talking the customer through it.
                              const isVerifyLine = lane === 'verify' && it.status === 'PENDING_VERIFICATION';
                              return (
                              <li
                                key={it.id}
                                className={clsx(
                                  'flex items-center gap-2',
                                  isVerifyLine && 'bg-amber-50/60 border border-amber-100 rounded-lg px-2 py-1.5',
                                )}
                                onClick={(e) => isVerifyLine && e.stopPropagation()}
                              >
                                {isVerifyLine ? (
                                  <div className="flex items-center gap-0.5 border border-slate-300 rounded-md bg-white shrink-0">
                                    <button
                                      onClick={() => setLineQty(o.id, it.id, Math.max(1, it.quantity - 1))}
                                      disabled={it.quantity <= 1}
                                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Decrease"
                                    >
                                      <Minus size={11} />
                                    </button>
                                    <span className="text-xs font-bold text-slate-900 w-5 text-center">
                                      {it.quantity}
                                    </span>
                                    <button
                                      onClick={() => setLineQty(o.id, it.id, it.quantity + 1)}
                                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800"
                                      title="Increase"
                                    >
                                      <Plus size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-slate-900 min-w-[1.5rem]">×{it.quantity}</span>
                                )}
                                <span className="truncate flex-1">
                                  {it.item?.name || 'Item'}
                                  {it.variant?.name ? ` — ${it.variant.name}` : ''}
                                  {it.notes ? <span className="text-slate-400"> · {it.notes}</span> : null}
                                </span>
                                {it.status === 'READY' && (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                    ready
                                  </span>
                                )}
                                {it.status === 'PREPARING' && (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                    <ChefHat size={9} /> cooking
                                  </span>
                                )}
                                {isVerifyLine && (
                                  <button
                                    onClick={() => strikeOneLine(o.id, it.id, it.item?.name || 'this line')}
                                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-rose-500 hover:bg-rose-100"
                                    title="Remove this line"
                                  >
                                    <XCircle size={13} />
                                  </button>
                                )}
                              </li>
                              );
                            })}
                            {items.length === 0 && (
                              <li className="text-xs italic text-slate-400">No items in this lane.</li>
                            )}
                          </ul>
                          {lane === 'verify' && items.length > 0 && (
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <CoursePlanner
                                order={o as any}
                                compact
                                onSaved={() => fetchQueue()}
                              />
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                            {lane === 'verify' && (
                              <>
                                <button
                                  onClick={() => confirmOrder(o.id)}
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                >
                                  <CheckCircle2 size={13} /> Confirm
                                </button>
                                <button
                                  onClick={() => strikeOrder(o.id)}
                                  className="inline-flex items-center gap-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                >
                                  <XCircle size={13} /> Strike
                                </button>
                              </>
                            )}
                            {lane === 'release' && (() => {
                              // "Release" in self-service IS "served" — the
                              // food's on the pickup counter and the customer's
                              // already been pinged via the per-item ITEM_READY
                              // notification. Mark every currently-READY item
                              // as SERVED; the per-item rollup auto-advances
                              // the order to SERVED when all items are done,
                              // or leaves it open (partly-served) when other
                              // items are still cooking.
                              const readyCount = items.filter((i) => i.status === 'READY').length;
                              const totalCount = items.length;
                              const isPartial = readyCount < totalCount;
                              return (
                                <button
                                  onClick={() => serveReadyItems(o)}
                                  className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                  title={isPartial
                                    ? `Release ${readyCount} of ${totalCount} items — rest stay open until cooked`
                                    : 'Release for pickup — closes the order'}
                                >
                                  <Bell size={13} />
                                  {isPartial
                                    ? `Release ${readyCount} of ${totalCount}`
                                    : 'Release for pickup'}
                                </button>
                              );
                            })()}
                            {lane === 'pickup' && (() => {
                              const readyCount = items.filter((i) => i.status === 'READY').length;
                              // Single "Serve N ready" works whether 1 of 5
                              // items is ready or all 5 are — per-item READY
                              // → SERVED is always valid even when the order
                              // status is still PREPARING, and the rollup
                              // closes the order once every item is SERVED.
                              return (
                                <button
                                  onClick={() => serveReadyItems(o)}
                                  disabled={readyCount === 0}
                                  title={readyCount === 0 ? 'Waiting for the kitchen — nothing is ready yet' : undefined}
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                >
                                  <Utensils size={13} /> Serve {readyCount > 0 ? `${readyCount} ready` : 'ready'}
                                </button>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
        </div>
        )}
      </section>

      {addItemTarget && (
        <AddItemModal
          outletId={outletId}
          orderId={addItemTarget.orderId}
          orderNumber={addItemTarget.orderNumber}
          tableNumber={addItemTarget.tableNumber}
          prefocusItemId={addItemTarget.prefocusItemId}
          onClose={() => setAddItemTarget(null)}
          onSaved={() => {
            setAddItemTarget(null);
            fetchQueue();
          }}
        />
      )}
    </div>
  );
}

/* ── Add item modal ─────────────────────────────────────────────────
   Opens from each open tab card. Fetches the outlet menu once, then
   lets the staff search + click items to fill a small per-modal cart.
   Submit appends to the existing order via the appendItems endpoint
   — new lines arrive in PENDING_VERIFICATION so they show up in the
   Verify lane until the staff confirms with the customer.

   Intentionally a thin picker: variants get a quick dropdown when
   present; toppings / bundles are out of scope for the first cut.
*/
function AddItemModal({
  outletId, orderId, orderNumber, tableNumber, prefocusItemId, onClose, onSaved,
}: {
  outletId: string;
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  // When set, the modal opens the config sheet for this item as soon
  // as the menu loads. Used by the "Replace" flow on a struck line so
  // the staff lands directly in the variant/topping picker.
  prefocusItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  type Variant = { id: string; name: string; price: string | number; isAvailable: boolean };
  type ToppingOption = { id: string; name: string; priceAdd: string | number };
  type ItemTopping = {
    toppingId: string;
    priceAdd?: string | number | null;
    isRequired: boolean;
    topping: { id: string; name: string; basePriceAdd?: string | number; options: ToppingOption[] };
  };
  type MenuItem = {
    id: string;
    name: string;
    basePrice: string | number;
    variants?: Variant[];
    itemToppings?: ItemTopping[];
    isAvailable: boolean;
    isDisplayed: boolean;
  };
  type Category = { id: string; name: string; subcategories?: Array<{ id: string; name: string; items?: MenuItem[] }> };
  type CartTopping = { toppingId: string; optionId?: string; label: string; priceAdd: number };
  type Cart = Array<{
    key: string;
    itemId: string;
    variantId?: string;
    name: string;
    qty: number;
    unit: number;
    toppings?: CartTopping[];
    toppingsLabel?: string;
  }>;

  const [menu, setMenu] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Cart>([]);
  const [saving, setSaving] = useState(false);
  // Config sheet — opens when the tapped item needs variant / topping
  // input from staff. Plain items (no variants AND no toppings) skip
  // straight to addToCart.
  type ConfigDraft = {
    item: MenuItem;
    variantId: string;
    // toppings draft keyed by toppingId so the UI can flip required
    // toppings on by default and let staff toggle the optional ones.
    toppings: Record<string, { selected: boolean; optionId?: string }>;
    qty: number;
  };
  const [configFor, setConfigFor] = useState<ConfigDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/outlets/${outletId}/menu`, { params: { includeHidden: 'true' } });
        if (!cancelled) setMenu((data?.data as Category[]) || []);
      } catch {
        if (!cancelled) toast.error('Could not load menu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [outletId]);

  // Auto-tap the prefocus item once the menu loads — the "Replace" flow
  // on the open-tab card opens the modal with this id set so the staff
  // lands straight in the config sheet for the same item they just
  // struck.
  const prefocusedRef = useRef(false);
  useEffect(() => {
    if (!prefocusItemId || prefocusedRef.current || loading || menu.length === 0) return;
    for (const cat of menu) {
      for (const sub of cat.subcategories || []) {
        for (const it of sub.items || []) {
          if (it.id === prefocusItemId) {
            prefocusedRef.current = true;
            tap(it);
            return;
          }
        }
      }
    }
    // No match — silent. Modal still works as a normal picker.
    prefocusedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefocusItemId, loading, menu]);

  // Flatten + filter for the picker view. Staff almost always need
  // search rather than category drill-down when they're standing at a
  // table; we keep category headers so the result list stays scannable.
  const filteredCats = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Array<{ category: string; subcategory: string; items: MenuItem[] }> = [];
    for (const cat of menu) {
      for (const sub of cat.subcategories || []) {
        const items = (sub.items || []).filter((it) =>
          it.isAvailable
          && it.isDisplayed
          && (!q || it.name.toLowerCase().includes(q)),
        );
        if (items.length) out.push({ category: cat.name, subcategory: sub.name, items });
      }
    }
    return out;
  }, [menu, query]);

  // Plain add — no variant, no toppings, qty 1. Used by `tap` for the
  // simple-item path; the config-sheet "Add to cart" routes through
  // `addConfigured` instead.
  const addPlainItem = (item: MenuItem) => {
    const key = item.id;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => l.key === key ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, {
        key,
        itemId: item.id,
        name: item.name,
        qty: 1,
        unit: Number(item.basePrice),
      }];
    });
  };

  // Composite add — used by the config sheet. Variant + topping picks
  // get baked into the line's unit price + a readable summary so the
  // pending-cart view shows what's being sent.
  const addConfigured = (draft: ConfigDraft) => {
    const item = draft.item;
    const variant = (item.variants || []).find((v) => v.id === draft.variantId);
    let unit = Number(variant?.price ?? item.basePrice);
    const toppings: CartTopping[] = [];
    for (const link of item.itemToppings || []) {
      const sel = draft.toppings[link.toppingId];
      if (!sel?.selected && !link.isRequired) continue;
      const basePriceAdd = link.priceAdd != null
        ? Number(link.priceAdd)
        : Number(link.topping.basePriceAdd ?? 0);
      const hasOptions = (link.topping.options || []).length > 0;
      const optId = hasOptions ? (sel?.optionId || link.topping.options[0].id) : undefined;
      const opt = optId ? link.topping.options.find((o) => o.id === optId) : undefined;
      const optAdd = opt ? Number(opt.priceAdd) : 0;
      const label = opt
        ? `${link.topping.name}: ${opt.name}`
        : link.topping.name;
      unit += basePriceAdd + optAdd;
      toppings.push({ toppingId: link.toppingId, optionId: opt?.id, label, priceAdd: basePriceAdd + optAdd });
    }
    const toppingsLabel = toppings.length ? toppings.map((t) => t.label).join(', ') : undefined;
    // Cart key includes variant + toppings so the same item with
    // different configs sits as separate lines instead of stacking.
    const toppingKey = toppings.map((t) => `${t.toppingId}:${t.optionId ?? ''}`).sort().join('|');
    const key = `${item.id}:${draft.variantId || ''}:${toppingKey}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => l.key === key ? { ...l, qty: l.qty + draft.qty } : l);
      return [...prev, {
        key,
        itemId: item.id,
        variantId: draft.variantId || undefined,
        name: variant ? `${item.name} — ${variant.name}` : item.name,
        qty: draft.qty,
        unit,
        toppings,
        toppingsLabel,
      }];
    });
    setConfigFor(null);
  };

  const tap = (item: MenuItem) => {
    const variants = (item.variants || []).filter((v) => v.isAvailable);
    const toppingLinks = item.itemToppings || [];
    // Simple item: no variants AND no toppings → instant add.
    if (variants.length === 0 && toppingLinks.length === 0) {
      return addPlainItem(item);
    }
    // Otherwise open the config sheet. Default variant = first
    // available; required toppings start selected with their first
    // option as the default; optional toppings start unselected so
    // staff actively chooses to add them.
    const toppings: ConfigDraft['toppings'] = {};
    for (const link of toppingLinks) {
      const firstOpt = link.topping.options?.[0]?.id;
      toppings[link.toppingId] = link.isRequired
        ? { selected: true, optionId: firstOpt }
        : { selected: false, optionId: firstOpt };
    }
    setConfigFor({
      item,
      variantId: variants[0]?.id || '',
      toppings,
      qty: 1,
    });
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) => prev
      .map((l) => l.key === key ? { ...l, qty: l.qty + delta } : l)
      .filter((l) => l.qty > 0),
    );
  };

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.unit * l.qty, 0), [cart]);

  const submit = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/outlets/${outletId}/orders/${orderId}/items`, {
        items: cart.map((l) => ({
          itemId: l.itemId,
          variantId: l.variantId,
          quantity: l.qty,
          toppings: l.toppings?.length
            ? l.toppings.map((t) => ({ toppingId: t.toppingId, optionId: t.optionId }))
            : undefined,
        })),
      });
      toast.success(`Added ${cart.length} line${cart.length === 1 ? '' : 's'} — verify in the Verify lane`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not add items');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Add item to #{orderNumber}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tableNumber ? `Table ${tableNumber}` : 'Counter'} · new lines arrive in Verify until you confirm
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <XCircle size={18} />
          </button>
        </header>

        <div className="px-3 py-2 border-b border-slate-100">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 italic px-3 py-6 text-center">Loading menu…</p>
          ) : filteredCats.length === 0 ? (
            <p className="text-xs text-slate-400 italic px-3 py-6 text-center">
              {query ? 'No items match that search.' : 'No items available.'}
            </p>
          ) : (
            filteredCats.map((group) => (
              <div key={`${group.category}|${group.subcategory}`} className="px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  {group.category} · {group.subcategory}
                </p>
                <ul className="grid sm:grid-cols-2 gap-1.5">
                  {group.items.map((it) => (
                    <li key={it.id}>
                      <button
                        onClick={() => tap(it)}
                        className="w-full text-left bg-slate-50 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <span className="truncate text-slate-800 font-semibold">{it.name}</span>
                        <span className="shrink-0 text-slate-500">₹{Number(it.basePrice).toFixed(0)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/60 max-h-44 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
              To add — {cart.length} line{cart.length === 1 ? '' : 's'} · ₹{cartTotal.toFixed(2)}
            </p>
            <ul className="space-y-1">
              {cart.map((l) => (
                <li key={l.key} className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-0.5 border border-slate-300 rounded-md bg-white shrink-0">
                    <button
                      onClick={() => updateQty(l.key, -1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800"
                      title="Decrease"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-bold text-slate-900 w-5 text-center">{l.qty}</span>
                    <button
                      onClick={() => updateQty(l.key, 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800"
                      title="Increase"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-slate-700">{l.name}</p>
                    {l.toppingsLabel && (
                      <p className="text-[10px] text-indigo-600 truncate">+ {l.toppingsLabel}</p>
                    )}
                  </div>
                  <span className="text-slate-500 shrink-0">₹{(l.unit * l.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="px-3 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || cart.length === 0}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Adding…' : `Add ${cart.length || ''} ${cart.length === 1 ? 'line' : 'lines'}`}
          </button>
        </footer>

        {configFor && (
          <ItemConfigSheet
            draft={configFor}
            onChange={(next) => setConfigFor(next as ConfigDraft)}
            onCancel={() => setConfigFor(null)}
            onConfirm={() => addConfigured(configFor)}
          />
        )}
      </div>
    </div>
  );
}

// ── Variant + topping config sheet ─────────────────────────────────
// Renders over the AddItemModal when staff taps an item that needs
// configuration (variants or any topping). Sits in its own component
// so the parent's state stays simple; the parent owns the draft and
// just receives draft updates back through `onChange`.
function ItemConfigSheet({
  draft, onChange, onCancel, onConfirm,
}: {
  draft: {
    item: {
      id: string; name: string; basePrice: string | number;
      variants?: Array<{ id: string; name: string; price: string | number; isAvailable: boolean }>;
      itemToppings?: Array<{
        toppingId: string;
        priceAdd?: string | number | null;
        isRequired: boolean;
        topping: { id: string; name: string; basePriceAdd?: string | number; options: Array<{ id: string; name: string; priceAdd: string | number }> };
      }>;
    };
    variantId: string;
    toppings: Record<string, { selected: boolean; optionId?: string }>;
    qty: number;
  };
  onChange: (next: typeof draft) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { item } = draft;
  const variants = (item.variants || []).filter((v) => v.isAvailable);
  const variant = variants.find((v) => v.id === draft.variantId);

  // Running unit price — same math addConfigured uses, surfaced live
  // so the staff sees what they're committing to before tapping Add.
  let unit = Number(variant?.price ?? item.basePrice);
  for (const link of item.itemToppings || []) {
    const sel = draft.toppings[link.toppingId];
    if (!sel?.selected && !link.isRequired) continue;
    const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd ?? 0);
    const hasOptions = (link.topping.options || []).length > 0;
    const optId = hasOptions ? (sel?.optionId || link.topping.options[0].id) : undefined;
    const opt = optId ? link.topping.options.find((o) => o.id === optId) : undefined;
    unit += basePriceAdd + (opt ? Number(opt.priceAdd) : 0);
  }

  return (
    <div className="absolute inset-0 z-10 bg-black/30 flex items-end sm:items-center justify-center p-2 sm:p-6" onClick={onCancel}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-900">{item.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Pick variant &amp; toppings — runs at ₹{unit.toFixed(2)} per piece</p>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {variants.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Variant</p>
              <ul className="space-y-1">
                {variants.map((v) => (
                  <li key={v.id}>
                    <label className={clsx(
                      'flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer text-xs',
                      draft.variantId === v.id
                        ? 'bg-brand-50 border-brand-200 text-brand-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                    )}>
                      <input
                        type="radio"
                        name="variant"
                        checked={draft.variantId === v.id}
                        onChange={() => onChange({ ...draft, variantId: v.id })}
                        className="accent-brand-600"
                      />
                      <span className="font-semibold flex-1">{v.name}</span>
                      <span className="text-slate-500">₹{Number(v.price).toFixed(0)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(item.itemToppings || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Toppings</p>
              <ul className="space-y-1.5">
                {(item.itemToppings || []).map((link) => {
                  const sel = draft.toppings[link.toppingId] || { selected: false };
                  const hasOptions = (link.topping.options || []).length > 0;
                  const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd ?? 0);
                  return (
                    <li key={link.toppingId} className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sel.selected}
                          disabled={link.isRequired}
                          onChange={(e) => onChange({
                            ...draft,
                            toppings: {
                              ...draft.toppings,
                              [link.toppingId]: { ...sel, selected: e.target.checked },
                            },
                          })}
                          className="accent-brand-600"
                        />
                        <span className="font-semibold flex-1 text-slate-800">
                          {link.topping.name}
                          {link.isRequired && <span className="ml-1 text-[9px] font-bold text-amber-700">required</span>}
                        </span>
                        {!hasOptions && basePriceAdd > 0 && (
                          <span className="text-[10px] text-slate-500">+ ₹{basePriceAdd.toFixed(0)}</span>
                        )}
                      </label>
                      {hasOptions && sel.selected && (
                        <select
                          value={sel.optionId || ''}
                          onChange={(e) => onChange({
                            ...draft,
                            toppings: {
                              ...draft.toppings,
                              [link.toppingId]: { ...sel, optionId: e.target.value },
                            },
                          })}
                          className="mt-1.5 w-full text-xs rounded border border-slate-300 px-2 py-1"
                        >
                          {link.topping.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}{Number(opt.priceAdd) > 0 ? ` · +₹${Number(opt.priceAdd).toFixed(0)}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Quantity</p>
            <div className="inline-flex items-center gap-0.5 border border-slate-300 rounded-md bg-white">
              <button
                onClick={() => onChange({ ...draft, qty: Math.max(1, draft.qty - 1) })}
                disabled={draft.qty <= 1}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-30"
              >
                <Minus size={12} />
              </button>
              <span className="text-sm font-bold text-slate-900 w-7 text-center">{draft.qty}</span>
              <button
                onClick={() => onChange({ ...draft, qty: draft.qty + 1 })}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        <footer className="px-3 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <button onClick={onCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-2"
          >
            Add · ₹{(unit * draft.qty).toFixed(2)}
          </button>
        </footer>
      </div>
    </div>
  );
}
