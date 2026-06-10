import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useSelector } from 'react-redux';
import { IndianRupee, ShoppingBag, TrendingUp, Percent, Calendar, ChefHat, Download, Banknote, Smartphone, Wallet, Users } from 'lucide-react';
import clsx from 'clsx';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';
import dayjs from 'dayjs';
import { rangeFor, type PresetId } from '../../utils/dateRangePresets';
import { downloadCsv, rowsToCsv } from '../../utils/csvExport';
import GstTab from './tabs/GstTab';
import CategoryTab from './tabs/CategoryTab';
import CustomersTab from './tabs/CustomersTab';
import DiscountsTab from './tabs/DiscountsTab';

type TabId = 'overview' | 'gst' | 'category' | 'customers' | 'discounts';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview',  label: 'Overview' },
  { id: 'gst',       label: 'GST' },
  { id: 'category',  label: 'Categories' },
  { id: 'customers', label: 'Customers' },
  { id: 'discounts', label: 'Discounts' },
];

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d',        label: '7d' },
  { id: '30d',       label: '30d' },
  { id: 'mtd',       label: 'MTD' },
  { id: 'lastMonth', label: 'Last month' },
];

const PIE_COLORS = ['#0B4245','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'];

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-bold" style={{ color: p.color }}>
          {p.dataKey === 'revenue' ? `₹${Number(p.value).toFixed(0)}` : p.value}
          <span className="font-normal text-slate-400 ml-1">{p.name}</span>
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const businessId = user?.businessId;
  const [businessOutlets, setBusinessOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  useEffect(() => {
    if (tier !== 'business' || !businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then((r) => {
        const list = r.data.data || [];
        setBusinessOutlets(list);
        if (!selectedOutletId && list.length) setSelectedOutletId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, businessId]);
  const outletId = tier === 'business' ? selectedOutletId : (user?.outletId || 'demo-outlet');
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [to, setTo]     = useState(dayjs().format('YYYY-MM-DD'));
  const [tab, setTab]   = useState<TabId>('overview');
  const setPreset = (id: PresetId) => {
    const r = rangeFor(id);
    if (!r) return;
    setFrom(dayjs(r.from).format('YYYY-MM-DD'));
    setTo(dayjs(r.to).format('YYYY-MM-DD'));
  };
  const [hourly, setHourly]     = useState<any[]>([]);
  const [revenue, setRevenue]   = useState<any>(null);
  const [itemSales, setItemSales] = useState<any[]>([]);
  const [kitchen, setKitchen]   = useState<any>(null);
  const [loading, setLoading]   = useState(false);

  const fetch = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [h, r, items, k] = await Promise.all([
        api.get(`/reports/hourly?outletId=${outletId}&date=${from}`),
        api.get(`/reports/revenue?outletId=${outletId}&from=${from}&to=${to}`),
        api.get(`/reports/item-sales?outletId=${outletId}&from=${from}&to=${to}`),
        api.get(`/reports/kitchen?outletId=${outletId}&from=${from}&to=${to}`),
      ]);
      setHourly(h.data.data || []);
      setRevenue(r.data.data.summary);
      setItemSales(items.data.data || []);
      setKitchen(k.data.data);
    } finally { setLoading(false); }
  }, [outletId, from, to]);

  useEffect(() => { fetch(); }, [fetch]);

  // Overview-tab CSV: revenue summary + payment split + top items.
  const exportOverviewCsv = () => {
    if (!revenue) return;
    const ps = revenue.paymentSplit ?? {};
    const summary = [
      { Field: 'Revenue',  Value: revenue.totalRevenue },
      { Field: 'Orders served', Value: revenue.totalOrders },
      { Field: 'Orders total',  Value: revenue.totalOrdersAll ?? revenue.totalOrders },
      { Field: 'Customers',     Value: revenue.totalCustomers },
      { Field: 'Avg order',     Value: revenue.avgOrderValue },
      { Field: 'GST',           Value: revenue.totalTax },
      { Field: 'Cash',     Value: ps.CASH?.amount ?? 0 },
      { Field: 'UPI',      Value: ps.UPI?.amount  ?? 0 },
      { Field: 'Card',     Value: ps.CARD?.amount ?? 0 },
      { Field: 'Wallet',   Value: ps.WALLET?.amount ?? 0 },
      { Field: 'NetBanking', Value: ps.NET_BANKING?.amount ?? 0 },
    ];
    downloadCsv(`overview-${from}-to-${to}.csv`, rowsToCsv(summary));
  };

  const hourlyChart = hourly.map(h => ({ ...h, hour: `${String(h.hour).padStart(2,'0')}h` }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">{from === to ? dayjs(from).format('D MMM YYYY') : `${dayjs(from).format('D MMM')} – ${dayjs(to).format('D MMM YYYY')}`}</p>
        </div>
        <button className="btn-secondary" onClick={exportOverviewCsv} disabled={!revenue || tab !== 'overview'}>
          <Download size={14} /> Export (overview)
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-1 inline-flex gap-1 flex-wrap">
        {TABS.map((tx) => (
          <button
            key={tx.id}
            onClick={() => setTab(tx.id)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              tab === tx.id ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {tx.label}
          </button>
        ))}
      </div>

      {/* Outlet picker (business tier) */}
      {tier === 'business' && (
        <div className="card p-3 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Outlet</span>
          <select
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="input py-1.5 text-sm"
            style={{ minWidth: 200 }}
          >
            {businessOutlets.length === 0 && <option value="">No outlets</option>}
            {businessOutlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="input text-sm w-36" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={to} min={from} max={dayjs().format('YYYY-MM-DD')} onChange={e => setTo(e.target.value)} className="input text-sm w-36" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setPreset(p.id)} className="filter-pill filter-pill-inactive btn-sm">
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={fetch} disabled={loading} className="btn-primary ml-auto">
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Apply'}
        </button>
      </div>

      {/* ── Overview tab (existing content) ──────────────────── */}
      {tab === 'overview' && <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label:'Revenue',     value: revenue ? `₹${Number(revenue.totalRevenue).toLocaleString('en-IN')}` : '—', icon: IndianRupee, cls: 'icon-gradient-green' },
          // Orders shows total placed (any status) with a secondary line for
          // SERVED-only, matching the revenue context. totalOrdersAll falls
          // back to totalOrders for old API responses.
          {
            label: 'Orders',
            value: revenue ? (revenue.totalOrdersAll ?? revenue.totalOrders ?? 0) : '—',
            sub:   revenue ? `${revenue.totalOrders ?? 0} served` : '',
            icon:  ShoppingBag,
            cls:   'icon-gradient-blue',
          },
          { label:'Customers',   value: revenue?.totalCustomers ?? '—',                                              icon: Users,        cls: 'icon-gradient-pink' },
          { label:'Avg. Order',  value: revenue ? `₹${Number(revenue.avgOrderValue).toFixed(0)}` : '—',              icon: TrendingUp,   cls: 'icon-gradient-purple' },
          { label:'GST',         value: revenue ? `₹${Number(revenue.totalTax).toLocaleString('en-IN')}` : '—',      icon: Percent,      cls: 'icon-gradient-orange' },
        ].map((s: any) => (
          <div key={s.label} className="card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.cls}`}><s.icon size={16} /></div>
            <p className="text-2xl font-black text-slate-900">{loading ? <span className="skeleton h-7 w-24 block rounded-lg" /> : s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            {s.sub && !loading && <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Payment mode breakdown */}
      {revenue?.paymentSplit && (() => {
        const ps = revenue.paymentSplit;
        const onlineAmount = Number((ps.CARD?.amount || 0) + (ps.WALLET?.amount || 0) + (ps.NET_BANKING?.amount || 0));
        const onlineCount  = Number((ps.CARD?.count  || 0) + (ps.WALLET?.count  || 0) + (ps.NET_BANKING?.count  || 0));
        const cash   = { amount: Number(ps.CASH?.amount || 0), count: Number(ps.CASH?.count || 0) };
        const upi    = { amount: Number(ps.UPI?.amount  || 0), count: Number(ps.UPI?.count  || 0) };
        const total  = cash.amount + upi.amount + onlineAmount;
        const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
        const tiles = [
          { label: 'Cash',   icon: Banknote,   cls: 'icon-gradient-green',  amount: cash.amount,   count: cash.count,   pct: pct(cash.amount) },
          { label: 'UPI',    icon: Smartphone, cls: 'icon-gradient-blue',   amount: upi.amount,    count: upi.count,    pct: pct(upi.amount) },
          { label: 'Online', icon: Wallet,     cls: 'icon-gradient-purple', amount: onlineAmount,  count: onlineCount,  pct: pct(onlineAmount) },
        ];
        return (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Payment Mode Breakdown</p>
                <p className="text-xs text-slate-400 mt-0.5">Successful payments in this range · {dayjs(from).format('D MMM')} – {dayjs(to).format('D MMM')}</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">Total ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tiles.map((t) => (
                <div key={t.label} className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.cls} shrink-0`}>
                    <t.icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">{t.label}</p>
                      <span className="text-[10px] font-bold text-slate-400">{t.pct}%</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 tabular-nums tracking-tight">₹{t.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[11px] text-slate-400">{t.count} payment{t.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Proportional bar */}
            {total > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                <div style={{ width: `${pct(cash.amount)}%`, background: '#10b981' }} />
                <div style={{ width: `${pct(upi.amount)}%`, background: '#3b82f6' }} />
                <div style={{ width: `${pct(onlineAmount)}%`, background: '#8b5cf6' }} />
              </div>
            )}
          </div>
        );
      })()}

      {/* Kitchen avg */}
      {kitchen && (
        <div className="card p-5 flex items-center gap-6 flex-wrap">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-gradient-orange"><ChefHat size={18} /></div>
          <div><p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Avg. Preparation</p><p className="text-2xl font-black text-slate-900">{kitchen.avgPreparationMinutes} min</p></div>
          <div className="h-10 border-l border-slate-100 hidden sm:block" />
          <div><p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Sample</p><p className="text-2xl font-black text-slate-900">{kitchen.sampleSize} orders</p></div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-800 mb-1">Revenue by Hour</p>
          <p className="text-xs text-slate-400 mb-4">Today's breakdown</p>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={hourlyChart} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0B4245" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#0B4245', stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="text-sm font-bold text-slate-800 mb-1">Orders per Hour</p>
          <p className="text-xs text-slate-400 mb-4">Peak demand hours</p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={hourlyChart} barSize={13} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="orders" name="Orders" fill="#6366f1" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Item sales */}
      {itemSales.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card overflow-hidden xl:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100"><p className="text-sm font-bold text-slate-800">Top Selling Items</p></div>
            <table className="data-table">
              <thead><tr><th>#</th><th>Item</th><th className="text-right">Qty</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {itemSales.slice(0,10).map((item: any, i: number) => (
                  <tr key={item.itemId}>
                    <td className="text-slate-400 font-bold w-8">{i+1}</td>
                    <td className="font-mono text-xs text-slate-600">{item.itemId.slice(-8)}</td>
                    <td className="text-right font-bold text-slate-900">{item._sum?.quantity || 0}</td>
                    <td className="text-right font-bold text-brand-800">₹{Number(item._sum?.totalPrice || 0).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-5">
            <p className="text-sm font-bold text-slate-800 mb-4">Sales Split</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={itemSales.slice(0,6).map((it: any) => ({ name: `…${it.itemId.slice(-4)}`, value: Number(it._sum?.quantity || 0) }))} cx="50%" cy="50%" outerRadius={72} dataKey="value" label={({ percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {itemSales.slice(0,6).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} units`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </>}

      {/* ── GST tab ──────────────────────────────────────────── */}
      {tab === 'gst' && <GstTab outletId={outletId} from={from} to={to} />}

      {/* ── Categories tab ──────────────────────────────────── */}
      {tab === 'category' && <CategoryTab outletId={outletId} from={from} to={to} />}

      {/* ── Customers tab ───────────────────────────────────── */}
      {tab === 'customers' && <CustomersTab outletId={outletId} from={from} to={to} />}

      {/* ── Discounts tab ───────────────────────────────────── */}
      {tab === 'discounts' && <DiscountsTab outletId={outletId} from={from} to={to} />}
    </div>
  );
}
