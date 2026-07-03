import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Search, Clock, ShoppingBag, ArrowRight, X, RefreshCw, Eye, Play, Bell, Utensils, Plus, Tag as TagIcon, User, Download, Maximize2, Minimize2, Filter, ChevronDown, Printer as PrinterIcon, ArrowUp, ArrowDown, RotateCcw, Users as UsersIcon, Trash2 } from 'lucide-react';
import { RootState } from '../../store';
import { setOrders, updateOrder } from '../../store/slices/ordersSlice';
import { getSocket } from '../../services/socket';
import { useSocketStatus } from '../../hooks/useSocketStatus';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';
import { isPrinterConnected, isPrinterPaired, ensurePrinterConnected, isBluetoothSupported, connectPrinter, printCustomerReceipt, printPackingSlip } from '../../utils/bluetoothPrinter';
import { buildReceiptPayload, buildPackingSlipPayload, isAggregatorOrder } from '../../utils/receiptPayload';
import { getOpenOrdersSnapshot, setOpenOrdersSnapshot } from '../../utils/idb';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import ThermalReceipt from '../../components/receipt/ThermalReceipt';
import { downloadReceiptPdf } from '../../components/receipt/downloadReceiptPdf';
import Modal from '../../components/common/Modal';
import CoursePlanner from '../../components/orders/CoursePlanner';

