import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ShoppingBag, IndianRupee, Calendar, ChevronRight, Store } from 'lucide-react';
import api from '../services/api';

interface Stats {
  range: { from: string; to: string };
  totalOrders: number;
  totalValue: number;
  daily: { date: string; orders: number; value: number }[];
  hourly: { hour: number; orders: number; value: number }[];
  orders: any[];
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

// Quick-range chips. First three are day-counts; the last three are month-
// counts. Stored as { unit, n } so the click handler can switch on unit
// without coupling chip labels to math.
const QUICK_RANGES: { label: string; unit: 'day' | 'month'; n: number }[] = [
  { label: '7d',  unit: 'day',   n: 7 },
  { label: '30d', unit: 'day',   n: 30 },
  { label: '90d', unit: 'day',   n: 90 },
  { label: '3mo', unit: 'month', n: 3 },
  { label: '6mo', unit: 'month', n: 6 },
  { label: '1yr', unit: 'month', n: 12 },
];

// Status filter — pulled in from the old History page so the dashboard can
// surface "completed only" / "cancelled" subsets without a separate screen.
const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Created', QUEUED: 'Queued', PREPARING: 'Preparing', READY: 'Ready',
  OUT_FOR_SERVICE: 'On its way', SERVED: 'Served',
  CANCELLED: 'Cancelled', DISPUTED: 'Disputed', RESOLVED: 'Resolved',
  FOR_REFUND: 'Refund pending', REFUND_COMPLETE: 'Refunded',
};
const STATUS_TONE: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-700',
  QUEUED: 'bg-yellow-100 text-yellow-700',
  PREPARING: 'bg-brand-100 text-brand-900',
  READY: 'bg-emerald-100 text-emerald-700',
  OUT_FOR_SERVICE: 'bg-teal-100 text-teal-700',
  SERVED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
  DISPUTED: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-sky-100 text-sky-700',
  FOR_REFUND: 'bg-pink-100 text-pink-700',
  REFUND_COMPLETE: 'bg-purple-100 text-purple-700',
};

type StatusFilter = 'ALL' | 'SERVED' | 'CANCELLED' | 'DISPUTED';

export default function DashboardPage() {
  const navigate = useNavigate();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [from, setFrom] = useState(fmtDate(monthAgo));
  const [to, setTo] = useState(fmtDate(today));
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/me/stats', {
        params: { from: new Date(from).toISOString(), to: new Date(to + 'T23:59:59').toISOString() },
      });
      setStats(data.data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const applyQuickRange = (unit: 'day' | 'month', n: number) => {
    const end = new Date();
    const start = new Date();
    if (unit === 'day') start.setDate(start.getDate() - n);
    else start.setMonth(start.getMonth() - n);
    setFrom(fmtDate(start));
    setTo(fmtDate(end));
  };

  const visibleOrders = useMemo(() => {
    const orders = stats?.orders || [];
    if (statusFilter === 'ALL') return orders;
    if (statusFilter === 'SERVED')   return orders.filter(o => ['SERVED', 'RESOLVED', 'REFUND_COMPLETE'].includes(o.status));
    if (statusFilter === 'CANCELLED') return orders.filter(o => o.status === 'CANCELLED');
    if (statusFilter === 'DISPUTED') return orders.filter(o => ['DISPUTED', 'FOR_REFUND'].includes(o.status));
    return orders;
  }, [stats, statusFilter]);

  const maxDaily  = Math.max(1, ...(stats?.daily  || []).map(d => d.orders));
  const maxHourly = Math.max(1, ...(stats?.hourly || []).map(h => h.orders));

  return (
    <div className="max-w-md mx-auto pb-4">
      {/* Header */}
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Your dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Order activity and history</p>
      </div>

      {/* Date range */}
      <div className="px-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-2">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <div className="grid grid-cols-2 gap-2 flex-1">
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="bg-slate-50 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand-400" />
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="bg-slate-50 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand-400" />
          </div>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide">
          {QUICK_RANGES.map(p => (
            <button
              key={p.label}
              onClick={() => applyQuickRange(p.unit, p.n)}
              className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 whitespace-nowrap"
            >
              Last {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <KpiCard label="Orders" value={stats?.totalOrders ?? 0} icon={ShoppingBag} tone="orange" />
        <KpiCard label="Total spend" value={`₹${Math.round(stats?.totalValue ?? 0).toLocaleString('en-IN')}`} icon={IndianRupee} tone="emerald" />
      </div>

      {/* Daily chart */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Orders per day</p>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400">Loading…</div>
          ) : stats?.daily?.length ? (
            <div className="flex items-end gap-1 h-32">
              {stats.daily.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-brand-500 to-brand-400 rounded-t-md hover:opacity-80 transition-opacity"
                    style={{ height: `${(d.orders / maxDaily) * 100}%`, minHeight: d.orders ? 4 : 0 }}
                    title={`${dayjs(d.date).format('DD MMM')} — ${d.orders} orders · ₹${d.value.toFixed(0)}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="h-32 flex items-center justify-center text-xs text-slate-400">No orders in this range</p>
          )}
          {stats?.daily?.length ? (
            <div className="flex justify-between mt-2 text-[10px] text-slate-400">
              <span>{dayjs(stats.daily[0].date).format('DD MMM')}</span>
              <span>{dayjs(stats.daily[stats.daily.length - 1].date).format('DD MMM')}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Hourly chart */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Orders by hour of day</p>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-xs text-slate-400">Loading…</div>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-24">
                {stats?.hourly?.map(h => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t-sm"
                      style={{ height: `${(h.orders / maxHourly) * 100}%`, minHeight: h.orders ? 3 : 0 }}
                      title={`${h.hour}:00 — ${h.orders} orders`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Orders list (merged from the old History page) */}
      <div className="px-4 mt-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">Orders</p>

        {/* Status filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {(['ALL', 'SERVED', 'CANCELLED', 'DISPUTED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border ${
                statusFilter === f
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'SERVED' ? 'Completed' : f === 'CANCELLED' ? 'Cancelled' : 'Disputed'}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)
          ) : visibleOrders.length ? visibleOrders.map(o => (
            <button
              key={o.id}
              onClick={() => navigate(`/receipt/${o.id}`)}
              className="w-full bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3 hover:border-brand-200"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                {o.outlet?.logoUrl
                  ? <img src={o.outlet.logoUrl} alt="" className="w-8 h-8 object-contain" />
                  : <Store size={16} className="text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 truncate">{o.outlet?.name || 'Outlet'}</p>
                  {o.tokenNumber != null && (
                    <span className="inline-flex items-center text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      Token #{o.tokenNumber}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {dayjs(o.createdAt).format('DD MMM, hh:mm A')}{o.items?.length ? ` · ${o.items.length} items` : ''}
                </p>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${STATUS_TONE[o.status] || 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">₹{Number(o.totalAmount).toFixed(0)}</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          )) : (
            <p className="text-xs text-slate-400 italic text-center py-6">No orders in this range</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: 'orange' | 'emerald' }) {
  const tones = {
    orange:  { iconBg: 'bg-brand-100 text-brand-800' },
    emerald: { iconBg: 'bg-emerald-100 text-emerald-600' },
  } as const;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone].iconBg} mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{label}</p>
    </div>
  );
}
