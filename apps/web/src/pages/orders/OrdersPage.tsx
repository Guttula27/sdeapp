import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Search, Clock, ShoppingBag, ArrowRight, X, RefreshCw, Eye, Play, Bell, Utensils, Plus, Tag as TagIcon, User, Download, Maximize2, Minimize2, Filter, ChevronDown, Printer as PrinterIcon, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { RootState } from '../../store';
import { setOrders, updateOrder } from '../../store/slices/ordersSlice';
import { getSocket } from '../../services/socket';
import { useSocketStatus } from '../../hooks/useSocketStatus';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';
import { isPrinterConnected, isBluetoothSupported, connectPrinter, printCustomerReceipt } from '../../utils/bluetoothPrinter';
import { buildReceiptPayload } from '../../utils/receiptPayload';
import { getOpenOrdersSnapshot, setOpenOrdersSnapshot } from '../../utils/idb';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import ThermalReceipt from '../../components/receipt/ThermalReceipt';
import { downloadReceiptPdf } from '../../components/receipt/downloadReceiptPdf';
import Modal from '../../components/common/Modal';
import CoursePlanner from '../../components/orders/CoursePlanner';

const STATUS: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  CREATED:          { label: 'Created',          dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  QUEUED:           { label: 'Queued',           dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  PREPARING:        { label: 'Preparing',        dot: '#0B4245', bg: '#e8efef', text: '#04181a', border: '#D2E5DF' },
  READY:            { label: 'Ready',            dot: '#10b981', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', dot: '#2563eb', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  OUT_FOR_SERVICE:  { label: 'Out for Service',  dot: '#14b8a6', bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
  SERVED:          { label: 'Served',          dot: '#64748b', bg: '#FAFAFA', text: '#475569', border: '#e2e8f0' },
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
type StatusCtx = { outletType?: string | null; tableId?: string | null; isParcel?: boolean };
function nextStatusFor(current: string, ctx: StatusCtx): { next: string; label: string } | null {
  if (current === 'CREATED')          return { next: 'QUEUED', label: 'Accept' };
  if (current === 'OUT_FOR_SERVICE')  return { next: 'SERVED', label: 'Mark Served' };
  if (current === 'READY_FOR_PICKUP') return { next: 'SERVED', label: 'Mark Picked Up' };
  if (current === 'FOR_REFUND')       return { next: 'REFUND_COMPLETE', label: 'Mark Refunded' };
  if (current === 'READY') {
    // Parcel: go through the pickup-counter step so the customer gets the alert.
    if (ctx.isParcel) return { next: 'READY_FOR_PICKUP', label: 'Ready for Pickup' };
    return needsOutForService(ctx.outletType, ctx.tableId)
      ? { next: 'OUT_FOR_SERVICE', label: 'Out for Service' }
      : { next: 'SERVED',          label: 'Mark Served' };
  }
  return null;
}
const FILTERS = ['ACTIVE','ALL','CREATED','QUEUED','PREPARING','READY','READY_FOR_PICKUP','OUT_FOR_SERVICE','SERVED','CANCELLED','DISPUTED','RESOLVED','FOR_REFUND','REFUND_COMPLETE'];
const FILTER_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  ALL: 'All',
};
// Terminal states excluded from the default "Active" view.
const TERMINAL_STATUSES = new Set(['SERVED', 'CANCELLED']);

type ItemStatus = 'PENDING_VERIFICATION' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

const ITEM_STATUS: Record<ItemStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  PENDING_VERIFICATION: { label: 'Awaiting verify', bg: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
  PENDING:   { label: 'Pending',   bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  PREPARING: { label: 'Preparing', bg: '#e8efef', text: '#04181a', border: '#D2E5DF', dot: '#0B4245' },
  READY:     { label: 'Ready',     bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#10b981' },
  SERVED:    { label: 'Served',    bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', dot: '#14b8a6' },
  CANCELLED: { label: 'Cancelled', bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#ef4444' },
};
// PENDING_VERIFICATION intentionally has no NEXT_ITEM mapping — the kitchen
// can't advance it; only the service desk (via the dashboard) flips it to
// PENDING after confirming with the customer.
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
  const { tier, has } = useUserRole();
  const { orders } = useSelector((s: RootState) => s.orders);
  // Multi-select filter: users can combine statuses (e.g. ACTIVE + CANCELLED).
  // ACTIVE/ALL act as presets that compose with specific statuses — see
  // matchesFilter below for the OR logic. Default is just {ACTIVE}.
  const [filterSet, setFilterSet] = useState<Set<string>>(() => new Set(['ACTIVE']));
  const toggleFilter = (f: string) => {
    setFilterSet((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      if (next.size === 0) next.add('ACTIVE'); // never leave the page with no filter
      return next;
    });
  };
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Fullscreen toggle — uses the browser's Fullscreen API on the page wrapper
  // so phones in landscape can use the whole screen. We also track via the
  // browser's `fullscreenchange` event so the icon stays in sync if the user
  // exits via Escape.
  const toggleFullscreen = async () => {
    const el = pageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { /* ignore — feature may be unavailable */ }
  };
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Expanded search: autofocus the input on open; collapse on Escape.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Status dropdown: close on click-outside so the page feels native.
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [statusMenuOpen]);

  const downloadDetailReceipt = () => {
    if (!receiptRef.current || !detail) return;
    downloadReceiptPdf(receiptRef.current, `Receipt-${detail.orderNumber}`);
  };

  // Outlet receipt-print config — declared as plain state up here; the
  // actual fetch (which depends on outletId) lives further down in the
  // existing fetch useEffect chain so we don't get TDZ-on-use.
  const [outletPrint, setOutletPrint] = useState<{
    allowManual: boolean;
    printerId: string | null;
  }>({ allowManual: false, printerId: null });

  const [printing, setPrinting] = useState(false);
  const printDetailReceipt = async () => {
    if (!detail || !outletPrint.printerId) return;
    setPrinting(true);
    try {
      // Auto-connect on first press so the staff doesn't need a
      // separate "Connect printer" step — Web Bluetooth prompts if no
      // handle exists yet.
      if (!isPrinterConnected(outletPrint.printerId)) {
        await connectPrinter(outletPrint.printerId);
      }
      // Prefer fresh detail from the server (richer than the list
      // payload — guarantees totals + tax rows are exact for the
      // receipt). If the server is unreachable, fall back to the
      // local detail snapshot so the kitchen can still print the
      // handoff receipt for service staff offline.
      let payload: any = null;
      try {
        const { data } = await api.get(`/outlets/${detail.outletId || outletId}/orders/${detail.id}`);
        payload = data.data;
      } catch (fetchErr: any) {
        const httpStatus = fetchErr?.response?.status ?? 0;
        const isInfraTransient = !fetchErr?.response || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
        if (!isInfraTransient) throw fetchErr;
        // Offline fallback — the snapshot we opened the modal with
        // is sufficient for an itemised receipt.
        payload = detail;
      }
      await printCustomerReceipt(outletPrint.printerId, buildReceiptPayload(payload));
      toast.success('Receipt sent to printer');
    } catch (e: any) {
      toast.error(e?.message || 'Print failed');
    } finally {
      setPrinting(false);
    }
  };
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  // Refund modal state. Set to an order when the operator clicks
  // "Refund" on the detail. The modal collects amount + reason and
  // POSTs to /refunds; the order then appears on /refunds as
  // INITIATED awaiting approval (or completes immediately if cash +
  // operator has approve perms).
  const [refundTarget, setRefundTarget] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Platform/business listings span outlets and stay read-only here —
  // those tiers manage via their own dashboards. Kitchen used to be in
  // this list too, but the offline flow needs them to mark items
  // READY from this page when their kitchen board is unreachable.
  const isReadOnly  = tier === 'platform' || tier === 'business';
  const canAccept   = tier === 'kitchen'; // chef can accept NEW orders but nothing else

  // Action-button gating for the offline manual-delivery flow:
  //   • Kitchen staff can mark items/orders READY (their handoff
  //     point to service), but NOT SERVED — that's the service
  //     staff's call, kept separate so the kitchen can't accidentally
  //     close out an order the customer hasn't received yet.
  //   • Service / counter / outlet-admin staff can do both.
  //   • A staff member who happens to have both kitchen + service
  //     roles still goes through the same per-button gating, so the
  //     UI doesn't pretend they can bypass the workflow.
  const canMarkServed = tier !== 'kitchen';

  // Snapshot-aware live network state. Buttons stay visible regardless
  // — the optimistic update + outbox replay handle the offline case
  // transparently. Kept here as a hook for any future offline-only UI
  // (e.g. an inline "queued" pill on a card we know hasn't synced yet).
  useNetworkStatus();

  // Station scope: kitchen + counter (service desk) users only see items routed to their station
  // Plural — a staff member can be assigned as currentWorker to
  // multiple kitchen stations (e.g. covering tandoor + curry). All
  // assigned stations contribute to what they can see + act on.
  const [myStations, setMyStations] = useState<Array<{ id: string; name: string; isMaster?: boolean }>>([]);
  const stationIsMaster = myStations.some((s) => s.isMaster);
  const stationIdSet = new Set(myStations.map((s) => s.id));
  useEffect(() => {
    if (tier !== 'kitchen' && tier !== 'counter') return;
    api.get(`/outlets/${user?.outletId || 'demo-outlet'}/kitchen-stations/mine`)
      .then(r => {
        // Backend now returns an array (multi-station support). Older
        // deploys returned a single object — coerce both shapes.
        const data = r.data?.data;
        if (Array.isArray(data)) setMyStations(data);
        else if (data && typeof data === 'object') setMyStations([data]);
        else setMyStations([]);
      })
      .catch(() => setMyStations([]));
  }, [tier, user?.outletId]);
  const visibleItems = (items: any[]) =>
    myStations.length === 0 || stationIsMaster
      ? items
      : items.filter((it: any) =>
          it.item?.kitchenStationId && stationIdSet.has(it.item.kitchenStationId),
        );
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

  // Pull the outlet's receipt-print config so the Print Receipt
  // button on the detail panel knows whether to render + which
  // printer to target. Skipped for platform / business tier where
  // there isn't a single outlet context.
  useEffect(() => {
    if (!outletId || tier === 'platform' || tier === 'business') return;
    api.get(`/outlets/${outletId}`).then(({ data }) => {
      setOutletPrint({
        allowManual: !!data.data?.receiptAllowManualPrint,
        printerId: data.data?.receiptPrinterId ?? null,
      });
    }).catch(() => {});
  }, [outletId, tier]);

  // Debounced needle + sort key. The `search` state already exists
  // (used by the existing client-side filter); we lift its value to
  // the server with a 300ms debounce so each keystroke doesn't fire
  // a request. The server-side filter is broader (orderNumber, table,
  // customer name + phone) than the original client-side one.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'totalAmount' | 'orderNumber' | 'status'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // True when the last successful render came from the IDB snapshot —
  // surfaces a small "stale" banner so staff know what they're looking
  // at when the API is unreachable.
  const [snapshotAge, setSnapshotAge] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    // Cache-first for the outlet tier — the only tier staff use offline.
    // Platform/business tiers are admin-only and not relevant to offline
    // POS, so they skip the snapshot path.
    const isOutletTier =
      tier === 'outlet' ||
      (tier === 'business' && selectedOutletId && selectedOutletId !== 'ALL');
    const effectiveOutletId = tier === 'outlet'
      ? outletId
      : (tier === 'business' && selectedOutletId !== 'ALL' ? selectedOutletId : null);
    if (isOutletTier && effectiveOutletId) {
      const snap = await getOpenOrdersSnapshot(effectiveOutletId);
      if (snap?.orders?.length) {
        dispatch(setOrders(snap.orders));
        setSnapshotAge(snap.cachedAt);
        setLoading(false);
      }
    }

    try {
      // Same params object for every tier so the server applies search
      // + sort uniformly. Empty `search` is dropped by the backend.
      const params: Record<string, string | number | undefined> = {
        limit: 100,
        search: debouncedSearch || undefined,
        sortBy,
        sortDir,
      };
      let fetched: any[] | null = null;
      if (tier === 'platform') {
        const { data } = await api.get(`/orders`, { params });
        fetched = data.data.orders;
      } else if (tier === 'business' && businessId) {
        if (selectedOutletId !== 'ALL') {
          const { data } = await api.get(`/outlets/${selectedOutletId}/orders`, { params });
          fetched = data.data.orders;
        } else {
          const { data } = await api.get(`/orders`, { params: { ...params, businessId } });
          fetched = data.data.orders;
        }
      } else {
        const { data } = await api.get(`/outlets/${outletId}/orders`, { params });
        fetched = data.data.orders;
      }
      if (fetched) {
        dispatch(setOrders(fetched));
        setSnapshotAge(null);
        // Write-through to IDB so the next offline visit has a recent
        // snapshot to fall back to. Scoped to outlet-tier reads —
        // platform/business listings span multiple outlets and would
        // pollute the per-outlet keyed store.
        if (isOutletTier && effectiveOutletId) {
          setOpenOrdersSnapshot({
            outletId: effectiveOutletId,
            cachedAt: Date.now(),
            orders: fetched,
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      // Network failure with no usable snapshot → toast the error.
      // If the snapshot path above already painted, stay silent: the
      // "stale" banner is the user-visible signal.
      if (snapshotAge == null) {
        toast.error(e?.response?.data?.message || 'Could not load orders');
      }
    } finally { setLoading(false); }
  }, [tier, outletId, businessId, selectedOutletId, debouncedSearch, sortBy, sortDir, dispatch, snapshotAge]);

  useEffect(() => {
    fetchOrders();
    if (isReadOnly) return; // no per-outlet socket for cross-outlet views
    const socket = getSocket(outletId);
    socket.on('orderCreated', (o: any) => { dispatch(setOrders([o, ...orders])); toast.success(`New order — ${o.orderNumber}`); });
    socket.on('orderStatusUpdated', (o: any) => dispatch(updateOrder(o)));
    return () => { socket.off('orderCreated'); socket.off('orderStatusUpdated'); };
  }, [tier, outletId, businessId, selectedOutletId, debouncedSearch, sortBy, sortDir]);

  // Socket state + auto-backfill. The orders page is the cashier's main
  // view; missing a new order because the socket silently dropped is the
  // worst-case scenario. Re-fetch on every reconnect.
  const socketForStatus = !isReadOnly ? getSocket(outletId) : null;
  const { phase: socketPhase, reconnectedAt } = useSocketStatus(socketForStatus);
  useEffect(() => {
    if (reconnectedAt) fetchOrders();
  }, [reconnectedAt, fetchOrders]);

  // Persists the live Redux orders list back to the per-outlet
  // IndexedDB snapshot so the next offline cold-load reflects whatever
  // status changes were made between fetches.
  const persistSnapshot = (next: any[]) => {
    if (!outletId || tier !== 'outlet') return;
    setOpenOrdersSnapshot({ outletId, cachedAt: Date.now(), orders: next }).catch(() => {});
  };

  const advance = async (orderId: string, status: string) => {
    setSaving(true);
    // Optimistic update — apply locally first so the UI reflects the
    // click immediately even when the network round-trip is slow or
    // queued via the outbox. The api interceptor handles retry +
    // outbox queue for infra-transient errors (502/503/504/network),
    // so the optimistic state stays correct without us repainting on
    // failure. actedAt preserves the real action time across the
    // outbox replay window.
    const actedAt = new Date().toISOString();
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      const optimistic = { ...target, status, statusUpdatedAt: actedAt };
      dispatch(updateOrder(optimistic));
      if (detail?.id === orderId) setDetail((d: any) => ({ ...d, status, statusUpdatedAt: actedAt }));
      persistSnapshot(orders.map((o) => (o.id === orderId ? optimistic : o)));
    }
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${orderId}/status`, { status, actedAt });
      dispatch(updateOrder(data.data));
      if (detail?.id === orderId) setDetail(data.data);
      toast.success(`→ ${STATUS[status].label}`);
    } catch (e: any) {
      // Application errors (4xx/500) revert; infra-transient errors
      // (no response or 502/503/504) leave the optimistic state in
      // place and rely on the outbox replay.
      const httpStatus = e?.response?.status ?? 0;
      const isInfraTransient = !e?.response || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
      if (isInfraTransient) {
        toast.success(`Queued — will sync when network is back`, { icon: '📡' });
      } else if (target) {
        dispatch(updateOrder(target));
        if (detail?.id === orderId) setDetail(target);
        toast.error(e.response?.data?.message || 'Failed');
      }
    }
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

  // Enriched per-order log (status / time / staff). Tier 'outlet' admins
  // and 'business' owners always have access; other roles need
  // VIEW_ORDER_LOG. Cleared on detail close so we don't leak across
  // orders when the modal reopens for a different one.
  const canViewLog = tier === 'outlet' || tier === 'business' || has('VIEW_ORDER_LOG');
  const [orderLog, setOrderLog] = useState<any | null>(null);
  const openDetail = async (order: any) => {
    const url = isReadOnly
      ? `/orders/${order.id}`
      : `/outlets/${order.outletId || outletId}/orders/${order.id}`;
    try { const { data } = await api.get(url); setDetail(data.data); }
    catch { setDetail(order); }
    setOrderLog(null);
    if (canViewLog) {
      try {
        const targetOutlet = order.outletId || outletId;
        const { data } = await api.get(`/outlets/${targetOutlet}/orders/${order.id}/log`);
        setOrderLog(data.data);
      } catch {
        // Falls back to the basic Timeline if log fetch fails (e.g. a
        // role with VIEW_ORDERS but no VIEW_ORDER_LOG would 403 here).
      }
    }
  };

  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const advanceItem = async (orderId: string, itemId: string, nextStatus: ItemStatus) => {
    setPendingItem(itemId);
    // Same optimistic + actedAt pattern as advance(). We don't try to
    // compute the rolled-up order status locally — the next successful
    // fetch will reconcile, and the outbox replay returns the truth
    // from the server when the network is back.
    const actedAt = new Date().toISOString();
    const targetOrder = orders.find((o) => o.id === orderId);
    const optimisticOrder = targetOrder ? {
      ...targetOrder,
      items: (targetOrder.items || []).map((it: any) =>
        it.id === itemId ? { ...it, status: nextStatus } : it,
      ),
    } : null;
    if (optimisticOrder) {
      dispatch(updateOrder(optimisticOrder));
      if (detail?.id === orderId) {
        setDetail((d: any) => d ? ({
          ...d,
          items: (d.items || []).map((it: any) => it.id === itemId ? { ...it, status: nextStatus } : it),
        }) : d);
      }
      persistSnapshot(orders.map((o) => (o.id === orderId ? optimisticOrder : o)));
    }
    try {
      const targetOutlet = detail?.outletId || outletId;
      const { data } = await api.patch(
        `/outlets/${targetOutlet}/orders/${orderId}/items/${itemId}/status`,
        { status: nextStatus, actedAt },
      );
      if (data.data?.order) {
        const updated = data.data.order;
        dispatch(updateOrder(updated));
        if (detail?.id === orderId) setDetail(updated);
        if (data.data.rolledUp) toast.success(`Order moved to ${data.data.rolledUp}`);
        else toast.success('Item updated');
      }
    } catch (e: any) {
      const httpStatus = e?.response?.status ?? 0;
      const isInfraTransient = !e?.response || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
      if (isInfraTransient) {
        toast.success(`Queued — will sync when network is back`, { icon: '📡' });
      } else if (targetOrder) {
        dispatch(updateOrder(targetOrder));
        if (detail?.id === orderId) setDetail(targetOrder);
        toast.error(e.response?.data?.message || 'Failed');
      }
    }
    finally { setPendingItem(null); }
  };

  // OR-composition across the selected filters:
  //   • ALL wins outright
  //   • ACTIVE matches any non-terminal status
  //   • any specific status matches itself
  const matchesFilter = (status: string) => {
    if (filterSet.has('ALL')) return true;
    if (filterSet.has(status)) return true;
    if (filterSet.has('ACTIVE') && !TERMINAL_STATUSES.has(status)) return true;
    return false;
  };
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
    // Service-station blink: card pulses while the order is sitting in a
    // hand-off state (out of the kitchen, awaiting delivery / pickup).
    // Drops as soon as the order moves to SERVED.
    const needsServiceAction = order.status === 'READY'
      || order.status === 'READY_FOR_PICKUP'
      || order.status === 'OUT_FOR_SERVICE';
    const cardItems = visibleItems(order.items || []);
    // Hide cards that have no items relevant to my station
    if ((tier === 'kitchen' || tier === 'counter') && myStations.length > 0 && !stationIsMaster && cardItems.length === 0) {
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
        className={clsx(
          'rounded-2xl border bg-white shadow-card overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow',
          isNew && 'ring-2 ring-blue-200',
          needsServiceAction && 'attn-blink-teal',
        )}
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

        {/* Items list with per-item advance. The list area itself is clickable
            (bubbles up to the card → opens detail); only the per-item advance
            button stops propagation. */}
        <div className="px-3 py-2 flex-1 space-y-1.5">
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
                  {item.notes && (
                    <p className="text-[10px] text-indigo-600 truncate">{item.notes}</p>
                  )}
                </div>
                {!isReadOnly && !terminal && next && (next.status !== 'SERVED' || canMarkServed) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); advanceItem(order.id, item.id, next.status); }}
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

        {/* Footer — order-level actions. Empty areas of the footer still
            bubble up to open the detail; only the action buttons stop the
            propagation. Cancel was removed: it's now available from the
            detail view to avoid accidental clicks. */}
        <div className="px-3 py-2 border-t border-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {!isReadOnly && commonNext && (commonNext.status !== 'SERVED' || canMarkServed) && (
              <button
                onClick={(e) => { e.stopPropagation(); advanceAll(e as any); }}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-gold-500 hover:bg-gold-600 text-charcoal-900"
                title={`Mark all items as ${commonNext.label}`}
              >
                All → {commonNext.label}
              </button>
            )}
            {isReadOnly && canAccept && order.status === 'CREATED' && (
              <button
                onClick={(e) => { e.stopPropagation(); advance(order.id, 'QUEUED'); }}
                disabled={saving}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-brand-500 text-white"
              >
                Accept
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Inline filters next to the title — the most-used presets. The rest live
  // behind a "Status" dropdown opened with the Filter button to save space.
  const INLINE_FILTERS = ['ACTIVE', 'ALL'];
  const MORE_FILTERS = FILTERS.filter((f) => !INLINE_FILTERS.includes(f));

  return (
    // Full-height flex column so the orders grid below claims every pixel of
    // remaining vertical space. The Layout wrapper already gives this page a
    // bounded scroll viewport; we just take all of it. In fullscreen we layer
    // our own background since the Layout is bypassed.
    <div ref={pageRef} className={clsx('flex flex-col gap-3', fullscreen ? 'bg-slate-50 p-4 h-screen' : 'h-[calc(100dvh-7rem)]')}>
      {/* Single-line header. The status filter pills sit inline with the
          "Orders" title; the rest of the action cluster (search, fullscreen,
          refresh) hugs the right edge. Wraps on small screens. */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <h1 className="page-title m-0">Orders</h1>
        <span className="text-xs text-slate-400 mr-2">
          {orders.length} {tier === 'platform' ? 'across platform' : tier === 'business' ? 'across outlets' : 'today'}
        </span>

        {/* Primary filter pills — multi-select. Click toggles in/out of the set. */}
        {INLINE_FILTERS.map((f) => {
          const active = filterSet.has(f);
          return (
            <button key={f} onClick={() => toggleFilter(f)}
              className={clsx('filter-pill', active ? 'filter-pill-active' : 'filter-pill-inactive')}>
              {FILTER_LABEL[f] ?? STATUS[f]?.label}
              {counts[f] > 0 && (
                <span className={clsx('inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ml-1',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                  {counts[f]}
                </span>
              )}
            </button>
          );
        })}

        {/* "More" dropdown — checkbox rows. Each row toggles that specific
            status in/out of the active filter set. The trigger pill counts
            how many specific statuses are currently selected. */}
        <div className="relative" ref={statusMenuRef}>
          {(() => {
            const selectedSpecific = MORE_FILTERS.filter((f) => filterSet.has(f));
            const hasAny = selectedSpecific.length > 0;
            const label = !hasAny
              ? 'Status'
              : selectedSpecific.length === 1
                ? (FILTER_LABEL[selectedSpecific[0]] ?? STATUS[selectedSpecific[0]]?.label)
                : `Status · ${selectedSpecific.length}`;
            return (
              <button
                onClick={() => setStatusMenuOpen((v) => !v)}
                className={clsx('filter-pill inline-flex items-center gap-1',
                  hasAny ? 'filter-pill-active' : 'filter-pill-inactive',
                )}
              >
                <Filter size={11} />
                {label}
                <ChevronDown size={11} />
              </button>
            );
          })()}
          {statusMenuOpen && (
            <div className="absolute z-30 top-full mt-1 left-0 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1 max-h-80 overflow-y-auto">
              {MORE_FILTERS.map((f) => {
                const active = filterSet.has(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggleFilter(f)}
                    className={clsx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm hover:bg-slate-50',
                      active && 'bg-brand-50 text-brand-700 font-semibold')}
                  >
                    <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                      active ? 'bg-brand-500 border-brand-500' : 'border-slate-300')}>
                      {active && <span className="w-1.5 h-1.5 rounded-sm bg-white" />}
                    </span>
                    <span className="flex-1 truncate">{FILTER_LABEL[f] ?? STATUS[f]?.label}</span>
                    {counts[f] > 0 && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {counts[f]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right-aligned action cluster */}
        <div className="flex items-center gap-2 ml-auto">
          {tier === 'business' && businessOutlets.length > 0 && (
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="input py-1.5 text-xs"
              style={{ minWidth: 140 }}
            >
              <option value="ALL">All outlets</option>
              {businessOutlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}

          {/* Collapsible search — icon-only by default, expands on click. */}
          {searchOpen ? (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
                placeholder="Order #, table, customer, phone"
                className="input pl-7 pr-7 py-1.5 text-xs"
                style={{ width: 180 }}
              />
              <button
                onClick={() => { setSearch(''); setSearchOpen(false); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                title="Close search"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
              title="Search orders"
            >
              <Search size={14} />
            </button>
          )}

          {/* Sort dropdown + asc/desc toggle. Server-side; refetches
              when either side changes via the effect on fetchOrders. */}
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input py-1.5 text-xs"
              style={{ width: 130 }}
              title="Sort by"
            >
              <option value="createdAt">Newest</option>
              <option value="totalAmount">Total</option>
              <option value="orderNumber">Order #</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
              title={sortDir === 'asc' ? 'Switch to descending' : 'Switch to ascending'}
            >
              {sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
            title={fullscreen ? 'Exit full screen' : 'Full screen (good for landscape on mobile)'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button className="btn-ghost p-2 text-slate-500 hover:text-slate-800" onClick={fetchOrders} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Socket state pill — hidden for cross-outlet views (no socket). */}
          {!isReadOnly && (
            <span
              className={
                'inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border ' +
                (socketPhase === 'connected'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : socketPhase === 'reconnecting'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-700')
              }
              title={
                socketPhase === 'connected'
                  ? 'Real-time channel connected'
                  : socketPhase === 'reconnecting'
                    ? 'Reconnecting — orders will sync once the channel is back'
                    : 'Real-time channel disconnected — orders may be stale'
              }
            >
              <span
                className={
                  'w-1.5 h-1.5 rounded-full ' +
                  (socketPhase === 'connected'
                    ? 'bg-emerald-500'
                    : socketPhase === 'reconnecting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-red-500')
                }
              />
              {socketPhase === 'connected' ? 'Live' : socketPhase === 'reconnecting' ? 'Reconnecting' : 'Offline'}
            </span>
          )}

          {isReadOnly && (
            <span className="badge badge-slate"><Eye size={10} /> View only</span>
          )}
        </div>
      </div>

      {/* Stale-snapshot banner. Surfaces only when the last successful
          render came from the IDB offline cache, not a live API call.
          Tells staff what they're looking at so they don't act on
          out-of-date state without realising. */}
      {snapshotAge && (
        <div className="mb-3 -mx-1 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-[12px] text-amber-800 flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200/60">
            <RefreshCw size={11} className="text-amber-700" />
          </span>
          <span className="font-semibold">Offline — showing last-saved orders</span>
          <span className="text-amber-700/70">
            cached {Math.max(0, Math.round((Date.now() - snapshotAge) / 60000))} min ago
          </span>
        </div>
      )}

      {/* Grid — claims all remaining vertical space via flex-1 + min-h-0.
          Order cards flow top-to-bottom through CSS columns; once a column
          is full the next card spills into the next column to the right.
          Vertical overflow is hidden so the layout doesn't grow past the
          viewport — extra columns scroll horizontally instead. */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-44 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state flex-shrink-0">
          <div className="empty-state-icon"><ShoppingBag size={22} className="text-slate-400" /></div>
          <p className="text-sm font-semibold text-slate-600">No orders found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filter or search</p>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="orders-cards-wrapper flex-1 pb-2 min-w-0 h-full">
            <div className="orders-cards-columns">
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
              {detail
                && !['CANCELLED', 'REFUND_COMPLETE'].includes(detail.status)
                && (detail.payments || []).some((p: any) => p.status === 'SUCCESS' && !p.isRefund)
                && (tier === 'outlet' || has('CANCEL_ORDER'))
                && (
                  <button
                    onClick={() => setRefundTarget(detail)}
                    className="btn-secondary btn-sm"
                    title="File a refund (partial or full) against this order"
                  >
                    <RotateCcw size={13} /> Refund
                  </button>
                )}
              <div className="flex-1" />
              {(() => {
                if (!detail) return null;
                const step = nextStatusFor(detail.status, {
                  outletType: detail.outlet?.outletType,
                  tableId: detail.tableId,
                  isParcel: detail.isParcel,
                });
                if (!step) return null;
                // Kitchen tier can advance to anything except SERVED —
                // the handoff to service staff is intentional, so the
                // kitchen can't accidentally close out an order the
                // customer hasn't received yet.
                if (step.next === 'SERVED' && !canMarkServed) return null;
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
              {outletPrint.allowManual && outletPrint.printerId && isBluetoothSupported() && (
                <button
                  onClick={printDetailReceipt}
                  disabled={printing}
                  className="btn-secondary"
                  title="Send the receipt to the configured bluetooth printer"
                >
                  {printing && <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />}
                  <PrinterIcon size={14} /> Print Receipt
                </button>
              )}
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

            {/* Course planner */}
            <CoursePlanner
              order={detail}
              onSaved={(updated) => setDetail(updated)}
            />

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
                      <span className="w-7 h-7 bg-brand-100 text-brand-900 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                        {item.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.item?.name}</p>
                        {item.variant && <p className="text-xs text-slate-400">{item.variant.name}</p>}
                        {item.notes && (
                          <p className="text-[11px] text-indigo-600 mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      {item.sequenceNumber != null && (
                        <span
                          className={clsx(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
                            item.sequenceNumber <= (detail.activeSequence ?? 1)
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-slate-100 border-slate-200 text-slate-500',
                          )}
                          title={item.sequenceNumber > (detail.activeSequence ?? 1) ? 'Held until prior course is served' : 'Active course'}
                        >
                          {(detail.sequenceLabels?.[String(item.sequenceNumber)] || `Course ${item.sequenceNumber}`)}
                        </span>
                      )}
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
                                                              'linear-gradient(135deg,#0B4245,#073032)',
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
            {/* Timeline — enriched (with actor) when VIEW_ORDER_LOG is
                granted and the log endpoint has loaded; otherwise the
                basic status+time fallback baked into the order detail. */}
            {orderLog?.entries?.length ? (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Order log</p>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {orderLog.entries.map((h: any) => (
                    <div key={h.id} className="flex items-center gap-3 px-3 py-2 text-xs bg-white">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS[h.status]?.dot }} />
                      <span className="font-medium text-slate-700 min-w-[110px]">{STATUS[h.status]?.label || h.status}</span>
                      <div className="flex-1 min-w-0">
                        {h.actor ? (
                          <span className="text-slate-600 truncate">
                            <span className="font-semibold">{h.actor.name}</span>
                            {h.actor.role && <span className="text-slate-400"> · {h.actor.role}</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">system</span>
                        )}
                        {h.notes && (
                          <p className="text-[11px] text-slate-400 truncate">{h.notes}</p>
                        )}
                      </div>
                      <span className="text-slate-400 whitespace-nowrap" title={new Date(h.at).toLocaleString('en-IN')}>
                        {new Date(h.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : detail.statusHistory?.length > 0 ? (
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
            ) : null}
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

      {/* Refund modal — partial or full refund against the order.
          Defaults to a full refund (totalAmount); operator can edit.
          The /refunds page handles the approval lifecycle from here. */}
      <Modal
        open={!!refundTarget}
        onClose={() => { setRefundTarget(null); setRefundAmount(''); setRefundReason(''); }}
        title="Initiate Refund"
        subtitle={refundTarget?.orderNumber}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRefundTarget(null)}>Cancel</button>
            <button
              className="btn-danger"
              disabled={refundSubmitting || !refundAmount || Number(refundAmount) <= 0}
              onClick={async () => {
                if (!refundTarget) return;
                setRefundSubmitting(true);
                try {
                  await api.post(`/outlets/${refundTarget.outletId || outletId}/refunds`, {
                    orderId: refundTarget.id,
                    amount: Number(refundAmount),
                    reason: refundReason || undefined,
                  });
                  toast.success('Refund filed — review on the Refunds page for approval');
                  setRefundTarget(null);
                  setRefundAmount('');
                  setRefundReason('');
                } catch (e: any) {
                  toast.error(e?.response?.data?.message || 'Refund failed');
                } finally {
                  setRefundSubmitting(false);
                }
              }}
            >
              <RotateCcw size={13} /> File Refund
            </button>
          </>
        }
      >
        {refundTarget && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Files an INITIATED refund. A manager (anyone with cancel-order rights) approves it on the
              Refunds page; cash refunds settle at the cashier's drawer on approval, gateway refunds
              fire Razorpay's refund API and complete via webhook.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Order total</p>
                <p className="text-sm font-semibold text-slate-900 tabular-nums">₹{Number(refundTarget.totalAmount ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Source payment</p>
                <p className="text-sm font-semibold text-slate-900">
                  {(refundTarget.payments || []).find((p: any) => p.status === 'SUCCESS' && !p.isRefund)?.mode ?? '—'}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Refund amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={Number(refundTarget.totalAmount ?? 0)}
                value={refundAmount || String(refundTarget.totalAmount ?? 0)}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Reason (optional)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="input resize-none"
                rows={2}
                placeholder="Customer dissatisfied, wrong order, duplicate charge…"
              />
            </div>
          </div>
        )}
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
