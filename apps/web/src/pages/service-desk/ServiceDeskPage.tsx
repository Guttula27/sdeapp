import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  tokenNumber?: number | null;
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

// Lane palette + icon; `titleKey` / `subtitleKey` are i18n stems resolved
// via t() at render time so switching language re-renders lane text.
const LANE_META: Record<Lane, { titleKey: string; subtitleKey: string; tint: string; accent: string; icon: any }> = {
  verify: {
    titleKey:    'laneVerifyTitle',
    subtitleKey: 'laneVerifySubtitle',
    tint: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
    icon: ChefHat,
  },
  release: {
    titleKey:    'laneReleaseTitle',
    subtitleKey: 'laneReleaseSubtitle',
    tint: 'bg-sky-50 border-sky-200',
    accent: 'text-sky-700',
    icon: Bell,
  },
  pickup: {
    titleKey:    'lanePickupTitle',
    subtitleKey: 'lanePickupSubtitle',
    tint: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
    icon: Truck,
  },
};

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
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier, has } = useUserRole();
  const { ref: pageRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const allowed = tier === 'outlet' || tier === 'business' || has('VIEW_SERVICE_DESK');
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const outletId = user?.outletId || '';
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  const [openTabs, setOpenTabs] = useState<OrderRow[]>([]);

  const [outletType, setOutletType] = useState<string | null>(null);
  useEffect(() => {
    if (!outletId) return;
    api.get(`/outlets/${outletId}`)
      .then(({ data }) => setOutletType(data.data?.outletType ?? null))
      .catch(() => setOutletType(null));
  }, [outletId]);
  const isSelfService = outletType === 'SELF_SERVICE' || outletType === 'SELF_SERVICE_PARCEL';
  const visibleLanes: Lane[] = isSelfService ? ['release'] : (['verify', 'release', 'pickup'] as Lane[]);

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
      toast.success(t('serviceDesk.toastReplacedPickNew', { label }), { duration: 2500 });
      setAddItemTarget({ orderId, orderNumber, tableNumber, prefocusItemId: baseItemId });
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotReplace'));
    }
  };
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), 30_000);
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
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

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
    const onStatusUpdated = () => fetchQueue();

    socket.on('serviceDeskAlert', onAlert);
    socket.on('orderStatusUpdated', onStatusUpdated);
    return () => {
      socket.off('serviceDeskAlert', onAlert);
      socket.off('orderStatusUpdated', onStatusUpdated);
    };
  }, [outletId, fetchQueue]);

  const confirmOrder = async (orderId: string) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, { action: 'confirm' });
      toast.success(t('serviceDesk.toastLinesConfirmed'));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotConfirm'));
    }
  };
  const strikeOrder = async (orderId: string) => {
    if (!window.confirm(t('serviceDesk.confirmStrikeAll'))) return;
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, { action: 'strike' });
      toast.success(t('serviceDesk.toastLinesCancelled'));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotCancel'));
    }
  };
  const strikeOneLine = async (orderId: string, itemId: string, label: string) => {
    if (!window.confirm(t('serviceDesk.confirmRemoveLine', { label }))) return;
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/verify-items`, {
        action: 'strike',
        itemIds: [itemId],
      });
      toast.success(t('serviceDesk.toastLineRemoved'));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotRemove'));
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
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotUpdateQty'));
    }
  };
  const advanceStatus = async (orderId: string, next: string) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/status`, { status: next });
      toast.success(t('serviceDesk.toastUpdated'));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotUpdate'));
    }
  };

  const serveReadyItems = async (order: OrderRow) => {
    const ready = order.items.filter((i) => i.status === 'READY');
    if (ready.length === 0) return;
    try {
      await Promise.all(ready.map((it) =>
        api.patch(`/outlets/${outletId}/orders/${order.id}/items/${it.id}/status`, { status: 'SERVED' }),
      ));
      toast.success(t('serviceDesk.toastServedCount', { count: ready.length }));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotServe'));
    }
  };
  const requestBill = async (orderId: string) => {
    if (!window.confirm(t('serviceDesk.confirmRequestBill'))) return;
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/bill-request`);
      toast.success(t('serviceDesk.toastBillRequested'));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotRequestBill'));
    }
  };
  const [payingId, setPayingId] = useState<string | null>(null);
  const capturePayment = async (orderId: string, mode: 'CASH' | 'UPI', amount: number) => {
    setPayingId(orderId);
    try {
      const { data } = await api.post('/payments/initiate', { orderId, mode, amount });
      if (mode === 'UPI' && data?.data?.paymentId) {
        await api.post(`/payments/${data.data.paymentId}/confirm`, { gatewayRef: '' });
      }
      toast.success(t('serviceDesk.toastPaymentRecorded', { amount: amount.toFixed(2) }));
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotRecordPayment'));
    } finally {
      setPayingId(null);
    }
  };

  const sectionGroups = useMemo(() => {
    type TableGroup = { tableId: string; tableNumber: string; orders: OrderRow[] };
    type Section = { id: string; name: string; tables: TableGroup[] };
    const map = new Map<string, Section>();
    const COUNTER = '__counter__';
    const UNSECTIONED = '__unsectioned__';
    for (const o of openTabs) {
      const sectionId = o.table?.section?.id ?? (o.table ? UNSECTIONED : COUNTER);
      const sectionName = o.table?.section?.name
        ?? (o.table ? t('serviceDesk.sectionUnsectioned') : t('serviceDesk.sectionCounter'));
      if (!map.has(sectionId)) map.set(sectionId, { id: sectionId, name: sectionName, tables: [] });
      const section = map.get(sectionId)!;
      const tableKey = o.table?.id ?? '__counter__';
      const tableNumber = o.table?.number ?? t('serviceDesk.counterFallback');
      let group = section.tables.find((tg) => tg.tableId === tableKey);
      if (!group) {
        group = { tableId: tableKey, tableNumber, orders: [] };
        section.tables.push(group);
      }
      group.orders.push(o);
    }
    const sections = Array.from(map.values()).sort((a, b) => {
      if (a.id === COUNTER) return 1;
      if (b.id === COUNTER) return -1;
      return a.name.localeCompare(b.name);
    });
    for (const s of sections) {
      s.tables.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
    }
    return sections;
  }, [openTabs, t]);

  const itemLineCls = (status: string): string => {
    if (status === 'PENDING_VERIFICATION') return 'bg-amber-50 text-amber-900 border-amber-100';
    if (status === 'CANCELLED') return 'bg-slate-50 text-slate-400 line-through border-slate-100';
    if (status === 'READY') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
    if (status === 'SERVED') return 'bg-slate-50 text-slate-500 border-slate-100';
    if (status === 'PREPARING') return 'bg-brand-50/40 text-brand-900 border-brand-100';
    return 'bg-white text-slate-700 border-slate-100';
  };

  const verifyItemsFor = (o: OrderRow) =>
    o.items.filter((i) => i.status === 'PENDING_VERIFICATION');
  const liveItemsFor = (o: OrderRow) =>
    o.items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'PENDING_VERIFICATION');

  const counts = useMemo(
    () => ({ verify: queue.verify.length, release: queue.release.length, pickup: queue.pickup.length }),
    [queue],
  );

  const [expandedLane, setExpandedLane] = useState<Lane | null>(null);

  const [focused, setFocused] = useState<'tabs' | 'lanes'>(() =>
    (outletType === 'SELF_SERVICE' || outletType === 'SELF_SERVICE_PARCEL') ? 'lanes' : 'tabs',
  );
  const didAnchorFocusRef = useRef(false);
  useEffect(() => {
    if (didAnchorFocusRef.current) return;
    if (outletType == null) return;
    setFocused(isSelfService ? 'lanes' : 'tabs');
    didAnchorFocusRef.current = true;
  }, [outletType, isSelfService]);
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
        {t('serviceDesk.outletScopedNotice')}
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className={clsx(
        'mx-auto flex flex-col',
        isFullscreen
          ? 'p-3 bg-slate-50 h-screen'
          : 'p-3 lg:p-4 max-w-[1600px] h-[calc(100dvh-64px)]',
      )}
    >
      <header className="flex items-center justify-between mb-3 gap-2 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('serviceDesk.title')}</h1>
          <p className="text-xs text-slate-500">
            {isSelfService ? t('serviceDesk.subtitleSelfService') : t('serviceDesk.subtitleFull')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            {loading
              ? t('serviceDesk.loading')
              : isSelfService
                ? t('serviceDesk.openCount', { count: counts.release })
                : t('serviceDesk.openCount', { count: counts.verify + counts.release + counts.pickup })}
          </div>
          <FullscreenToggle active={isFullscreen} onClick={toggleFullscreen} />
        </div>
      </header>

      {/* ── Open tabs (primary working surface) ───────────────── */}
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
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">{t('serviceDesk.openTabsHeading')}</h2>
              {focused === 'tabs' && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('serviceDesk.openTabsSubtitle')}
                </p>
              )}
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            {t('serviceDesk.openTabsMeta', { open: openTabs.length, tables: sectionGroups.reduce((s, g) => s + g.tables.length, 0) })}
          </span>
        </button>
        {focused === 'tabs' && (
        <div className="flex-1 min-h-0 overflow-auto mt-2">
        {openTabs.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-2 py-6 text-center bg-white border border-slate-100 rounded-xl">
            {t('serviceDesk.openTabsEmpty')}
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
                    {t('serviceDesk.sectionTablesCount', { count: sec.tables.length })}
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
                            {t('serviceDesk.tableOrdersCount', { count: tg.orders.length })}
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
                                {o.tokenNumber != null && (
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                    T#{o.tokenNumber}
                                  </span>
                                )}
                                {billed && (
                                  <span className="text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 px-1.5 py-0.5 rounded">
                                    {t('serviceDesk.billRequestedBadge')}
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
                                <li className="text-[11px] italic text-slate-400">{t('serviceDesk.noActiveLines')}</li>
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
                                    {it.item?.name || t('serviceDesk.itemFallback')}
                                    {it.variant?.name ? ` — ${it.variant.name}` : ''}
                                  </span>
                                  {isUnverified && it.item?.id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        replaceLine(o.id, o.orderNumber, tg.tableNumber, it.id, it.item!.id, it.item?.name || t('serviceDesk.itemFallback'));
                                      }}
                                      title={t('serviceDesk.replaceTitle')}
                                      className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-amber-700 hover:bg-amber-100"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                  )}
                                  {isUnverified && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        strikeOneLine(o.id, it.id, it.item?.name || t('serviceDesk.itemFallback'));
                                      }}
                                      title={t('serviceDesk.removeLineTitle')}
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
                                      prev.map((tab) => (tab.id === updated.id ? { ...tab, ...updated } as OrderRow : tab)),
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
                                  <Plus size={10} /> {t('serviceDesk.addItem')}
                                </button>
                              )}
                              {!billed && live.length > 0 && (
                                <button
                                  onClick={() => requestBill(o.id)}
                                  className="text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded px-2 py-1 inline-flex items-center gap-1"
                                >
                                  <Bell size={10} /> {t('serviceDesk.billNow')}
                                </button>
                              )}
                              {billed && (
                                <>
                                  <span className="text-[10px] text-slate-500 font-semibold mr-1 inline-flex items-center">
                                    {t('serviceDesk.payLabel')}
                                  </span>
                                  <button
                                    onClick={() => capturePayment(o.id, 'CASH', Number(o.totalAmount ?? 0))}
                                    disabled={payingId === o.id}
                                    className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Banknote size={10} /> {t('serviceDesk.payCash')}
                                  </button>
                                  <button
                                    onClick={() => capturePayment(o.id, 'UPI', Number(o.totalAmount ?? 0))}
                                    disabled={payingId === o.id}
                                    className="text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Smartphone size={10} /> {t('serviceDesk.payOnline')}
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

      {/* ── Lanes section ─────────────────────────────────────── */}
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
              {isSelfService ? t('serviceDesk.releaseHeadingSelfService') : t('serviceDesk.lanesHeading')}
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            {t('serviceDesk.pendingCount', { count: visibleLanes.reduce((s, l) => s + counts[l], 0) })}
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
          const flexBasis = expandedLane === null ? 1 : isExpanded ? 8 : 1;

          if (isCollapsedTab) {
            return (
              <button
                key={lane}
                onClick={() => setExpandedLane(lane)}
                style={{ flex: flexBasis }}
                className={clsx(
                  'hidden lg:flex flex-col items-center justify-center gap-3 rounded-2xl border p-3 transition-all hover:brightness-95',
                  meta.tint,
                )}
                title={t('serviceDesk.expandLane', { title: t(`serviceDesk.${meta.titleKey}`) })}
              >
                <Icon size={18} className={meta.accent} />
                <span
                  className={clsx('text-[11px] font-bold uppercase tracking-wider', meta.accent)}
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {t(`serviceDesk.${meta.titleKey}`)}
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
                    {t(`serviceDesk.${meta.titleKey}`)}
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
                  title={isExpanded ? t('serviceDesk.collapseTitle') : t('serviceDesk.expandTitle')}
                >
                  <Maximize2 size={13} />
                </button>
              </header>
              {!isExpanded && (
                <p className="text-[11px] text-slate-500 px-1 mb-3">{t(`serviceDesk.${meta.subtitleKey}`)}</p>
              )}

              {rows.length === 0 && (
                <p className="text-xs text-slate-400 italic px-2 py-6 text-center">{t('serviceDesk.emptyLane')}</p>
              )}

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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">#{o.orderNumber}</span>
                          {o.tokenNumber != null && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-full">
                              T#{o.tokenNumber}
                            </span>
                          )}
                          {o.table?.number ? (
                            <span className="text-[11px] font-bold bg-brand-50 text-brand-800 px-2 py-0.5 rounded inline-flex items-center gap-1 border border-brand-100">
                              <Armchair size={11} /> {o.table.number}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                              {t('serviceDesk.cardCounterBadge')}
                            </span>
                          )}
                          {o.isPostpaid && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              {t('serviceDesk.cardPostpaidBadge')}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500">
                            {t('serviceDesk.cardItemsCount', { count: items.length })}
                          </span>
                          {readyCount > 0 && lane !== 'verify' && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                              {t('serviceDesk.cardReadyCount', { count: readyCount })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock size={11} /> {t('serviceDesk.elapsedMinutes', { mins })}
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
                      {(o.customer?.name || o.customer?.phone) && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {o.customer?.name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                        </p>
                      )}

                      {isCardOpen && (
                        <>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {items.map((it) => {
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
                                      title={t('serviceDesk.cardDecrease')}
                                    >
                                      <Minus size={11} />
                                    </button>
                                    <span className="text-xs font-bold text-slate-900 w-5 text-center">
                                      {it.quantity}
                                    </span>
                                    <button
                                      onClick={() => setLineQty(o.id, it.id, it.quantity + 1)}
                                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800"
                                      title={t('serviceDesk.cardIncrease')}
                                    >
                                      <Plus size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-slate-900 min-w-[1.5rem]">×{it.quantity}</span>
                                )}
                                <span className="truncate flex-1">
                                  {it.item?.name || t('serviceDesk.itemFallback')}
                                  {it.variant?.name ? ` — ${it.variant.name}` : ''}
                                  {it.notes ? <span className="text-slate-400"> · {it.notes}</span> : null}
                                </span>
                                {it.status === 'READY' && (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                    {t('serviceDesk.statusReadyInline')}
                                  </span>
                                )}
                                {it.status === 'PREPARING' && (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                    <ChefHat size={9} /> {t('serviceDesk.statusCookingInline')}
                                  </span>
                                )}
                                {isVerifyLine && (
                                  <button
                                    onClick={() => strikeOneLine(o.id, it.id, it.item?.name || t('serviceDesk.itemFallback'))}
                                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-rose-500 hover:bg-rose-100"
                                    title={t('serviceDesk.removeLineTitle')}
                                  >
                                    <XCircle size={13} />
                                  </button>
                                )}
                              </li>
                              );
                            })}
                            {items.length === 0 && (
                              <li className="text-xs italic text-slate-400">{t('serviceDesk.emptyLane')}</li>
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
                                  <CheckCircle2 size={13} /> {t('serviceDesk.confirmBtn')}
                                </button>
                                <button
                                  onClick={() => strikeOrder(o.id)}
                                  className="inline-flex items-center gap-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                >
                                  <XCircle size={13} /> {t('serviceDesk.strikeBtn')}
                                </button>
                              </>
                            )}
                            {lane === 'release' && (() => {
                              const laneReadyCount = items.filter((i) => i.status === 'READY').length;
                              const totalCount = items.length;
                              const isPartial = laneReadyCount < totalCount;
                              return (
                                <button
                                  onClick={() => serveReadyItems(o)}
                                  className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                  title={isPartial
                                    ? t('serviceDesk.releasePartialTitle', { ready: laneReadyCount, total: totalCount })
                                    : t('serviceDesk.releaseFullTitle')}
                                >
                                  <Bell size={13} />
                                  {isPartial
                                    ? t('serviceDesk.releasePartial', { ready: laneReadyCount, total: totalCount })
                                    : t('serviceDesk.releaseForPickup')}
                                </button>
                              );
                            })()}
                            {lane === 'pickup' && (() => {
                              const laneReadyCount = items.filter((i) => i.status === 'READY').length;
                              return (
                                <button
                                  onClick={() => serveReadyItems(o)}
                                  disabled={laneReadyCount === 0}
                                  title={laneReadyCount === 0 ? t('serviceDesk.serveWaitingTitle') : undefined}
                                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                                >
                                  <Utensils size={13} /> {t('serviceDesk.servePrefix')} {laneReadyCount > 0 ? t('serviceDesk.serveReadyCount', { count: laneReadyCount }) : t('serviceDesk.serveReadyDefault')}
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

/* ── Add item modal ───────────────────────────────────────────────── */
function AddItemModal({
  outletId, orderId, orderNumber, tableNumber, prefocusItemId, onClose, onSaved,
}: {
  outletId: string;
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  prefocusItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
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
  type ConfigDraft = {
    item: MenuItem;
    variantId: string;
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
        if (!cancelled) toast.error(t('serviceDesk.toastCouldNotLoadMenu'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [outletId, t]);

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
    prefocusedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefocusItemId, loading, menu]);

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
    const toppingsLabel = toppings.length ? toppings.map((tp) => tp.label).join(', ') : undefined;
    const toppingKey = toppings.map((tp) => `${tp.toppingId}:${tp.optionId ?? ''}`).sort().join('|');
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
    if (variants.length === 0 && toppingLinks.length === 0) {
      return addPlainItem(item);
    }
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
            ? l.toppings.map((tp) => ({ toppingId: tp.toppingId, optionId: tp.optionId }))
            : undefined,
        })),
      });
      toast.success(t('serviceDesk.toastAdded', { count: cart.length }));
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('serviceDesk.toastCouldNotAdd'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">{t('serviceDesk.modalAddTitle', { number: orderNumber })}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tableNumber ? t('serviceDesk.modalTableChip', { number: tableNumber }) : t('serviceDesk.modalCounterChip')}{t('serviceDesk.modalTail')}
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
            placeholder={t('serviceDesk.searchItems')}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 italic px-3 py-6 text-center">{t('serviceDesk.loadingMenu')}</p>
          ) : filteredCats.length === 0 ? (
            <p className="text-xs text-slate-400 italic px-3 py-6 text-center">
              {query ? t('serviceDesk.noItemsMatch') : t('serviceDesk.noItemsAvailable')}
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
              {t('serviceDesk.toAddSummary', { count: cart.length, total: cartTotal.toFixed(2) })}
            </p>
            <ul className="space-y-1">
              {cart.map((l) => (
                <li key={l.key} className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-0.5 border border-slate-300 rounded-md bg-white shrink-0">
                    <button
                      onClick={() => updateQty(l.key, -1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800"
                      title={t('serviceDesk.cardDecrease')}
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-bold text-slate-900 w-5 text-center">{l.qty}</span>
                    <button
                      onClick={() => updateQty(l.key, 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800"
                      title={t('serviceDesk.cardIncrease')}
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
            {t('serviceDesk.cancelBtn')}
          </button>
          <button
            onClick={submit}
            disabled={saving || cart.length === 0}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? t('serviceDesk.adding') : t('serviceDesk.addLinesBtn', { count: cart.length || 0 })}
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
  const { t } = useTranslation();
  const { item } = draft;
  const variants = (item.variants || []).filter((v) => v.isAvailable);
  const variant = variants.find((v) => v.id === draft.variantId);

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
          <p className="text-[11px] text-slate-500 mt-0.5">{t('serviceDesk.configPickVariant', { unit: unit.toFixed(2) })}</p>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {variants.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">{t('serviceDesk.variantHeading')}</p>
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
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">{t('serviceDesk.toppingsHeading')}</p>
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
                          {link.isRequired && <span className="ml-1 text-[9px] font-bold text-amber-700">{t('serviceDesk.requiredBadge')}</span>}
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
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">{t('serviceDesk.quantityHeading')}</p>
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
            {t('serviceDesk.cancelBtn')}
          </button>
          <button
            onClick={onConfirm}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-2"
          >
            {t('serviceDesk.addWithPrice', { amount: (unit * draft.qty).toFixed(2) })}
          </button>
        </footer>
      </div>
    </div>
  );
}
