import { useEffect, useState } from 'react';
import { Download, UserPlus, Repeat, Users } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../../services/api';
import { downloadCsv, rowsToCsv } from '../../../utils/csvExport';

type Customers = {
  topCustomers: Array<{
    id: string; name: string | null; phone: string | null;
    orders: number; spend: number; avgOrderValue: number;
  }>;
  totalUniqueCustomers: number;
  newCount: number;
  repeatCount: number;
  segments: { '0-500': number; '500-2000': number; '2000-10000': number; '10000+': number };
};

/**
 * Customer analytics tab — top spenders + new vs. repeat split +
 * lifetime-spend segments. The phone column is shown as the masked
 * last-4 to respect the encryption posture.
 */
export default function CustomersTab({ outletId, from, to }: { outletId: string; from: string; to: string }) {
  const [data, setData] = useState<Customers | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!outletId) return;
    setLoading(true);
    api.get(`/reports/customers?outletId=${outletId}&from=${from}&to=${to}`)
      .then((r) => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const exportCsv = () => {
    if (!data) return;
    const rows = data.topCustomers.map((c, i) => ({
      Rank: i + 1, Name: c.name ?? '—', Phone: maskedPhone(c.phone),
      Orders: c.orders, 'Total spend': c.spend, 'Avg order': c.avgOrderValue,
    }));
    downloadCsv(`top-customers-${from}-to-${to}.csv`, rowsToCsv(rows));
  };

  if (loading || !data) return <div className="card h-40 animate-pulse" />;

  const segmentBars = Object.entries(data.segments).map(([label, count]) => ({ label, count }));

  return (
    <div className="space-y-5">
      {/* Headline tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-blue">
            <Users size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{data.totalUniqueCustomers}</p>
          <p className="text-xs text-slate-500 mt-1">Unique customers in period</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-green">
            <UserPlus size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{data.newCount}</p>
          <p className="text-xs text-slate-500 mt-1">New (first order in range)</p>
        </div>
        <div className="card p-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 icon-gradient-purple">
            <Repeat size={16} />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{data.repeatCount}</p>
          <p className="text-xs text-slate-500 mt-1">Repeat (first order before range)</p>
        </div>
      </div>

      {/* Lifetime segments */}
      <div className="card p-5">
        <p className="text-sm font-bold text-slate-800 mb-1">Lifetime spend at this outlet</p>
        <p className="text-xs text-slate-400 mb-4">
          Bucketing every customer who ordered in this range by total spend across their lifetime.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={segmentBars} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => `${v} customer${v === 1 ? '' : 's'}`} />
            <Bar dataKey="count" name="Customers" fill="#6366f1" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top customers */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Top customers by spend</p>
            <p className="text-xs text-slate-400">Top 20 from this range — phone masked to the last 4 digits.</p>
          </div>
          <button className="btn-secondary text-xs" onClick={exportCsv} disabled={data.topCustomers.length === 0}>
            <Download size={13} /> CSV
          </button>
        </div>
        {data.topCustomers.length === 0 ? (
          <p className="text-sm text-slate-400 italic px-5 py-8 text-center">No customers in this range.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Avg order</th>
              </tr>
            </thead>
            <tbody>
              {data.topCustomers.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-slate-400 font-bold w-8">{i + 1}</td>
                  <td className="font-semibold text-slate-900">{c.name || <span className="italic text-slate-400">Guest</span>}</td>
                  <td className="font-mono text-xs text-slate-500">{maskedPhone(c.phone)}</td>
                  <td className="text-right tabular-nums">{c.orders}</td>
                  <td className="text-right tabular-nums font-bold">₹{c.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="text-right tabular-nums">₹{c.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function maskedPhone(p?: string | null): string {
  if (!p) return '—';
  const last4 = p.slice(-4);
  return `*** ${last4}`;
}