// Status palette. `labelKey` is an i18n key stem (orders.status*) resolved
// at render time by the components that display statuses; labels are no
// longer baked in here so switching language re-renders the badge text.
const STATUS: Record<string, { labelKey: string; dot: string; bg: string; text: string; border: string }> = {
  CREATED:          { labelKey: 'statusCreated',        dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  QUEUED:           { labelKey: 'statusQueued',         dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  PREPARING:        { labelKey: 'statusPreparing',      dot: '#0B4245', bg: '#e8efef', text: '#04181a', border: '#D2E5DF' },
  READY:            { labelKey: 'statusReady',          dot: '#10b981', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  READY_FOR_PICKUP: { labelKey: 'statusReadyForPickup', dot: '#2563eb', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  OUT_FOR_SERVICE:  { labelKey: 'statusOutForService',  dot: '#14b8a6', bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
  SERVED:           { labelKey: 'statusServed',         dot: '#64748b', bg: '#FAFAFA', text: '#475569', border: '#e2e8f0' },
  CANCELLED:        { labelKey: 'statusCancelled',      dot: '#ef4444', bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  DISPUTED:         { labelKey: 'statusDisputed',       dot: '#8b5cf6', bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  RESOLVED:         { labelKey: 'statusResolved',       dot: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
  FOR_REFUND:       { labelKey: 'statusForRefund',      dot: '#ec4899', bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  REFUND_COMPLETE:  { labelKey: 'statusRefundComplete', dot: '#a855f7', bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
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
// `labelKey` is an i18n key stem (orders.next*) resolved at render time
// by whichever button uses it.
function nextStatusFor(current: string, ctx: StatusCtx): { next: string; labelKey: string } | null {
  if (current === 'CREATED')          return { next: 'QUEUED',          labelKey: 'nextAccept' };
  if (current === 'OUT_FOR_SERVICE')  return { next: 'SERVED',          labelKey: 'nextMarkServed' };
  if (current === 'READY_FOR_PICKUP') return { next: 'SERVED',          labelKey: 'nextMarkPickedUp' };
  if (current === 'FOR_REFUND')       return { next: 'REFUND_COMPLETE', labelKey: 'nextMarkRefunded' };
  if (current === 'READY') {
    // Parcel: go through the pickup-counter step so the customer gets the alert.
    if (ctx.isParcel) return { next: 'READY_FOR_PICKUP', labelKey: 'nextReadyForPickup' };
    return needsOutForService(ctx.outletType, ctx.tableId)
      ? { next: 'OUT_FOR_SERVICE', labelKey: 'nextOutForService' }
      : { next: 'SERVED',          labelKey: 'nextMarkServed' };
  }
  return null;
}
const FILTERS = ['ACTIVE','ALL','CREATED','QUEUED','PREPARING','READY','READY_FOR_PICKUP','OUT_FOR_SERVICE','SERVED','CANCELLED','DISPUTED','RESOLVED','FOR_REFUND','REFUND_COMPLETE'];
const FILTER_LABEL_KEY: Record<string, string> = {
  ACTIVE: 'filterActive',
  ALL:    'filterAll',
};
// Terminal states excluded from the default "Active" view.
const TERMINAL_STATUSES = new Set(['SERVED', 'CANCELLED']);

type ItemStatus = 'PENDING_VERIFICATION' | 'PENDING' | 'PREPARING' | 'READY' | 'PACKED' | 'SERVED' | 'CANCELLED';

const ITEM_STATUS: Record<ItemStatus, { labelKey: string; bg: string; text: string; border: string; dot: string }> = {
  PENDING_VERIFICATION: { labelKey: 'itemAwaitingVerify', bg: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
  PENDING:   { labelKey: 'itemPending',   bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  PREPARING: { labelKey: 'itemPreparing', bg: '#e8efef', text: '#04181a', border: '#D2E5DF', dot: '#0B4245' },
  READY:     { labelKey: 'itemReady',     bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#10b981' },
  // Parcel-only intermediate between READY and SERVED. The parcel-desk
  // page drives PACKED → READY_FOR_PICKUP via the order-level rollup;
  // the admin view is read-only on this status (no NEXT_ITEM mapping).
  PACKED:    { labelKey: 'itemPacked',    bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  SERVED:    { labelKey: 'itemServed',    bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', dot: '#14b8a6' },
  CANCELLED: { labelKey: 'itemCancelled', bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#ef4444' },
};
// PENDING_VERIFICATION intentionally has no NEXT_ITEM mapping — the kitchen
// can't advance it; only the service desk (via the dashboard) flips it to
// PENDING after confirming with the customer.
const NEXT_ITEM: Partial<Record<ItemStatus, { status: ItemStatus; labelKey: string; icon: any }>> = {
  PENDING:   { status: 'PREPARING', labelKey: 'nextStart',  icon: Play },
  PREPARING: { status: 'READY',     labelKey: 'nextReady',  icon: Bell },
  READY:     { status: 'SERVED',    labelKey: 'nextServed', icon: Utensils },
};
const STEP_ORDER: ItemStatus[] = ['PENDING', 'PREPARING', 'READY', 'SERVED'];

function elapsed(t: string) {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h${m%60}m`;
}

export default function OrdersPage() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
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
    auto: boolean;
    printerId: string | null;
  }>({ allowManual: false, auto: false, printerId: null });

  // Tracks aggregator-order ids we've already auto-printed slips for
  // this session — guards against double-prints from re-emits on
  // socket reconnect or an updated-then-updated-again rollup. Cleared
  // on page reload (which is fine; the slip was physically printed
  // and the operator can reprint manually if needed).
  const autoPrintedSlipsRef = useRef<Set<string>>(new Set());
  // Same idea but for the customer receipt auto-print path: dedupes
  // direct customer orders so a single placement only prints once even
  // if orderCreated re-emits on socket reconnect.
  const autoPrintedReceiptsRef = useRef<Set<string>>(new Set());

  // Bump-on-pair so the "Connect printer" pill below can re-render
  // after a successful pairing flips printerReady from false to true.
  // BLE state lives outside React, so a tick state is the cheapest
  // way to make this reactive without polling.
  const [printerTick, setPrinterTick] = useState(0);
  const printerReady = !!outletPrint.printerId && isPrinterConnected(outletPrint.printerId);
  void printerTick;
  const connectReceiptPrinter = async () => {
    if (!outletPrint.printerId) return;
    try {
      await connectPrinter(outletPrint.printerId);
      setPrinterTick((tk) => tk + 1);
      toast.success(t('orders.toastReceiptPrinter'));
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') toast.error(e?.message || t('orders.toastPairingCancelled'));
    }
  };

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
      // Aggregator orders get a packing slip instead of the customer
      // receipt — the customer paid the marketplace at a different
      // price and GST was collected by the aggregator, so showing our
      // pricing on the parcel would mislead. The slip is items +
      // quantities + variants/toppings + customer notes, ready to
      // staple to the delivery bag.
      if (isAggregatorOrder(payload)) {
        await printPackingSlip(outletPrint.printerId, buildPackingSlipPayload(payload));
        toast.success(t('orders.toastPackingSlipPrinted'));
      } else {
        await printCustomerReceipt(outletPrint.printerId, buildReceiptPayload(payload));
        toast.success(t('orders.toastReceiptPrinted'));
      }
    } catch (e: any) {
      toast.error(e?.message || t('orders.toastPrintFailed'));
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

  // Split-bill modal state. Each split is one cash Payment row that
  // auto-confirms on initiate. Mixed cash + UPI splits are out of
  // scope for the modal — staff can run UPI shares through the
  // regular pay flow individually until the balance reaches zero.
  const [splitTarget, setSplitTarget] = useState<any>(null);
  const [splitRows, setSplitRows] = useState<Array<{ amount: string; label: string; phone: string }>>([]);
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  // Reload trigger for the per-share status panel below the detail.
  const [shareReload, setShareReload] = useState(0);
  const splitOutstanding = (() => {
    if (!splitTarget) return 0;
    const total = Number(splitTarget.totalAmount ?? 0);
    const paid = (splitTarget.payments ?? [])
      .filter((p: any) => p.status === 'SUCCESS' && !p.isRefund)
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    return Math.max(0, total - paid);
  })();
  const splitSumAssigned = splitRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const splitRemaining = Math.max(0, splitOutstanding - splitSumAssigned);

  const openSplitFor = (order: any, ways = 2) => {
    const total = Number(order.totalAmount ?? 0);
    const paid = (order.payments ?? [])
      .filter((p: any) => p.status === 'SUCCESS' && !p.isRefund)
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const outstanding = Math.max(0, total - paid);
    // Round to 2 dp; absorb any remainder onto the last row so the
    // splits sum exactly to the outstanding amount.
    const evenShare = Math.floor((outstanding / ways) * 100) / 100;
    const rows = Array.from({ length: ways }, (_, i) => ({
      amount: (i === ways - 1
        ? (outstanding - evenShare * (ways - 1)).toFixed(2)
        : evenShare.toFixed(2)),
      label: '',
      phone: '',
    }));
    setSplitTarget(order);
    setSplitRows(rows);
  };
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
        // Auto-print flag — used here to auto-fire the aggregator
        // packing slip when an inbound order reaches READY. Same flag
        // PlaceOrderPage uses to auto-print a direct order's receipt
        // at placement time, so the operator config is one switch.
        auto: !!data.data?.receiptAutoPrint,
        printerId: data.data?.receiptPrinterId ?? null,
      });
    }).catch(() => {});
  }, [outletId, tier]);

  // Auto-print the packing slip for aggregator orders the moment they
  // reach READY. Fires once per order id per session (autoPrintedSlipsRef
  // dedupes), and is fully best-effort — print failures toast but don't
  // disrupt the order flow. The staff still has the manual "Print
  // Packing Slip" button on the detail modal as a fallback. Why READY
  // specifically:
  //   - Inbound aggregator order arrives → CREATED. Kitchen starts on
  //     it → PREPARING. Once every item is done → rollup to READY.
  //   - That READY transition is the right moment to print: the food
  //     is cooked, ready to bag, and the rider may already be at the
  //     counter waiting for the parcel.
  // Auto-print the customer receipt the moment a direct (non-aggregator)
  // order shows up over the socket. Same outlet flag PlaceOrderPage uses
  // for cashier-placed orders (receiptAutoPrint) — that path covers
  // cashier flow; this one covers customer-PWA placements which the
  // cashier never touches. Skips aggregator orders entirely (those use
  // the packing-slip path above). Reconnects the BLE link silently via
  // ensurePrinterConnected so it works after the link has gone idle.
  // One-per-session nag for the "auto-print on, printer not paired"
  // case so staff aren't left wondering why nothing's printing. Module-
  // scoped via ref to avoid spamming on every incoming order.
  const autoPrintNaggedRef = useRef(false);
  const autoPrintCustomerReceipt = useCallback(async (order: any) => {
    if (!order) return;
    if (isAggregatorOrder(order)) return;
    if (!outletPrint.auto || !outletPrint.printerId) return;
    if (!isBluetoothSupported()) return;
    if (autoPrintedReceiptsRef.current.has(order.id)) return;
    // Pairing check has to run BEFORE we mark the order as auto-printed
    // — otherwise an order arriving pre-pairing gets permanently
    // skipped even if the staff connects the printer a moment later.
    if (!isPrinterPaired(outletPrint.printerId)) {
      if (!autoPrintNaggedRef.current) {
        autoPrintNaggedRef.current = true;
        toast(
          t('orders.toastAutoPrintNag', { number: order.orderNumber }),
          { icon: '🖨️', duration: 7000 },
        );
      }
      return;
    }
    autoPrintedReceiptsRef.current.add(order.id);
    try {
      await ensurePrinterConnected(outletPrint.printerId);
      // Hit the detail endpoint so the receipt has totals + tax rows +
      // outlet header snapshot; the socket payload is lighter.
      const { data } = await api.get(`/outlets/${order.outletId || outletId}/orders/${order.id}`);
      const full = data?.data ?? order;
      await printCustomerReceipt(outletPrint.printerId, buildReceiptPayload(full));
      toast.success(t('orders.toastReceiptAutoPrinted', { number: order.orderNumber }), { icon: '🖨️' });
    } catch (e: any) {
      // Rollback so a manual retry isn't blocked by the dedupe.
      autoPrintedReceiptsRef.current.delete(order.id);
      toast.error(e?.message || t('orders.toastReceiptAutoFailed'));
    }
  }, [outletPrint.auto, outletPrint.printerId, outletId, t]);

  const autoPrintAggregatorSlip = useCallback(async (order: any) => {
    if (!order || order.status !== 'READY') return;
    if (!isAggregatorOrder(order)) return;
    if (!outletPrint.auto || !outletPrint.printerId) return;
    if (!isBluetoothSupported()) return;
    if (autoPrintedSlipsRef.current.has(order.id)) return;
    autoPrintedSlipsRef.current.add(order.id);
    try {
      // Hit the detail endpoint so we have the aggregatorOrder.externalOrderId
      // and the full item/variant/topping fan-out. The socket payload
      // is the lighter list shape and may not include all of that.
      const { data } = await api.get(`/outlets/${order.outletId || outletId}/orders/${order.id}`);
      const full = data?.data ?? order;
      if (!isPrinterConnected(outletPrint.printerId)) {
        // Don't pop the BT chooser unannounced for an auto-print;
        // staff would think the page is hijacking input. Skip
        // silently — they'll get the slip via the manual button.
        return;
      }
      await printPackingSlip(outletPrint.printerId, buildPackingSlipPayload(full));
      toast.success(t('orders.toastSlipAutoPrinted', { number: order.orderNumber }), { icon: '🖨️' });
    } catch (e: any) {
      // Let the dedupe stand even on failure — repeated failed prints
      // create noise without value. Operator can manual-print.
      toast.error(e?.message || t('orders.toastAutoFailedManual'));
    }
  }, [outletPrint.auto, outletPrint.printerId, outletId, t]);

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
        toast.error(e?.response?.data?.message || t('orders.toastCouldNotLoad'));
      }
    } finally { setLoading(false); }
  }, [tier, outletId, businessId, selectedOutletId, debouncedSearch, sortBy, sortDir, dispatch, snapshotAge]);

  useEffect(() => {
    fetchOrders();
    if (isReadOnly) return; // no per-outlet socket for cross-outlet views
    const socket = getSocket(outletId);
    socket.on('orderCreated', (o: any) => {
      dispatch(setOrders([o, ...orders]));
      toast.success(t('orders.toastNewOrder', { number: o.orderNumber }));
      // Fire-and-forget customer-receipt auto-print. Dedupes per
      // session, skips aggregator orders, and silently bails if the
      // printer was never paired. Direct customer-PWA placements rely
      // on this — PlaceOrderPage's local maybeAutoPrintReceipt only
      // covers cashier-placed orders.
      void autoPrintCustomerReceipt(o);
    });
    socket.on('orderStatusUpdated', (o: any) => {
      dispatch(updateOrder(o));
      // Fire-and-forget — autoPrintAggregatorSlip dedupes internally
      // and only runs for aggregator orders that just hit READY.
      void autoPrintAggregatorSlip(o);
    });
    return () => { socket.off('orderCreated'); socket.off('orderStatusUpdated'); };
  }, [tier, outletId, businessId, selectedOutletId, debouncedSearch, sortBy, sortDir, autoPrintAggregatorSlip, autoPrintCustomerReceipt]);

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
      toast.success(t('orders.toastAdvanceTemplate', { status: t(`orders.${STATUS[status].labelKey}`) }));
    } catch (e: any) {
      // Application errors (4xx/500) revert; infra-transient errors
      // (no response or 502/503/504) leave the optimistic state in
      // place and rely on the outbox replay.
      const httpStatus = e?.response?.status ?? 0;
      const isInfraTransient = !e?.response || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
      if (isInfraTransient) {
        toast.success(t('orders.toastQueuedNetwork'), { icon: '📡' });
      } else if (target) {
        dispatch(updateOrder(target));
        if (detail?.id === orderId) setDetail(target);
        toast.error(e.response?.data?.message || t('orders.toastFailed'));
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
      toast.success(t('orders.toastOrderCancelled'));
      setCancelTarget(null); setCancelReason('');
    } catch (e: any) { toast.error(e.response?.data?.message || t('orders.toastFailed')); }
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
        if (data.data.rolledUp) toast.success(t('orders.toastOrderRolledUp', { status: data.data.rolledUp }));
        else toast.success(t('orders.toastItemUpdated'));
      }
    } catch (e: any) {
      const httpStatus = e?.response?.status ?? 0;
      const isInfraTransient = !e?.response || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
      if (isInfraTransient) {
        toast.success(t('orders.toastQueuedNetwork'), { icon: '📡' });
      } else if (targetOrder) {
        dispatch(updateOrder(targetOrder));
        if (detail?.id === orderId) setDetail(targetOrder);
        toast.error(e.response?.data?.message || t('orders.toastFailed'));
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
              {order.table ? t('orders.cardTable', { number: order.table.number }) : order.isParcel ? t('orders.cardParcel') : t('orders.cardCounter')}
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold">
              <Clock size={10} /> {elapsed(order.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            {order.tokenNumber != null && (
              <p className="text-[11px] font-bold">{t('orders.cardTokenNumber', { number: order.tokenNumber })}</p>
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
                  title={t(`orders.${its.labelKey}`)}
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
                    title={t('orders.cardMarkTitle', { label: t(`orders.${next.labelKey}`) })}
                  >
                    →
                  </button>
                )}
              </div>
            );
          })}
          {cardItems.length === 0 && (
            <p className="text-[10px] text-slate-400 italic text-center py-2">{t('orders.cardNoStationItems')}</p>
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
                title={t('orders.cardMarkAllAsTitle', { label: t(`orders.${commonNext.labelKey}`) })}
              >
                {t('orders.cardAllTo', { label: t(`orders.${commonNext.labelKey}`) })}
              </button>
            )}
            {isReadOnly && canAccept && order.status === 'CREATED' && (
              <button
                onClick={(e) => { e.stopPropagation(); advance(order.id, 'QUEUED'); }}
                disabled={saving}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-brand-500 text-white"
              >
                {t('orders.nextAccept')}
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
        <h1 className="page-title m-0">{t('orders.title')}</h1>
        <span className="text-xs text-slate-400 mr-2">
          {tier === 'platform'
            ? t('orders.countPlatform', { count: orders.length })
            : tier === 'business'
              ? t('orders.countBusiness', { count: orders.length })
              : t('orders.countToday', { count: orders.length })}
        </span>

        {/* Primary filter pills — multi-select. Click toggles in/out of the set. */}
        {INLINE_FILTERS.map((f) => {
          const active = filterSet.has(f);
          return (
            <button key={f} onClick={() => toggleFilter(f)}
              className={clsx('filter-pill', active ? 'filter-pill-active' : 'filter-pill-inactive')}>
              {FILTER_LABEL_KEY[f] ? t(`orders.${FILTER_LABEL_KEY[f]}`) : t(`orders.${STATUS[f]?.labelKey}`)}
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
              ? t('orders.filterStatus')
              : selectedSpecific.length === 1
                ? (FILTER_LABEL_KEY[selectedSpecific[0]]
                    ? t(`orders.${FILTER_LABEL_KEY[selectedSpecific[0]]}`)
                    : t(`orders.${STATUS[selectedSpecific[0]]?.labelKey}`))
                : t('orders.filterStatusN', { count: selectedSpecific.length });
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
                    <span className="flex-1 truncate">{FILTER_LABEL_KEY[f] ? t(`orders.${FILTER_LABEL_KEY[f]}`) : t(`orders.${STATUS[f]?.labelKey}`)}</span>
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
              <option value="ALL">{t('orders.outletAll')}</option>
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
                placeholder={t('orders.searchPlaceholder')}
                className="input pl-7 pr-7 py-1.5 text-xs"
                style={{ width: 180 }}
              />
              <button
                onClick={() => { setSearch(''); setSearchOpen(false); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                title={t('orders.searchClose')}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
              title={t('orders.searchTitle')}
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
              title={t('orders.sortByTitle')}
            >
              <option value="createdAt">{t('orders.sortNewest')}</option>
              <option value="totalAmount">{t('orders.sortTotal')}</option>
              <option value="orderNumber">{t('orders.sortOrderNumber')}</option>
              <option value="status">{t('orders.sortStatus')}</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
              title={sortDir === 'asc' ? t('orders.sortDescTitle') : t('orders.sortAscTitle')}
            >
              {sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
            title={fullscreen ? t('orders.fullscreenExit') : t('orders.fullscreenEnter')}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button className="btn-ghost p-2 text-slate-500 hover:text-slate-800" onClick={fetchOrders} disabled={loading} title={t('orders.refreshTitle')}>
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
                  ? t('orders.socketConnectedTitle')
                  : socketPhase === 'reconnecting'
                    ? t('orders.socketReconnectingTitle')
                    : t('orders.socketOfflineTitle')
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
              {socketPhase === 'connected' ? t('orders.socketLive') : socketPhase === 'reconnecting' ? t('orders.socketReconnecting') : t('orders.socketOffline')}
            </span>
          )}

          {/* Receipt printer pill — visible when the outlet has a
              receipt printer configured AND any receipt-print flag is
              on. Tap to (re-)pair via Web Bluetooth. Same pattern the
              kitchen page uses for its station printer. */}
          {!isReadOnly && outletPrint.printerId && isBluetoothSupported() && (outletPrint.auto || outletPrint.allowManual) && (
            <button
              onClick={connectReceiptPrinter}
              className={clsx(
                'inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border transition-colors',
                printerReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
              )}
              title={printerReady ? t('orders.printerPairedTitle') : t('orders.printerConnectTitle')}
            >
              <PrinterIcon size={11} />
              {printerReady ? t('orders.printerReady') : t('orders.printerConnect')}
            </button>
          )}

          {isReadOnly && (
            <span className="badge badge-slate"><Eye size={10} /> {t('orders.viewOnly')}</span>
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
          <span className="font-semibold">{t('orders.offlineBanner')}</span>
          <span className="text-amber-700/70">
            {t('orders.offlineBannerCached', { minutes: Math.max(0, Math.round((Date.now() - snapshotAge) / 60000)) })}
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
          <p className="text-sm font-semibold text-slate-600">{t('orders.emptyTitle')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('orders.emptyHint')}</p>
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
        title={detail?.tokenNumber != null
          ? t('orders.modalOrderTitleWithToken', { number: detail?.orderNumber, token: detail.tokenNumber })
          : t('orders.modalOrderTitle', { number: detail?.orderNumber })}
        subtitle={detail?.table
          ? t('orders.modalSubtitleTable', { number: detail.table.number })
          : detail?.isParcel
            ? t('orders.modalSubtitleParcel')
            : t('orders.modalSubtitleCounter')}
        size="lg"
        footer={
          isReadOnly ? (
            <div className="flex items-center justify-between w-full">
              <span className="badge badge-slate"><Eye size={10} /> {t('orders.viewOnly')}</span>
              <div className="flex items-center gap-2">
                {canAccept && detail?.status === 'CREATED' && (
                  <button onClick={() => advance(detail.id, 'QUEUED')} disabled={saving} className="btn-primary">
                    {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {t('orders.nextAccept')} <ArrowRight size={14} />
                  </button>
                )}
                <button onClick={() => setDetail(null)} className="btn-secondary">{t('orders.close')}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              {detail && ['CREATED','QUEUED','PREPARING'].includes(detail.status) && (
                <button onClick={() => { setDetail(null); setCancelTarget(detail); }} className="btn-danger btn-sm">
                  <X size={13} /> {t('orders.cancel')}
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
                    title={t('orders.refundTooltip')}
                  >
                    <RotateCcw size={13} /> {t('orders.refund')}
                  </button>
                )}
              {detail
                && !['CANCELLED', 'REFUND_COMPLETE'].includes(detail.status)
                && Number(detail.totalAmount ?? 0) > 0
                // Outstanding balance > 0 → still payable, split makes sense.
                && Number(detail.totalAmount ?? 0)
                    - (detail.payments ?? [])
                        .filter((p: any) => p.status === 'SUCCESS' && !p.isRefund)
                        .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
                    > 0.005
                && (
                  <button
                    onClick={() => openSplitFor(detail, 2)}
                    className="btn-secondary btn-sm"
                    title={t('orders.splitBillTooltip')}
                  >
                    <UsersIcon size={13} /> {t('orders.splitBill')}
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
                    {t(`orders.${step.labelKey}`)} <ArrowRight size={14} />
                  </button>
                );
              })()}
              <button onClick={downloadDetailReceipt} className="btn-secondary">
                <Download size={14} /> {t('orders.downloadReceipt')}
              </button>
              {outletPrint.allowManual && outletPrint.printerId && isBluetoothSupported() && (
                <button
                  onClick={printDetailReceipt}
                  disabled={printing}
                  className="btn-secondary"
                  title={isAggregatorOrder(detail)
                    ? t('orders.printPackingSlipTitle')
                    : t('orders.printReceiptTitle')}
                >
                  {printing && <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />}
                  <PrinterIcon size={14} /> {isAggregatorOrder(detail) ? t('orders.printPackingSlip') : t('orders.printReceipt')}
                </button>
              )}
              <button onClick={() => setDetail(null)} className="btn-secondary">{t('orders.close')}</button>
            </div>
          )
        }>
        {detail && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: STATUS[detail.status]?.bg, border: `1px solid ${STATUS[detail.status]?.border}` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS[detail.status]?.dot }} />
              <span className="text-sm font-semibold" style={{ color: STATUS[detail.status]?.text }}>{t(`orders.${STATUS[detail.status]?.labelKey}`)}</span>
            </div>

            {/* Customer + tag + recognition insights. Direct customers
                render the User chip + the per-outlet insights pill;
                aggregator orders (Order.customerId is always null —
                marketplace phones are masked) render a parallel chip
                fed by AggregatorCustomer so staff still see "5th order
                from this Swiggy customer". */}
            {detail.customer ? (() => {
              const tag = detail.customer.customerTagAssignments?.find((a: any) => a.outletId === detail.outletId)?.customerTag;
              return (
                <div className="space-y-2">
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
                  <CustomerInsightsPill
                    outletId={detail.outletId || outletId}
                    userId={detail.customer.id}
                  />
                </div>
              );
            })() : detail.aggregatorOrder?.aggregatorCustomer ? (() => {
              const ac = detail.aggregatorOrder.aggregatorCustomer;
              const channel = detail.aggregatorOrder.channel ?? detail.channel ?? '';
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 shrink-0 border border-slate-200">
                      <User size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {ac.displayName || `${channel} customer`}
                      </p>
                      {ac.maskedPhone && (
                        <p className="text-xs text-slate-500 truncate">{ac.maskedPhone}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded-full shrink-0">
                      {channel}
                    </span>
                  </div>
                  <AggregatorCustomerPill customer={ac} channel={channel} />
                </div>
              );
            })() : null}

            {/* Split-bill per-share status panel — only renders when
                the order has at least one share (splitTotalShares > 0).
                Live progress + Resend / Cancel / Mark cash actions. */}
            {Number(detail.splitTotalShares ?? 0) > 0 && (
              <SplitSharesPanel
                outletId={detail.outletId || outletId}
                orderId={detail.id}
                reloadKey={shareReload}
                onChange={() => setShareReload((r) => r + 1)}
              />
            )}

            {/* Course planner */}
            <CoursePlanner
              order={detail}
              onSaved={(updated) => setDetail(updated)}
            />

            {/* Items with per-item status */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('orders.itemsHeading')}</p>
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
                          title={item.sequenceNumber > (detail.activeSequence ?? 1) ? t('orders.courseHeldTitle') : t('orders.courseActiveTitle')}
                        >
                          {(detail.sequenceLabels?.[String(item.sequenceNumber)] || t('orders.courseLabel', { n: item.sequenceNumber }))}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                        {t(`orders.${s.labelKey}`)}
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
                            <next.icon size={12} /> {t(`orders.${next.labelKey}`)}
                          </button>
                        )}
                        <button
                          onClick={() => advanceItem(detail.id, item.id, 'CANCELLED')}
                          disabled={isBusy}
                          className="text-xs text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg"
                          title={t('orders.cancelItemTitle')}
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
              <div className="flex justify-between text-xs text-slate-500"><span>{t('orders.subtotal')}</span><span>₹{Number(detail.subtotal).toFixed(2)}</span></div>
              {Number(detail.taxAmount) > 0 && (
                <>
                  <div className="flex justify-between text-xs text-slate-500"><span>{t('orders.sgst')}</span><span>₹{Number(detail.sgstAmount ?? Number(detail.taxAmount) / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>{t('orders.cgst')}</span><span>₹{Number(detail.cgstAmount ?? Number(detail.taxAmount) / 2).toFixed(2)}</span></div>
                </>
              )}
              {Number(detail.parcelAmount) > 0 && (
                <div className="flex justify-between text-xs text-slate-500"><span>{t('orders.parcel')}</span><span>₹{Number(detail.parcelAmount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100"><span>{t('orders.total')}</span><span>₹{Number(detail.totalAmount).toFixed(2)}</span></div>
            </div>

            {/* Payment breakdown */}
            {detail.payments?.length > 0 && (() => {
              const split: Record<string, number> = {};
              detail.payments
                .filter((p: any) => p.status === 'SUCCESS')
                .forEach((p: any) => { split[p.mode] = (split[p.mode] || 0) + Number(p.amount); });
              const labelFor: Record<string, string> = {
                CASH: t('orders.payCash'), UPI: t('orders.payUpi'), CARD: t('orders.payCard'), WALLET: t('orders.payWallet'), NET_BANKING: t('orders.payNetBanking'),
              };
              const rows = Object.entries(split);
              if (rows.length === 0) return null;
              const paid = rows.reduce((s, [, v]) => s + v, 0);
              return (
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('orders.paidVia')}</p>
                  {rows.map(([mode, amount]) => (
                    <div key={mode} className="flex justify-between text-xs">
                      <span className="text-slate-600">{labelFor[mode] || mode}</span>
                      <span className="font-bold text-slate-800">₹{amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {paid < Number(detail.totalAmount) && (
                    <div className="flex justify-between text-[11px] text-amber-600 font-semibold">
                      <span>{t('orders.balanceDue')}</span>
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
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('orders.orderLog')}</p>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {orderLog.entries.map((h: any) => (
                    <div key={h.id} className="flex items-center gap-3 px-3 py-2 text-xs bg-white">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS[h.status]?.dot }} />
                      <span className="font-medium text-slate-700 min-w-[110px]">{STATUS[h.status]?.labelKey ? t(`orders.${STATUS[h.status].labelKey}`) : h.status}</span>
                      <div className="flex-1 min-w-0">
                        {h.actor ? (
                          <span className="text-slate-600 truncate">
                            <span className="font-semibold">{h.actor.name}</span>
                            {h.actor.role && <span className="text-slate-400"> · {h.actor.role}</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">{t('orders.systemActor')}</span>
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
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('orders.timeline')}</p>
                {detail.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS[h.status]?.dot }} />
                    <span className="font-medium text-slate-700">{STATUS[h.status]?.labelKey ? t(`orders.${STATUS[h.status].labelKey}`) : h.status}</span>
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
        title={t('orders.cancelOrderTitle')} subtitle={cancelTarget?.orderNumber} size="sm"
        footer={<><button className="btn-secondary" onClick={() => setCancelTarget(null)}>{t('orders.back')}</button><button className="btn-danger" onClick={cancelOrder} disabled={saving}>{t('orders.cancelOrderConfirm')}</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{t('orders.cancelUndoWarning')}</p>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{t('orders.cancelReasonLabel')}</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="input resize-none" rows={2} placeholder={t('orders.cancelReasonPlaceholder')} />
          </div>
        </div>
      </Modal>

      {/* Refund modal — partial or full refund against the order.
          Defaults to a full refund (totalAmount); operator can edit.
          The /refunds page handles the approval lifecycle from here. */}
      <Modal
        open={!!refundTarget}
        onClose={() => { setRefundTarget(null); setRefundAmount(''); setRefundReason(''); }}
        title={t('orders.refundTitle')}
        subtitle={refundTarget?.orderNumber}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRefundTarget(null)}>{t('orders.cancel')}</button>
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
                  toast.success(t('orders.toastRefundFiled'));
                  setRefundTarget(null);
                  setRefundAmount('');
                  setRefundReason('');
                } catch (e: any) {
                  toast.error(e?.response?.data?.message || t('orders.toastRefundFailed'));
                } finally {
                  setRefundSubmitting(false);
                }
              }}
            >
              <RotateCcw size={13} /> {t('orders.refundFileBtn')}
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

      {/* Split-bill modal — cash-only, one Payment row per share.
          Each row auto-confirms as it's submitted; the order's
          outstanding balance ticks down with each. Mixed cash/UPI
          splits use the regular Pay flow per share (out of scope
          for this modal). */}
      <Modal
        open={!!splitTarget}
        onClose={() => { setSplitTarget(null); setSplitRows([]); }}
        title={t('orders.splitBill')}
        subtitle={splitTarget?.orderNumber}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSplitTarget(null)}>{t('orders.cancel')}</button>
            <button
              className="btn-primary"
              disabled={
                splitSubmitting
                || splitRows.length === 0
                || splitRows.some((r) => !r.amount || Number(r.amount) <= 0 || !r.phone?.trim())
                || Math.abs(splitSumAssigned - splitOutstanding) > 0.005
              }
              onClick={async () => {
                if (!splitTarget) return;
                setSplitSubmitting(true);
                try {
                  // One round-trip — server creates N SplitShare rows
                  // + dispatches WhatsApp per share inside a single
                  // transaction. Replaces the previous "fire N cash
                  // payments in series" behaviour.
                  await api.post(
                    `/outlets/${splitTarget.outletId || outletId}/orders/${splitTarget.id}/split-shares`,
                    {
                      shares: splitRows.map((r) => ({
                        amount: Number(r.amount),
                        customerName: r.label?.trim() || undefined,
                        customerPhone: r.phone.trim(),
                      })),
                    },
                  );
                  toast.success(t('orders.toastSplitSent', { count: splitRows.length }));
                  setSplitTarget(null);
                  setSplitRows([]);
                  // Refresh the detail to show split counters + the
                  // per-share status panel below.
                  try {
                    const { data } = await api.get(`/outlets/${splitTarget.outletId || outletId}/orders/${splitTarget.id}`);
                    setDetail(data.data);
                    dispatch(updateOrder(data.data));
                  } catch { /* best-effort */ }
                  setShareReload((r) => r + 1);
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || err?.message || t('orders.toastSplitFailed'));
                } finally {
                  setSplitSubmitting(false);
                }
              }}
            >
              <UsersIcon size={13} /> Send {splitRows.length} share{splitRows.length === 1 ? '' : 's'}
            </button>
          </>
        }
      >
        {splitTarget && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total</p>
                <p className="text-sm font-semibold text-slate-900 tabular-nums">₹{Number(splitTarget.totalAmount ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Outstanding</p>
                <p className="text-sm font-semibold text-slate-900 tabular-nums">₹{splitOutstanding.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Unallocated</p>
                <p className={`text-sm font-semibold tabular-nums ${Math.abs(splitRemaining) < 0.005 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ₹{splitRemaining.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Quick split</span>
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => openSplitFor(splitTarget, n)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                >
                  {n} ways
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {splitRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold col-span-1">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => setSplitRows((p) => p.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))}
                    placeholder="Name (optional)"
                    className="input text-sm col-span-3"
                  />
                  <input
                    type="tel"
                    value={row.phone}
                    onChange={(e) => setSplitRows((p) => p.map((r, i) => i === idx ? { ...r, phone: e.target.value } : r))}
                    placeholder="Phone (required)"
                    className="input text-sm col-span-4 tabular-nums"
                    inputMode="tel"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.amount}
                    onChange={(e) => setSplitRows((p) => p.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                    className="input text-sm col-span-3 tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setSplitRows((p) => p.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-600 col-span-1 justify-self-end"
                    disabled={splitRows.length <= 1}
                    title="Remove share"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSplitRows((p) => {
                  // Adding a share re-divides the OUTSTANDING amount
                  // evenly across the new total count, preserving any
                  // names already typed. Previously the new row just
                  // got the leftover (often ₹0 when the existing rows
                  // already summed to the total), which surprised
                  // operators expecting a fresh even split.
                  const nextCount = p.length + 1;
                  const evenShare = Math.floor((splitOutstanding / nextCount) * 100) / 100;
                  const last = Math.round((splitOutstanding - evenShare * (nextCount - 1)) * 100) / 100;
                  return p.concat({ amount: '0', label: '', phone: '' }).map((r, i, arr) => ({
                    ...r,
                    amount: (i === arr.length - 1 ? last : evenShare).toFixed(2),
                  }));
                })}
                className="text-[11px] font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
              >
                <Plus size={11} /> Add a share
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Each share gets a WhatsApp message with a deep link to their personal bill — the diner pays through
              the customer app via UPI or Razorpay. Use Resend / Cancel / Mark cash on the per-share panel below
              the order detail to chase unpaid shares.
            </p>
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

/**
 * Customer-recognition pill on the order detail. Fetches per-outlet
 * aggregate stats (visit count, lifetime spend, avg ticket, last
 * visit, top 3 items, preferred payment mode) and renders a compact
 * info card so staff can greet a regular customer informedly.
 *
 * Best-effort — fetch failures hide the pill silently instead of
 * cluttering the modal with errors. Re-fires when the customer id
 * changes (different order opens).
 */
function CustomerInsightsPill({ outletId, userId }: { outletId: string; userId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Skip the fetch when there's no staff token — the endpoint requires
    // auth and the response interceptor would otherwise log a 401 and
    // bounce the user to /login mid-render. The pill is best-effort UI,
    // not worth interrupting the page for.
    if (!localStorage.getItem('token')) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.get(`/outlets/${outletId}/customers/${userId}/insights`)
      .then((r) => { if (!cancelled) setData(r.data?.data ?? null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [outletId, userId]);

  if (loading || !data || data.visits === 0) return null;

  const lastVisit = data.lastVisitAt ? new Date(data.lastVisitAt) : null;
  const daysSince = lastVisit ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const lastVisitText = daysSince == null
    ? null
    : daysSince === 0
      ? 'first time today'
      : daysSince < 7
        ? `last visited ${daysSince}d ago`
        : daysSince < 30
          ? `last visited ${Math.floor(daysSince / 7)}w ago`
          : `last visited ${Math.floor(daysSince / 30)}mo ago`;

  const favs = (data.favourites || []).slice(0, 2).map((f: any) => f.name).join(' · ');

  return (
    <div className="px-4 py-2.5 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-rose-50/30 text-[12px] text-slate-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-white/70 border border-amber-200 px-2 py-0.5 rounded-full">
          <Bell size={10} /> Regular
        </span>
        <span className="font-bold text-slate-900 tabular-nums">{data.visits}{ordinalSuffix(data.visits)} visit</span>
        {lastVisitText && <span className="text-slate-500">· {lastVisitText}</span>}
      </div>
      <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-slate-600">
        {favs && (
          <span><span className="text-slate-400">Usual:</span> <span className="font-semibold text-slate-800">{favs}</span></span>
        )}
        {data.avgTicket > 0 && (
          <span><span className="text-slate-400">Avg ticket:</span> <span className="font-semibold tabular-nums text-slate-800">₹{Number(data.avgTicket).toFixed(0)}</span></span>
        )}
        {data.preferredMode && (
          <span><span className="text-slate-400">Pays:</span> <span className="font-semibold text-slate-800">{data.preferredMode}</span></span>
        )}
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Marketplace-customer recognition pill. Reads straight off the
 * embedded aggregatorCustomer object on the order — no extra fetch
 * since findOne already hydrates it. Hides on first-time customers
 * (orderCount <= 1) so single-order strangers don't get an awkward
 * "1st order" badge.
 *
 * Doesn't show favourites or spend stats because:
 *   1. Marketplace prices differ from our outlet price; "avg ticket"
 *      from our basePrice would mislead.
 *   2. Repeat-item analysis would need a separate query against
 *      aggregator-channel OrderItems. Easy follow-up if it's useful.
 */
function AggregatorCustomerPill({ customer, channel }: { customer: any; channel: string }) {
  if (!customer || (customer.orderCount ?? 0) <= 1) return null;
  const lastVisit = customer.lastOrderAt ? new Date(customer.lastOrderAt) : null;
  const daysSince = lastVisit ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const lastVisitText = daysSince == null
    ? null
    : daysSince === 0
      ? 'ordered earlier today'
      : daysSince === 1
        ? 'ordered yesterday'
        : daysSince < 7
          ? `last ordered ${daysSince}d ago`
          : daysSince < 30
            ? `last ordered ${Math.floor(daysSince / 7)}w ago`
            : `last ordered ${Math.floor(daysSince / 30)}mo ago`;
  return (
    <div className="px-4 py-2.5 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50/30 text-[12px] text-slate-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-white/70 border border-rose-200 px-2 py-0.5 rounded-full">
          <Bell size={10} /> Repeat {channel.replace('_', ' ').toLowerCase()}
        </span>
        <span className="font-bold text-slate-900 tabular-nums">
          {customer.orderCount}{ordinalSuffix(customer.orderCount)} order
        </span>
        {lastVisitText && <span className="text-slate-500">· {lastVisitText}</span>}
      </div>
    </div>
  );
}

/**
 * Per-share status panel for split-billed orders. Renders inside
 * the OrdersPage detail modal. Each row shows the diner's name +
 * phone + amount + lifecycle status, with Resend / Cancel / Mark
 * cash actions for unsettled shares. Fetched on mount + every time
 * the reloadKey bumps (parent toggles it after a new send or after
 * a per-row action).
 */
function SplitSharesPanel({
  outletId,
  orderId,
  reloadKey,
  onChange,
}: {
  outletId: string;
  orderId: string;
  reloadKey: number;
  onChange: () => void;
}) {
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/outlets/${outletId}/orders/${orderId}/split-shares`)
      .then((r) => { if (!cancelled) setShares(r.data?.data ?? []); })
      .catch(() => { if (!cancelled) setShares([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [outletId, orderId, reloadKey]);

  const STATUS_CFG: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    PENDING:   { bg: 'bg-slate-100',   text: 'text-slate-600',  icon: Clock,         label: 'Pending' },
    SENT:      { bg: 'bg-amber-50',    text: 'text-amber-800',  icon: Clock,         label: 'Sent' },
    VIEWED:    { bg: 'bg-sky-50',      text: 'text-sky-800',    icon: Eye,           label: 'Viewed' },
    PAID:      { bg: 'bg-emerald-50',  text: 'text-emerald-700',icon: ArrowRight,    label: 'Paid' },
    CANCELLED: { bg: 'bg-slate-100',   text: 'text-slate-500',  icon: X,             label: 'Cancelled' },
    EXPIRED:   { bg: 'bg-slate-100',   text: 'text-slate-500',  icon: X,             label: 'Expired' },
  };

  const act = async (id: string, action: 'resend' | 'cancel' | 'mark-cash') => {
    setBusy(id + action);
    try {
      await api.post(`/split-shares/${id}/${action}`, {});
      toast.success(action === 'resend' ? 'Resent' : action === 'cancel' ? 'Cancelled' : 'Marked paid as cash');
      onChange();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `${action} failed`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="text-xs text-slate-400 py-3">Loading split shares…</div>;
  if (!shares.length) return null;

  const paid = shares.filter((s) => s.status === 'PAID').length;
  const total = shares.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <UsersIcon size={12} className="text-slate-500" />
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-600">Split shares</span>
        <span className="ml-auto text-[11px] font-semibold text-slate-900 tabular-nums">
          {paid} of {total} paid
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {shares.map((s) => {
          const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.PENDING;
          const Icon = cfg.icon;
          const live = !['PAID', 'CANCELLED', 'EXPIRED'].includes(s.status);
          // Humanised "expires in 3h" / "expired 1h ago" for the
          // status sub-line — read off the row's expiresAt (Phase B).
          const expiresAt = s.expiresAt ? new Date(s.expiresAt).getTime() : null;
          const expiresInMs = expiresAt ? expiresAt - Date.now() : null;
          const expiresText = expiresInMs == null
            ? null
            : expiresInMs > 0
              ? expiresInMs < 60 * 60 * 1000
                ? `expires in ${Math.max(1, Math.floor(expiresInMs / 60_000))}m`
                : expiresInMs < 24 * 60 * 60 * 1000
                  ? `expires in ${Math.floor(expiresInMs / (60 * 60 * 1000))}h`
                  : `expires in ${Math.floor(expiresInMs / (24 * 60 * 60 * 1000))}d`
              : null;
          return (
            <li key={s.id} className="px-3 py-2 flex items-center gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {s.customerName || 'Guest'} · {s.customerPhone}
                </p>
                <p className="text-[10px] text-slate-500">
                  {s.sentAt && <>Sent {new Date(s.sentAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>}
                  {s.paidAt && <> · Paid {new Date(s.paidAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>}
                  {live && (s.remindersSent ?? 0) > 0 && <> · {s.remindersSent} reminder{s.remindersSent === 1 ? '' : 's'} sent</>}
                  {live && expiresText && <> · <span className={expiresInMs! < 60 * 60 * 1000 ? 'text-amber-700 font-semibold' : ''}>{expiresText}</span></>}
                </p>
              </div>
              <span className="font-semibold text-slate-900 tabular-nums w-16 text-right shrink-0">
                ₹{Number(s.amount).toFixed(2)}
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                <Icon size={9} /> {cfg.label}
              </span>
              {live && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => act(s.id, 'resend')}
                    disabled={!!busy}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                    title="Resend the WhatsApp link"
                  >
                    Resend
                  </button>
                  <button
                    onClick={() => act(s.id, 'mark-cash')}
                    disabled={!!busy}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-40"
                    title="Collected cash directly — settle without the customer pay flow"
                  >
                    Mark cash
                  </button>
                  <button
                    onClick={() => act(s.id, 'cancel')}
                    disabled={!!busy}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                    title="Cancel this share — diner can no longer pay it"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
