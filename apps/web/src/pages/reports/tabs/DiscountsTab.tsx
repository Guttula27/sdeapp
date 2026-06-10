import { useEffect, useState } from 'react';
import { Download, Ticket, Gift, Tag, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import api from '../../../services/api';
import { downloadCsv, rowsToCsv } from '../../../utils/csvExport';

type Discounts = {
  totals: {
    servedOrders: number;
    servedRevenue: number;
    totalDiscount: number;
    couponDiscount: number;
    rewardDiscount: number;
    rewardPoints: number;
    autoDiscount: number;
    discountPctOfRevenue: number;
  };
  coupons: Array<{ code: string; name: string; count: number; amount: number }>;
};

/**
 * Discount utilization tab — shows how much money the outlet gave
 * back as discounts and where it went (coupons, rewards, auto rules).
 * Headline tile makes it easy to spot when the % of revenue spent
 * on concessions is climbing.
 */
export default function DiscountsTab({ outletId, from, to }: { outletId: string; from: string; to: string }) {
  const [data, setData] = useState<Discounts | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!outletId) return;
    setLoading(true);
    api.get(`/reports/discounts?outletId=${outletId}&from=${from}&to=${to}`)
      .then((r) => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`coupons-${from}-to-${to}.csv`, rowsToCsv(data.coupons));
  };

  if (loading || !data) return <div className="card h-40 animate-pulse" />;
  const t = data.totals;

  const pieData = [
    { name: 'Coupon',    value: t.couponDiscount, color: '#6366f1' },
    { name: 'Reward',    value: t.rewardDiscount, color: '#10b981' },
    { name: 'Auto rule', value: t.autoDiscount,   color: '#f59e0b' },
  ].filter((p) => p.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-blue">
            <Ticket size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{t.totalDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total discount given</p>
          <p className="text-[11px] text-slate-400 mt-1">{t.discountPctOfRevenue.toFixed(2)}% of revenue</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-purple">
            <Ticket size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{t.couponDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Coupon discount</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-green">
            <Gift size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{t.rewardDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Reward redemptions</p>
          <p className="text-[11px] text-slate-400 mt-1">{t.rewardPoints.toLocaleString('en-IN')} pts redeemed</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-orange">
            <Tag size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{t.autoDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Auto discount (bill / item)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-5 xl:col-span-1">
          <p className="text-sm font-bold text-slate-800 mb-1">Where the discount went</p>
          <p className="text-xs text-slate-400 mb-4">By source.</p>
          {pieData.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-8">No discounts given in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((p, i) => <Cell key={i} fill={p.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card overflow-hidden xl:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">Coupons</p>
              <p className="text-xs text-slate-400">Per-code redemption volume.</p>
            </div>
            <button className="btn-secondary text-xs" onClick={exportCsv} disabled={data.coupons.length === 0}>
              <Download size={13} /> CSV
            </button>
          </div>
          {data.coupons.length === 0 ? (
            <p className="text-sm text-slate-400 italic px-5 py-8 text-center inline-flex items-center justify-center gap-2">
              <PieIcon size={14} /> No coupons redeemed in this range.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th className="text-right">Uses</th>
                  <th className="text-right">Discount</th>
                </tr>
              </thead>
              <tbody>
                {data.coupons.map((c) => (
                  <tr key={c.code}>
                    <td className="font-mono text-xs font-semibold text-slate-900">{c.code}</td>
                    <td className="text-slate-700">{c.name}</td>
                    <td className="text-right tabular-nums">{c.count}</td>
                    <td className="text-right tabular-nums font-bold">₹{c.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
