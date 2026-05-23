import { useEffect, useState, useCallback } from 'react';
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [from, setFrom] = useState(fmtDate(monthAgo));
  const [to, setTo] = useState(fmtDate(today));
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const maxDaily = Math.max(1, ...(stats?.daily || []).map(d => d.orders));
  const maxHourly = Math.max(1, ...(stats?.hourly || []).map(h => h.orders));

  return (
    <div className="max-w-md mx-auto pb-4">
      {/* Header */}
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Your dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Order activity over time</p>
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
          {[
            { label: '7d', d: 7 }, { label: '30d', d: 30 }, { label: '90d', d: 90 },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => {
                setFrom(fmtDate(new Date(today.getTime() - p.d * 24 * 60 * 60 * 1000)));
                setTo(fmtDate(today));
              }}
              className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50"
            >
              Last {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <KpiCard
          label="Orders"
          value={stats?.totalOrders ?? 0}
          icon={ShoppingBag}
          tone="orange"
        />
        <KpiCard
          label="Total spend"
          value={`₹${Math.round(stats?.totalValue ?? 0).toLocaleString('en-IN')}`}
          icon={IndianRupee}
          tone="emerald"
        />
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
                    className="w-full bg-gradient-to-t from-brand-500 to-orange-400 rounded-t-md hover:opacity-80 transition-opacity"
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

      {/* Orders list */}
      <div className="px-4 mt-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">Orders</p>
        <div className="space-y-2">
          {stats?.orders?.length ? stats.orders.map(o => (
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
                <p className="text-sm font-semibold text-slate-800 truncate">{o.outlet?.name || 'Outlet'}</p>
                <p className="text-[11px] text-slate-400">
                  {dayjs(o.createdAt).format('DD MMM, hh:mm A')} · {o.items?.length || 0} items
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">₹{Number(o.totalAmount).toFixed(0)}</p>
                <p className="text-[10px] text-slate-400">{o.status}</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          )) : !loading && (
            <p className="text-xs text-slate-400 italic text-center py-6">No orders in this range</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: 'orange' | 'emerald' }) {
  const tones = {
    orange: { bg: 'from-orange-500 to-orange-400', iconBg: 'bg-orange-100 text-orange-600' },
    emerald: { bg: 'from-emerald-500 to-emerald-400', iconBg: 'bg-emerald-100 text-emerald-600' },
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
