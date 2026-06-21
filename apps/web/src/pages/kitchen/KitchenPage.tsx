import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ChefHat, Timer, CheckCircle2, Flame, Play, Bell, BellOff, X, Utensils, ChevronDown, ChevronUp, Maximize2, Minimize2, Printer as PrinterIcon, Bluetooth, Volume2 } from 'lucide-react';
import { RootState } from '../../store';
import { getSocket } from '../../services/socket';
import { useSocketStatus } from '../../hooks/useSocketStatus';
import api from '../../services/api';
import { useUserRole } from '../../hooks/useUserRole';
import { connectPrinter, printReceipt, isPrinterConnected, isPrinterPaired, ensurePrinterConnected, isBluetoothSupported } from '../../utils/bluetoothPrinter';
import {
  playKitchenBell,
  setupKitchenAudioUnlock,
  getKitchenBellVolume,
  setKitchenBellVolume,
  isKitchenBellMuted,
  setKitchenBellMuted,
} from '../../utils/kitchenSound';

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

type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'PACKED' | 'SERVED' | 'CANCELLED';

const ITEM_STATUS: Record<ItemStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { label: 'Pending',   bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  PREPARING: { label: 'Preparing', bg: '#e8efef', text: '#04181a', border: '#D2E5DF', dot: '#0B4245' },
  READY:     { label: 'Ready',     bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#10b981' },
  // Parcel-only intermediate (parcel-desk packed it; waiting for
  // sibling items / order-level rollup to READY_FOR_PICKUP).
  PACKED:    { label: 'Packed',    bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
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
  if (mins < 20) return { card: '#e8efef', border: '#759fa1', timer: '#04181a', badge: '#e8efef', badgeText: '#04181a' };
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
  // Plural — a staff member can be the currentWorker on multiple
  // kitchen stations (e.g. covering tandoor + curry). The filter rules
  // below show items routed to ANY of them, and treat the user as
  // master if ANY assigned station is master.
  type AssignedStation = { id: string; name: string; isMaster?: boolean; printerId?: string | null; printer?: { id: string; name: string } | null };
  const [myStations, setMyStations] = useState<AssignedStation[]>([]);
  // Convenience computed flags for the rest of the component. The
  // viewer is a master if any of their assigned stations is a master
  // (master sees everything). stationIdSet is the lookup used by the
  // visibility filter.
  const isMaster = myStations.some((s) => s.isMaster);
  const stationIdSet = new Set(myStations.map((s) => s.id));
  const myStationName = myStations.length === 0
    ? null
    : myStations.length === 1
      ? myStations[0].name
      : myStations.map((s) => s.name).join(' + ');
  const [outletPrintCfg, setOutletPrintCfg] = useState<{ auto: boolean; allowManual: boolean }>({ auto: false, allowManual: false });
  // Force-rerender after a successful Connect printer call so the
  // header pill flips from "Connect" to "Printer ready" without us
  // keeping the connection state in React state (it lives in the
  // bluetoothPrinter module).
  const [, setPrinterTick] = useState(0);
  // Orders we've already auto-printed in this session, to avoid
  // reprinting on socket reconnect / refetch.
  const autoPrintedRef = useRef<Set<string>>(new Set());
  const [filter, setFilter] = useState<KitchenFilter>('ACTIVE');
  // Bell controls — synth WebAudio tone fired on orderCreated. Volume
  // + mute persisted to localStorage so a station keeps its preference
  // across shift changes / reloads.
  const [bellMuted, setBellMuted] = useState(() => isKitchenBellMuted());
  const [bellVolume, setBellVolume] = useState(() => getKitchenBellVolume());
  // Skip the bell on the very first batch the page loads (pre-existing
  // pending orders shouldn't all ding at once). Flipped to false after
  // the initial fetchForFilter resolves.
  const initialFetchDone = useRef(false);
  useEffect(() => { setupKitchenAudioUnlock(); }, []);
  // Top "items to prepare" summary card — collapsed by default so the
  // order cards have the floor; the chef expands when they want the
  // per-item breakdown.
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Fullscreen toggle — uses the browser Fullscreen API on the page
  // wrapper so the kitchen monitor (or a phone in landscape) can use
  // every pixel. We track `fullscreenchange` so the icon stays in sync
  // if the user exits with Escape. iOS Safari doesn't implement the
  // API on arbitrary elements; the button silently no-ops there.
  const pageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = async () => {
    const el = pageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* unavailable — silently ignore */ }
  };
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
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
    // Arm the bell only after the initial backlog is in — otherwise
    // the page reload would ring once per pre-existing PENDING order.
    initialFetchDone.current = true;
  }, [outletId]);

  useEffect(() => {
    api.get(`/outlets/${outletId}/kitchen-stations/mine`)
      .then(r => {
        // Backend now returns an array of every station the user
        // currently works at. Older deploys returned a single object
        // (or null) — coerce both shapes into the array model so the
        // page degrades gracefully during rollout.
        const data = r.data?.data;
        if (Array.isArray(data)) setMyStations(data);
        else if (data && typeof data === 'object') setMyStations([data]);
        else setMyStations([]);
      })
      .catch(() => setMyStations([]));
    api.get(`/outlets/${outletId}`)
      .then(r => setOutletPrintCfg({
        auto: !!r.data.data?.kitchenAutoPrint,
        allowManual: !!r.data.data?.kitchenAllowManualPrint,
      }))
      .catch(() => {});
  }, [outletId]);

  // Printer resolution across multiple assigned stations: pick the
  // first station that actually has a printer. The kitchen-receipt
  // path can be enhanced later to route per-station — for now a
  // shared printer is the common physical setup (multiple stations,
  // one Bluetooth printer) so a single chosen pill is enough.
  const stationWithPrinter = myStations.find((s) => (s.printer?.id || s.printerId));
  const printerId = stationWithPrinter?.printer?.id || stationWithPrinter?.printerId || null;
  const printerName = stationWithPrinter?.printer?.name || null;
  const printerReady = !!printerId && isPrinterConnected(printerId);

  const connectStationPrinter = async () => {
    if (!printerId) {
      toast.error('No printer assigned to this station');
      return;
    }
    try {
      await connectPrinter(printerId);
      setPrinterTick((t) => t + 1);
      toast.success('Printer connected');
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Pairing cancelled');
    }
  };

  const printOrder = useCallback(async (orderId: string, silent = false) => {
    if (!printerId) {
      if (!silent) toast.error('No printer assigned to this station');
      return;
    }
    // Try to (re-)establish the BLE link before printing. Web Bluetooth
    // disconnects on idle / sleep; the cached device ref lets us call
    // gatt.connect() without a fresh user gesture. If we've never paired
    // (no handle in the map), surface the prompt — even on the auto path
    // — so the staff sees why printing didn't happen and what to do.
    try {
      await ensurePrinterConnected(printerId);
    } catch (e: any) {
      const msg = isPrinterPaired(printerId)
        ? `Printer reconnect failed: ${e?.message ?? e}`
        : 'Auto-print is on but the printer hasn’t been paired yet. Tap "Connect printer" once.';
      toast.error(msg);
      return;
    }
    try {
      // When the user covers multiple stations, fetch a receipt per
      // station and print them in sequence. Falls back to the unfiltered
      // (no stationId) endpoint behaviour if no stations are assigned —
      // the backend already handles that case.
      const stationsToPrint = myStations.length > 0 ? myStations : [{ id: undefined as any }];
      const receipts: any[] = [];
      for (const s of stationsToPrint) {
        const res = await api.get(`/kitchen-receipts/order/${orderId}`, {
          params: s.id ? { stationId: s.id } : {},
        });
        for (const r of (res.data.data || [])) receipts.push(r);
      }
      for (const r of receipts) {
        await printReceipt(printerId, r);
      }
      if (!silent) toast.success('Printed');
      else if (receipts.length > 0) toast.success(`Auto-printed ${receipts.length} slip${receipts.length === 1 ? '' : 's'}`);
    } catch (e: any) {
      if (!silent) toast.error(e?.message || e?.response?.data?.message || 'Print failed');
      else toast.error(`Auto-print failed: ${e?.message ?? e}`);
    }
  }, [printerId, myStations]);

  // Per-item slip: prints a token-tagged ticket for a single OrderItem
  // — independent of the menu item's printSeparately flag. Lets kitchen
  // staff hand off any individual line (e.g. one of three drinks in an
  // order) with its own token reference for table delivery.
  const printOrderItem = useCallback(async (orderId: string, itemId: string) => {
    if (!printerId) {
      toast.error('No printer assigned to this station');
      return;
    }
    try {
      await ensurePrinterConnected(printerId);
    } catch (e: any) {
      toast.error(isPrinterPaired(printerId)
        ? `Printer reconnect failed: ${e?.message ?? e}`
        : 'Printer not paired yet. Tap "Connect printer" once.');
      return;
    }
    try {
      const res = await api.get(`/kitchen-receipts/order/${orderId}`, {
        params: { itemId },
      });
      const receipts = res.data.data || [];
      if (receipts.length === 0) {
        toast.error('Nothing to print');
        return;
      }
      for (const r of receipts) await printReceipt(printerId, r);
      toast.success('Item slip printed');
    } catch (e: any) {
      toast.error(e?.message || e?.response?.data?.message || 'Print failed');
    }
  }, [printerId]);

  useEffect(() => { fetchForFilter(filter).catch(() => {}); }, [filter, fetchForFilter]);

  // Socket-status pill + REST backfill on reconnect. The kitchen's primary
  // failure mode is "socket dropped silently → new orders never show". When
  // we see a reconnect, we re-fetch the active list so any orders that
  // were created while we were disconnected appear immediately.
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  if (!socketRef.current) socketRef.current = getSocket(outletId);
  const { phase: socketPhase, reconnectedAt } = useSocketStatus(socketRef.current);
  useEffect(() => {
    if (reconnectedAt) fetchForFilter(filter).catch(() => {});
  }, [reconnectedAt, filter, fetchForFilter]);

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
        // Audible bell. Guard on initialFetchDone so we don't ding on
        // the page-load batch of pre-existing PENDING orders. Mute /
        // volume read inside playKitchenBell — no extra check here.
        if (initialFetchDone.current) {
          playKitchenBell();
        }
        // Auto-print gate: only on the flag + a printer + a one-per-order
        // dedupe. We deliberately do NOT check isPrinterConnected here —
        // BLE has usually gone idle by the time an order arrives, and
        // printOrder will call ensurePrinterConnected to reconnect via
        // the cached device ref (no user gesture needed once paired).
        // If the printer was never paired this session, printOrder
        // surfaces a clear toast so staff know to tap Connect printer.
        if (
          outletPrintCfg.auto &&
          printerId &&
          !autoPrintedRef.current.has(o.id)
        ) {
          autoPrintedRef.current.add(o.id);
          printOrder(o.id, true).catch(() => {});
        }
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
  }, [outletId, filter, outletPrintCfg.auto, printerId, printOrder]);

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

  // Course gating: items with a sequenceNumber higher than the order's
  // activeSequence are held — they don't show in the kitchen until prior
  // courses are SERVED. Items with sequenceNumber=null are always live.
  const isItemLive = (it: any, order: any) => {
    // Postpaid lines awaiting service-desk confirmation are not the
    // kitchen's problem yet — hide them until verifyItems flips them
    // to PENDING.
    if (it.status === 'PENDING_VERIFICATION') return false;
    if (it.sequenceNumber == null) return true;
    return it.sequenceNumber <= (order.activeSequence ?? 1);
  };

  const visibleOrders = (myStations.length === 0 || isMaster
    ? orders
    : orders
        .map((o) => ({
          ...o,
          // Item belongs to ANY of my assigned stations → keep. Items
          // with no kitchenStationId (legacy / unrouted) are dropped
          // for non-master workers — same as before.
          items: (o.items || []).filter((it: any) =>
            it.item?.kitchenStationId && stationIdSet.has(it.item.kitchenStationId),
          ),
        }))
  ).map((o) => ({
    ...o,
    items: (o.items || []).filter((it: any) => isItemLive(it, o)),
  })).filter((o) => o.items.length > 0);

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
    // In fullscreen we layer our own background + scroll since the
    // Layout chrome is bypassed by the Fullscreen API.
    <div
      ref={pageRef}
      className={clsx('space-y-5', fullscreen && 'bg-slate-50 p-4 h-screen overflow-y-auto')}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-gradient-orange">
            <ChefHat size={18} />
          </div>
          <div>
            <h1 className="page-title">Kitchen Display</h1>
            <p className="page-subtitle">
              {myStations.length > 0
                ? isMaster
                  ? `${myStationName} (master) — all items`
                  : myStations.length === 1
                    ? `${myStationName} station only`
                    : `${myStationName} stations`
                : readOnly ? 'Per-item live tracking (view-only)' : 'Per-item live tracking'}
            </p>
          </div>
          {myStations.length > 0 && (
            <span className="ml-1 text-[10px] font-bold px-2 py-1 rounded-full bg-brand-100 text-brand-900 border border-brand-200">
              {(myStationName ?? '').toUpperCase()}
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
            <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-900 px-4 py-2 rounded-xl text-sm font-bold">
              <Flame size={14} /> {visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} active
            </div>
          )}
          {/* Socket state pill. "Live" when the channel is healthy;
              "Reconnecting…" with a pulsing yellow dot while the client
              negotiates a new connection; "Offline" once the socket has
              given up. Backfill runs automatically on transition back to
              connected, so the user sees missed orders within the next
              REST fetch. */}
          <div
            className={
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border ' +
              (socketPhase === 'connected'
                ? 'bg-white border-slate-200 text-slate-500'
                : socketPhase === 'reconnecting'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-red-50 border-red-200 text-red-700')
            }
            title={
              socketPhase === 'connected'
                ? 'Real-time channel connected'
                : socketPhase === 'reconnecting'
                  ? 'Reconnecting — orders will sync once the channel is back'
                  : 'Real-time channel disconnected'
            }
          >
            {socketPhase === 'connected' ? (
              <>
                <span className="dot-live" /> Live
              </>
            ) : socketPhase === 'reconnecting' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Reconnecting…
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500" /> Offline
              </>
            )}
          </div>
          {/* Printer pill — visible when this station has a printer
              assigned and the outlet has any kitchen-print flag on.
              Tap to (re)pair via Web Bluetooth. */}
          {printerId && isBluetoothSupported() && (outletPrintCfg.auto || outletPrintCfg.allowManual) && (
            <button
              onClick={connectStationPrinter}
              className={clsx(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors',
                printerReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
              )}
              title={printerReady ? `${printerName} — ready` : 'Tap to pair the printer'}
            >
              {printerReady ? <PrinterIcon size={13} /> : <Bluetooth size={13} />}
              {printerReady ? (printerName || 'Printer ready') : 'Connect printer'}
            </button>
          )}
          {/* Bell pill — tap to test, long-press / right-click flips
              mute. Volume slider tucks into a popover on hover so it
              doesn't crowd the header for steady-state use. */}
          <div className="relative group">
            <button
              onClick={() => {
                // Single tap: test the bell at the current volume so
                // the operator can confirm it's audible before the
                // shift gets busy.
                playKitchenBell();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const next = !bellMuted;
                setBellMuted(next);
                setKitchenBellMuted(next);
                toast(next ? 'Bell muted' : 'Bell on', { duration: 1500 });
              }}
              className={clsx(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors',
                bellMuted
                  ? 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
              )}
              title={bellMuted
                ? 'Bell is muted — right-click to unmute'
                : 'New-order bell on — tap to test, right-click to mute'}
            >
              {bellMuted ? <BellOff size={13} /> : <Bell size={13} />}
              {bellMuted ? 'Muted' : `Bell ${bellVolume}%`}
            </button>
            {!bellMuted && (
              <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:block bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <Volume2 size={12} /> Bell volume
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={bellVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBellVolume(v);
                    setKitchenBellVolume(v);
                  }}
                  onMouseUp={() => playKitchenBell()}
                  onTouchEnd={() => playKitchenBell()}
                  className="w-full accent-amber-500"
                />
                <button
                  className="mt-2 w-full text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                  onClick={() => {
                    setBellMuted(true);
                    setKitchenBellMuted(true);
                  }}
                >
                  Mute bell
                </button>
              </div>
            )}
          </div>
          <button
            onClick={toggleFullscreen}
            className="btn-ghost p-2 text-slate-500 hover:text-slate-800"
            title={fullscreen ? 'Exit full screen' : 'Full screen — good for kitchen monitors or landscape phones'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
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

      {/* Items-to-prepare summary card. Collapsed shows the total count
          and the top items inline; expanded reveals the full per-item
          breakdown (pending / preparing / ready / total). Hidden when
          there's nothing outstanding. */}
      {itemAggregates.length > 0 && (
        <div className="card overflow-hidden p-0">
          <button
            onClick={() => setSummaryExpanded((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-800 flex items-center justify-center shrink-0">
              <Utensils size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">Items to Prepare</p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-bold text-brand-800">{grandTotal}</span>{' '}
                item{grandTotal === 1 ? '' : 's'} across {itemAggregates.length} variant{itemAggregates.length === 1 ? '' : 's'}
              </p>
            </div>
            {/* Inline preview — top items as chips. Hidden on small
                screens (the count + chevron is enough there). */}
            <div className="hidden md:flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden justify-end">
              {itemAggregates.slice(0, 4).map((r, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                >
                  {r.name} × {r.total}
                </span>
              ))}
              {itemAggregates.length > 4 && (
                <span className="text-[11px] text-slate-400 shrink-0">+{itemAggregates.length - 4} more</span>
              )}
            </div>
            <span className="text-slate-400 shrink-0 ml-1">
              {summaryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>
          {summaryExpanded && (
            <div className="border-t border-slate-100 px-4 py-3 overflow-x-auto">
              <table className="w-full text-xs min-w-[420px]">
                <thead className="text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="text-left font-bold py-1.5">Item</th>
                    <th className="text-right font-bold py-1.5 px-2">Pending</th>
                    <th className="text-right font-bold py-1.5 px-2">Preparing</th>
                    <th className="text-right font-bold py-1.5 px-2">Ready</th>
                    <th className="text-right font-bold py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {itemAggregates.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-slate-800">
                        {r.name}
                        {r.variant && <span className="text-slate-400"> ({r.variant})</span>}
                      </td>
                      <td className="py-1.5 text-right text-slate-500">{r.pending || '—'}</td>
                      <td className="py-1.5 text-right text-brand-800">{r.preparing || '—'}</td>
                      <td className="py-1.5 text-right text-emerald-600">{r.ready || '—'}</td>
                      <td className="py-1.5 text-right font-bold text-slate-900">{r.total}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200">
                    <td className="py-1.5 font-bold text-slate-800" colSpan={4}>Total</td>
                    <td className="py-1.5 font-black text-slate-900 text-right">{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Orders grid */}
      {visibleOrders.length === 0 ? (
        <div className="card empty-state" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="empty-state-icon" style={{ background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' }}>
            <CheckCircle2 size={26} className="text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-emerald-800">
            {myStations.length > 0 ? `No ${myStationName} items pending` : filter === 'ACTIVE' ? 'Kitchen is clear!' : `No ${FILTER_LABEL[filter].toLowerCase()} orders`}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            {filter === 'ACTIVE' ? 'No pending orders — great job! 🎉' : 'Try a different status.'}
          </p>
        </div>
      ) : (
        // Masonry-style layout via CSS multi-column. The browser packs
        // as many 240px columns as the viewport allows and balances the
        // cards across them — a short 2-item card sits snugly next to a
        // tall 10-item one without leaving a hole below it. No row
        // height freezing because there are no rows.
        <div style={{ columnWidth: '240px', columnGap: '12px' }}>
          {visibleOrders.map(order => {
            const m   = mins(order.createdAt);
            const clr = timerColor(m);
            return (
              <div key={order.id} className="rounded-2xl overflow-hidden flex flex-col mb-3"
                style={{ background: clr.card, border: `2px solid ${clr.border}`, boxShadow: '0 2px 8px rgb(0 0 0 / .06)', breakInside: 'avoid' }}>
                {/* Header — compact so the card fits the text. */}
                <div className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${clr.border}` }}>
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900 truncate">{order.orderNumber}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {order.tokenNumber != null && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          T#{order.tokenNumber}
                        </span>
                      )}
                      {order.table && <p className="text-xs font-semibold text-slate-600">Table {order.table.number}</p>}
                      {order.isParcel && <span className="badge badge-blue">Parcel</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <div className="flex items-center gap-1 font-black text-xl" style={{ color: clr.timer }}>
                      <Timer size={14} /> {m}
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: clr.badge, color: clr.badgeText }}>
                      {m < 10 ? 'On time' : m < 20 ? 'Late' : 'Urgent!'}
                    </span>
                    {outletPrintCfg.allowManual && printerId && (
                      <button
                        onClick={() => printOrder(order.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        title={printerReady ? 'Print kitchen receipt' : 'Tap "Connect printer" first'}
                      >
                        <PrinterIcon size={11} /> Print
                      </button>
                    )}
                  </div>
                </div>

                {/* Items — each with its own status + progress + actions */}
                <div className="flex-1 px-3 py-2.5 space-y-2">
                  {order.items?.map((item: any) => {
                    const status = (item.status || 'PENDING') as ItemStatus;
                    const s = ITEM_STATUS[status];
                    const next = NEXT_ITEM[status];
                    const nextLabel = NEXT_ITEM_LABEL[status];
                    const isBusy = pendingItem === item.id;
                    const stepIdx = STEP_ORDER.indexOf(status);
                    const isTerminal = status === 'SERVED' || status === 'CANCELLED';

                    return (
                      <div
                        key={item.id}
                        className={clsx(
                          'bg-white rounded-xl p-2.5 border border-slate-100',
                          // PENDING items blink until staff hits Start — once
                          // the item moves to PREPARING the animation drops.
                          status === 'PENDING' && 'attn-blink',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs shrink-0"
                            style={{ background: 'linear-gradient(135deg,#0B4245,#073032)' }}>
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
                                          : 'linear-gradient(135deg,#0B4245,#073032)',
                                      color: '#fff',
                                    }}
                                  >
                                    <nextLabel.icon size={13} /> {nextLabel.label}
                                  </button>
                                )}
                                {outletPrintCfg.allowManual && printerId && (
                                  <button
                                    onClick={() => printOrderItem(order.id, item.id)}
                                    disabled={isBusy}
                                    className="w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                    title={printerReady ? 'Print slip for this item' : 'Tap "Connect printer" first'}
                                  >
                                    <PrinterIcon size={13} />
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
      )}
    </div>
  );
}
