import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Package, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';
import { RootState } from '../../store';
import { getSocket } from '../../services/socket';
import { useUserRole } from '../../hooks/useUserRole';
import { useFullscreen } from '../../hooks/useFullscreen';
import FullscreenToggle from '../../components/common/FullscreenToggle';
import api from '../../services/api';

type Lane = 'pack' | 'handover';

type OrderRow = {
  id: string;
  orderNumber: string;
  outletId: string;
  status: string;
  isParcel: boolean;
  createdAt: string;
  customer?: { id: string; name?: string | null; phone?: string | null } | null;
  items: Array<{
    id: string;
    quantity: number;
    status: string;
    notes?: string | null;
    item?: { id: string; name: string } | null;
    variant?: { id: string; name: string } | null;
  }>;
};

type Queue = { pack: OrderRow[]; handover: OrderRow[] };
const EMPTY_QUEUE: Queue = { pack: [], handover: [] };

const LANE_META: Record<Lane, { title: string; subtitle: string; tint: string; accent: string; icon: any }> = {
  pack: {
    title: 'Pack',
    subtitle: 'Kitchen finished — pack the parcel and mark it ready for handover.',
    tint: 'bg-amber-50 border-amber-200',
    accent: 'text-amber-700',
    icon: Package,
  },
  handover: {
    title: 'Handover',
    subtitle: 'Parcel packed — waiting for the customer to collect.',
    tint: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
    icon: ShoppingBag,
  },
};

// Same chime helper pattern as ServiceDeskPage — cheap browser tone,
// AudioContext closed after the beep so no leak.
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
    osc.frequency.value = 660; // a tone lower than service-desk to distinguish
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

export default function ParcelDeskPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier, has } = useUserRole();
  // useFullscreen MUST sit above every conditional `return` below —
  // same Rules-of-Hooks fix as ServiceDeskPage.
  const { ref: pageRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const allowed = tier === 'outlet' || tier === 'business' || has('VIEW_PARCEL_DESK');
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const outletId = user?.outletId || '';
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!outletId) return;
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/parcel-desk/queue`);
      setQueue((data.data as Queue) || EMPTY_QUEUE);
    } catch {
      // socket-driven path picks up the next nudge
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    if (!outletId) return;
    const socket = getSocket(outletId);
    socket.emit('joinParcelDesk', outletId);

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

    socket.on('parcelDeskAlert', onAlert);
    socket.on('orderStatusUpdated', onStatusUpdated);
    return () => {
      socket.off('parcelDeskAlert', onAlert);
      socket.off('orderStatusUpdated', onStatusUpdated);
    };
  }, [outletId, fetchQueue]);

  const advanceStatus = async (orderId: string, next: string, label: string) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/status`, { status: next });
      toast.success(label);
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not update');
    }
  };

  const liveItemsFor = (o: OrderRow) =>
    o.items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'PENDING_VERIFICATION');

  const counts = useMemo(
    () => ({ pack: queue.pack.length, handover: queue.handover.length }),
    [queue],
  );

  if (!outletId) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Parcel desk is per-outlet. Your account isn't linked to an outlet yet.
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className={clsx(
        'mx-auto',
        isFullscreen ? 'p-4 bg-slate-50 h-screen overflow-auto' : 'p-4 lg:p-6 max-w-[1600px]',
      )}
    >
      <header className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Parcel desk</h1>
          <p className="text-xs text-slate-500">
            Pack parcels coming out of the kitchen and hand them over to customers as they collect.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            {loading ? 'Loading…' : `${counts.pack + counts.handover} open`}
          </div>
          <FullscreenToggle active={isFullscreen} onClick={toggleFullscreen} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.keys(LANE_META) as Lane[]).map((lane) => {
          const meta = LANE_META[lane];
          const rows = queue[lane];
          const Icon = meta.icon;
          return (
            <section key={lane} className={clsx('rounded-2xl border p-3 min-h-[60vh]', meta.tint)}>
              <header className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={meta.accent} />
                  <h2 className={clsx('text-sm font-bold uppercase tracking-wider', meta.accent)}>
                    {meta.title}
                  </h2>
                  <span className="text-xs font-semibold bg-white/70 rounded-full px-2 py-0.5 text-slate-600">
                    {rows.length}
                  </span>
                </div>
              </header>
              <p className="text-[11px] text-slate-500 px-1 mb-3">{meta.subtitle}</p>

              {rows.length === 0 && (
                <p className="text-xs text-slate-400 italic px-2 py-6 text-center">Nothing in this lane.</p>
              )}

              <div className="space-y-2">
                {rows.map((o) => {
                  const items = liveItemsFor(o);
                  const mins = elapsedMins(o.createdAt);
                  const flashing = flash.has(o.id);
                  return (
                    <article
                      key={o.id}
                      className={clsx(
                        'bg-white rounded-xl border p-3 transition-all',
                        flashing
                          ? 'border-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.25)] animate-pulse'
                          : 'border-slate-200',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">#{o.orderNumber}</span>
                            <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                              Parcel
                            </span>
                          </div>
                          {o.customer?.name && (
                            <p className="text-xs text-slate-500 truncate">{o.customer.name}</p>
                          )}
                          {o.customer?.phone && (
                            <p className="text-[11px] text-slate-400 font-mono">{o.customer.phone}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                          <Clock size={11} /> {mins}m
                        </span>
                      </div>

                      <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                        {items.map((it) => (
                          <li key={it.id} className="flex items-start gap-2">
                            <span className="font-semibold text-slate-900 min-w-[1.5rem]">×{it.quantity}</span>
                            <span className="truncate">
                              {it.item?.name || 'Item'}
                              {it.variant?.name ? ` — ${it.variant.name}` : ''}
                              {it.notes ? <span className="text-slate-400"> · {it.notes}</span> : null}
                            </span>
                          </li>
                        ))}
                        {items.length === 0 && (
                          <li className="text-xs italic text-slate-400">No items in this lane.</li>
                        )}
                      </ul>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {lane === 'pack' && (
                          <button
                            onClick={() => advanceStatus(o.id, 'READY_FOR_PICKUP', 'Marked packed — moved to Handover')}
                            className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                          >
                            <Package size={13} /> Mark packed
                          </button>
                        )}
                        {lane === 'handover' && (
                          <button
                            onClick={() => advanceStatus(o.id, 'SERVED', 'Handed over to customer')}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                          >
                            <CheckCircle2 size={13} /> Mark handed over
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
