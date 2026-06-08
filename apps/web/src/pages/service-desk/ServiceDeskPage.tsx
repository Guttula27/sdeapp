import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircle2, XCircle, ChefHat, Bell, Truck, Utensils, Clock } from 'lucide-react';
import { RootState } from '../../store';
import { getSocket } from '../../services/socket';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';

type Lane = 'verify' | 'release' | 'pickup';

type OrderRow = {
  id: string;
  orderNumber: string;
  outletId: string;
  tableId: string | null;
  status: string;
  isPostpaid: boolean;
  createdAt: string;
  table?: { id: string; number: string } | null;
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
  // Outlet-tier admins always have access; everyone else needs the
  // explicit responsibility (Cashier role gets it by default).
  const allowed = tier === 'outlet' || tier === 'business' || has('VIEW_SERVICE_DESK');
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const outletId = user?.outletId || '';
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
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
      const { data } = await api.get(`/outlets/${outletId}/orders/service-desk/queue`);
      setQueue((data.data as Queue) || EMPTY_QUEUE);
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
  const advanceStatus = async (orderId: string, next: string) => {
    try {
      await api.patch(`/outlets/${outletId}/orders/${orderId}/status`, { status: next });
      toast.success('Updated');
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not update');
    }
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

  if (!outletId) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Service desk is per-outlet. Your account isn't linked to an outlet yet.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Service desk</h1>
          <p className="text-xs text-slate-500">
            Verify postpaid lines, release self-service orders, and run table-service pickups.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {loading ? 'Loading…' : `${counts.verify + counts.release + counts.pickup} open`}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  const items = lane === 'verify' ? verifyItemsFor(o) : liveItemsFor(o);
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
                            {o.table?.number && (
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                Table {o.table.number}
                              </span>
                            )}
                            {o.isPostpaid && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                Postpaid
                              </span>
                            )}
                          </div>
                          {o.customer?.name && (
                            <p className="text-xs text-slate-500 truncate">{o.customer.name}</p>
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
                        {lane === 'release' && (
                          <button
                            onClick={() => advanceStatus(o.id, 'READY_FOR_PICKUP')}
                            className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                          >
                            <Bell size={13} /> Release for pickup
                          </button>
                        )}
                        {lane === 'pickup' && (
                          <>
                            <button
                              onClick={() => advanceStatus(o.id, 'OUT_FOR_SERVICE')}
                              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <Truck size={13} /> On its way
                            </button>
                            <button
                              onClick={() => advanceStatus(o.id, 'SERVED')}
                              className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <Utensils size={13} /> Served
                            </button>
                          </>
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
