import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircle2, XCircle, ChefHat, Bell, Truck, Utensils, Clock, ChevronDown, Maximize2 } from 'lucide-react';
import { RootState } from '../../store';
import { getSocket } from '../../services/socket';
import { useUserRole } from '../../hooks/useUserRole';
import { useFullscreen } from '../../hooks/useFullscreen';
import FullscreenToggle from '../../components/common/FullscreenToggle';
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

  // Lane expansion — when set, that lane stretches to ~80% of the
  // horizontal space and the others shrink to vertical "diary tab"
  // spines. Click a tab to swap focus; click the expanded lane's
  // header chevron to collapse back to the equal-column layout.
  const [expandedLane, setExpandedLane] = useState<Lane | null>(null);
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
        'mx-auto',
        // In fullscreen we drop the page chrome's max-width so the
        // three lanes get every available pixel — same trick the
        // Kitchen + Orders pages use.
        isFullscreen ? 'p-4 bg-slate-50 h-screen overflow-auto' : 'p-4 lg:p-6 max-w-[1600px]',
      )}
    >
      <header className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Service desk</h1>
          <p className="text-xs text-slate-500">
            Verify postpaid lines, release self-service orders, and run table-service pickups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            {loading ? 'Loading…' : `${counts.verify + counts.release + counts.pickup} open`}
          </div>
          <FullscreenToggle active={isFullscreen} onClick={toggleFullscreen} />
        </div>
      </header>

      {/* Flex row: each lane is a flex child whose `flex` value swings
          when one lane is expanded. Default = equal columns; expanded
          lane → flex 8; collapsed laneas → flex 1 (rendered as a
          vertical "diary tab" spine). On small screens we drop to a
          single-column stack so the spines don't get pinched. */}
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-[60vh]">
        {(Object.keys(LANE_META) as Lane[]).map((lane) => {
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

              {/* Compact card grid. When expanded, lay cards in a 2-col
                  grid so the extra horizontal space is used. */}
              <div
                className={clsx(
                  'space-y-2 overflow-y-auto pr-1',
                  isExpanded && 'lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0',
                )}
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
                      className={clsx(
                        'bg-white rounded-xl border p-2.5 transition-all cursor-pointer hover:border-slate-300',
                        flashing
                          ? 'border-amber-300 shadow-[0_0_0_3px_rgba(245,158,11,0.25)] animate-pulse'
                          : 'border-slate-200',
                      )}
                    >
                      {/* Compact header — always visible. */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">#{o.orderNumber}</span>
                          {o.table?.number && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              T{o.table.number}
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
                          <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                            {items.map((it) => (
                              <li key={it.id} className="flex items-start gap-2">
                                <span className="font-semibold text-slate-900 min-w-[1.5rem]">×{it.quantity}</span>
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
                              </li>
                            ))}
                            {items.length === 0 && (
                              <li className="text-xs italic text-slate-400">No items in this lane.</li>
                            )}
                          </ul>
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
    </div>
  );
}
