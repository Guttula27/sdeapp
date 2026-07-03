import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ShoppingBag, TrendingUp, Clock, IndianRupee, ArrowUpRight,
  Users, ChefHat, Building2, Store, CreditCard, Gauge, Banknote, Smartphone, Wallet,
} from 'lucide-react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { addOrder, updateOrder } from '../../store/slices/ordersSlice';
import { useUserRole } from '../../hooks/useUserRole';

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-slate-500 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-bold" style={{ color: p.color }}>
          {p.dataKey === 'revenue' ? `₹${Number(p.value).toLocaleString('en-IN')}` : p.value}
          <span className="ml-1 font-normal text-slate-400">{p.name}</span>
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { tier, user } = useUserRole();

  const [data, setData]               = useState<any>(null);
  const [bizData, setBizData]         = useState<any>(null);
  const [platformData, setPlatformData] = useState<any>(null);
  const [hourly, setHourly]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  const outletId   = user?.outletId  || 'demo-outlet';
  const businessId = user?.businessId;
  const today      = new Date().toISOString().split('T')[0];

  /* ── data fetch (branches by tier) ──────────────────────── */
  useEffect(() => {
    setLoading(true);

    if (tier === 'platform') {
      Promise.all([
        api.get(`/reports/platform-summary?date=${today}`),
        api.get(`/reports/platform-hourly?date=${today}`),
      ])
        .then(([s, h]) => {
          setPlatformData(s.data.data);
          setHourly(h.data.data || []);
        })
        .catch(() => setPlatformData({
          totalBusinesses: 0, activeBusinesses: 0, totalOutlets: 0,
          todayOrders: 0, todayRevenue: 0, avgOrderValue: 0, activeOrders: 0,
          topOutlets: [],
        }))
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([
      api.get(`/outlets/${outletId}/dashboard`),
      api.get(`/reports/hourly?outletId=${outletId}&date=${today}`),
      businessId ? api.get(`/businesses/${businessId}/dashboard`) : Promise.resolve(null),
    ])
      .then(([d, h, b]) => {
        setData(d.data.data);
        setHourly(h.data.data || []);
        if (b) setBizData(b.data.data);
      })
      .catch(() => setData({ todayOrders: 0, activeOrders: 0, todayRevenue: 0, avgOrderValue: 0 }))
      .finally(() => setLoading(false));

    const socket = getSocket(outletId);
    socket.on('orderCreated',       (o: any) => { dispatch(addOrder(o)); setData((d: any) => d && ({ ...d, activeOrders: d.activeOrders + 1, todayOrders: d.todayOrders + 1 })); });
    socket.on('orderStatusUpdated', (o: any) => dispatch(updateOrder(o)));
    return () => { socket.off('orderCreated'); socket.off('orderStatusUpdated'); };
  }, [tier, outletId, businessId]);

  const Skel = () => <div className="skeleton h-8 w-24 rounded-lg" />;

  /* ── tier-specific stat cards ────────────────────────────── */
  const statCards = (() => {
    if (tier === 'platform') {
      return [
        { label: t('dashboard.statTotalOutlets'),   value: platformData?.totalOutlets ?? 0,      icon: Store,       iconCls: 'icon-gradient-blue',    trend: t('dashboard.trendBusinesses', { count: platformData?.totalBusinesses ?? 0 }) },
        { label: t('dashboard.statTodayOrders'),    value: platformData?.todayOrders ?? 0,        icon: ShoppingBag, iconCls: 'icon-gradient-orange',  trend: t('dashboard.trendToday') },
        { label: t('dashboard.statTodayCustomers'), value: platformData?.todayCustomers ?? 0,     icon: Users,       iconCls: 'icon-gradient-pink',    trend: t('dashboard.trendUnique') },
        { label: t('dashboard.statTodayRevenue'),   value: `₹${Number(platformData?.todayRevenue || 0).toLocaleString('en-IN')}`, icon: IndianRupee, iconCls: 'icon-gradient-green', trend: '' },
        { label: t('dashboard.statActiveOrders'),   value: platformData?.activeOrders ?? 0,       icon: Clock,       iconCls: 'icon-gradient-purple',  trend: t('dashboard.trendLive') },
      ];
    }
    if (tier === 'business') {
      return [
        { label: t('dashboard.statActiveOutlets'),  value: bizData?.activeOutlets ?? 0,           icon: Building2,   iconCls: 'icon-gradient-blue',    trend: '' },
        { label: t('dashboard.statTodayOrders'),    value: bizData?.todayOrders ?? 0,             icon: ShoppingBag, iconCls: 'icon-gradient-orange',  trend: t('dashboard.trendToday') },
        { label: t('dashboard.statTodayCustomers'), value: bizData?.todayCustomers ?? 0,          icon: Users,       iconCls: 'icon-gradient-pink',    trend: t('dashboard.trendUnique') },
        { label: t('dashboard.statTodayRevenue'),   value: `₹${Number(bizData?.todayRevenue || 0).toLocaleString('en-IN')}`, icon: IndianRupee, iconCls: 'icon-gradient-green', trend: '' },
        { label: t('dashboard.statAvgOrder'),       value: `₹${Number(data?.avgOrderValue || 0).toFixed(0)}`,         icon: TrendingUp,  iconCls: 'icon-gradient-purple',  trend: '' },
      ];
    }
    return [
      { label: t('dashboard.statTodayOrders'),    value: data?.todayOrders ?? 0,           icon: ShoppingBag, iconCls: 'icon-gradient-blue',   trend: t('dashboard.trendToday') },
      { label: t('dashboard.statTodayCustomers'), value: data?.todayCustomers ?? 0,        icon: Users,       iconCls: 'icon-gradient-pink',   trend: t('dashboard.trendUnique') },
      { label: t('dashboard.statActiveOrders'),   value: data?.activeOrders ?? 0,          icon: Clock,       iconCls: 'icon-gradient-orange', trend: t('dashboard.trendLive') },
      { label: t('dashboard.statTodayRevenue'),   value: data ? `₹${Number(data.todayRevenue).toLocaleString('en-IN')}` : '₹0', icon: IndianRupee, iconCls: 'icon-gradient-green', trend: '' },
      { label: t('dashboard.statAvgOrderValue'),  value: data ? `₹${Number(data.avgOrderValue).toFixed(0)}` : '₹0',            icon: TrendingUp,  iconCls: 'icon-gradient-purple', trend: '' },
    ];
  })();

  const hourlyForChart = hourly.map(h => ({
    ...h,
    hour: typeof h.hour === 'number' ? `${String(h.hour).padStart(2, '0')}:00` : h.hour,
  }));

  const pageTitle = {
    platform: t('dashboard.titlePlatform'),
    business: t('dashboard.titleBusiness'),
    counter:  t('dashboard.titleCounter'),
    outlet:   t('dashboard.titleOutlet'),
    kitchen:  t('dashboard.titleKitchen'),
    store:    t('dashboard.titleStore'),
  }[tier] ?? t('dashboard.titleDashboard');

  const liveCount = tier === 'platform' ? (platformData?.activeOrders ?? 0) : (data?.activeOrders ?? 0);

  /* ── tier-specific quick actions ─────────────────────────── */
  const quickActions = tier === 'platform' ? [
    { label: t('dashboard.qaPlatformOverview'),  href: '/platform',          iconCls: 'icon-gradient-blue',   icon: Gauge },
    { label: t('dashboard.qaBusinesses'),        href: '/businesses',        iconCls: 'icon-gradient-orange',  icon: Building2 },
    { label: t('dashboard.qaSubscriptionPlans'), href: '/subscriptions-mgmt',iconCls: 'icon-gradient-green',   icon: CreditCard },
    { label: t('dashboard.qaSettings'),          href: '/settings',          iconCls: 'icon-gradient-purple',  icon: Users },
  ] : [
    { label: t('dashboard.qaViewOrders'),   href: '/orders',    iconCls: 'icon-gradient-blue',   icon: ShoppingBag },
    { label: t('dashboard.qaKitchenBoard'), href: '/kitchen',   iconCls: 'icon-gradient-orange',  icon: ChefHat },
    { label: t('dashboard.qaMenuManager'),  href: '/menu',      iconCls: 'icon-gradient-green',   icon: TrendingUp },
    { label: t('dashboard.qaStaffReport'),  href: '/reports',   iconCls: 'icon-gradient-purple',  icon: Users },
  ];

  // Date locale mirrors the UI language when possible. Fallback to en-IN
  // so Indian users still see day/month grouping if the language bundle
  // doesn't fully map to a BCP-47 locale.
  const dateLocale = i18n.language?.startsWith('en') ? 'en-IN' : (i18n.language || 'en-IN');

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            {new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="page-title">{pageTitle}</h1>
        </div>
        {liveCount > 0 && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-900 px-4 py-2 rounded-xl text-sm font-semibold">
            <span className="dot-live" style={{ background: '#0B4245', boxShadow: '0 0 0 0 rgb(249 115 22 / .4)' }} />
            {t('dashboard.liveOrders', { count: liveCount })}
          </div>
        )}
      </div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconCls}`}>
                <s.icon size={18} />
              </div>
              {s.trend && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {s.trend === t('dashboard.trendLive') ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 blink-fast" />{s.trend}</> : <><ArrowUpRight size={11} />{s.trend}</>}
                </span>
              )}
            </div>
            {loading ? <Skel /> : <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">{s.value}</p>}
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-bold text-slate-800">{t('dashboard.revenueTrendTitle')}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {tier === 'platform' ? t('dashboard.revenueTrendPlatform') : t('dashboard.revenueTrendOutlet')}
              </p>
            </div>
            <span className="badge badge-orange">{t('dashboard.hourlyBadge')}</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyForChart} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0B4245" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0B4245" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={h => h.slice(0,2)} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name={t('dashboard.chartSeriesRevenue')} stroke="#0B4245" fill="url(#revGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#0B4245', strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="mb-5">
            <p className="text-sm font-bold text-slate-800">{t('dashboard.ordersByHourTitle')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.ordersByHourSubtitle')}</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyForChart.filter((_, i) => i % 2 === 0)} barSize={12} margin={{ left: -25 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={h => h.slice(0,2)} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="orders" name={t('dashboard.chartSeriesOrders')} fill="#6366f1" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top outlets (platform only) ────────────────────── */}
      {tier === 'platform' && platformData?.topOutlets?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">{t('dashboard.topOutletsTitle')}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.topOutletsSubtitle')}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {platformData.topOutlets.map((o: any, i: number) => (
              <div key={o.outletId} className="px-5 py-3 flex items-center gap-4">
                <span className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 font-bold text-xs flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{o.outletName}</p>
                  {o.businessName && <p className="text-xs text-slate-400 truncate">{o.businessName}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">₹{Number(o.revenue).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-400">{t('dashboard.orderCount', { count: o.orders })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Payment split (Cash / UPI / Online) ─────────────── */}
      {tier !== 'platform' && data?.paymentSplit && (
        <div>
          <p className="section-title mb-3">{t('dashboard.collectionsTitle')}</p>
          {(() => {
            const ps = data.paymentSplit;
            const onlineAmount = Number((ps.CARD?.amount || 0) + (ps.WALLET?.amount || 0) + (ps.NET_BANKING?.amount || 0));
            const onlineCount  = Number((ps.CARD?.count || 0) + (ps.WALLET?.count || 0) + (ps.NET_BANKING?.count || 0));
            const tiles = [
              { label: t('dashboard.payCash'),   amount: Number(ps.CASH?.amount || 0), count: Number(ps.CASH?.count || 0), icon: Banknote,   cls: 'icon-gradient-green'  },
              { label: t('dashboard.payUpi'),    amount: Number(ps.UPI?.amount  || 0), count: Number(ps.UPI?.count  || 0), icon: Smartphone, cls: 'icon-gradient-blue'   },
              { label: t('dashboard.payOnline'), amount: onlineAmount,                  count: onlineCount,                 icon: Wallet,     cls: 'icon-gradient-purple' },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {tiles.map((tile) => (
                  <div key={tile.label} className="card p-5 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tile.cls} shrink-0`}>
                      <tile.icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500">{tile.label}</p>
                      <p className="text-xl font-black text-slate-900 tabular-nums tracking-tight">₹{tile.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[11px] text-slate-400">{t('dashboard.paymentCount', { count: tile.count })}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Quick actions ───────────────────────────────────── */}
      <div>
        <p className="section-title mb-3">{t('dashboard.quickActionsTitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ label, href, iconCls, icon: Icon }) => (
            <a key={label} href={href}
              className="card card-hover flex items-center gap-3 px-4 py-3.5 no-underline group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
                <Icon size={16} />
              </div>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
