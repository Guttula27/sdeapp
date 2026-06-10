import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Download, Percent, IndianRupee, ShoppingBag } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { downloadCsv, rowsToCsv } from '../../../utils/csvExport';

type GstReport = {
  total: {
    subtotal: number; cgst: number; sgst: number; igst: number;
    totalTax: number; discount: number; grandTotal: number; orders: number;
  };
  byRate: Array<{ rate: number; taxable: number; cgst: number; sgst: number; totalTax: number }>;
  dailyTotals: Array<{ date: string; subtotal: number; tax: number; total: number; orders: number }>;
};

/**
 * GST tab: headline cards + per-rate slab table (the format an accountant
 * needs for GSTR-1) + daily time series. Exports the per-rate table and
 * the daily series as two separate CSVs.
 */
export default function GstTab({ outletId, from, to }: { outletId: string; from: string; to: string }) {
  const [report, setReport] = useState<GstReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!outletId) return;
    setLoading(true);
    api.get(`/reports/gst?outletId=${outletId}&from=${from}&to=${to}`)
      .then((r) => setReport(r.data.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const exportSlabCsv = () => {
    if (!report) return;
    const rows = report.byRate.map((b) => ({
      'GST Rate %': b.rate, 'Taxable Amount': b.taxable, CGST: b.cgst, SGST: b.sgst, 'Total Tax': b.totalTax,
    }));
    downloadCsv(`gst-by-rate-${from}-to-${to}.csv`, rowsToCsv(rows));
  };
  const exportDailyCsv = () => {
    if (!report) return;
    downloadCsv(`gst-daily-${from}-to-${to}.csv`, rowsToCsv(report.dailyTotals));
  };

  if (loading || !report) {
    return <div className="card h-40 animate-pulse" />;
  }

  const cards = [
    { label: 'Taxable (subtotal)', value: report.total.subtotal, icon: ShoppingBag, cls: 'icon-gradient-blue' },
    { label: 'CGST',               value: report.total.cgst,     icon: Percent,     cls: 'icon-gradient-orange' },
    { label: 'SGST',               value: report.total.sgst,     icon: Percent,     cls: 'icon-gradient-orange' },
    { label: 'IGST',               value: report.total.igst,     icon: Percent,     cls: 'icon-gradient-purple' },
    { label: 'Grand total',        value: report.total.grandTotal, icon: IndianRupee, cls: 'icon-gradient-green' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.cls}`}>
              <c.icon size={16} />
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums">
              ₹{Number(c.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Per-rate slab — the GSTR-1 input format. */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">By GST rate</p>
            <p className="text-xs text-slate-400">Required format for the GSTR-1 filing.</p>
          </div>
          <button className="btn-secondary text-xs" onClick={exportSlabCsv} disabled={report.byRate.length === 0}>
            <Download size={13} /> CSV
          </button>
        </div>
        {report.byRate.length === 0 ? (
          <p className="text-sm text-slate-400 italic px-5 py-8 text-center">No taxable sales in this range.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rate</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
                <th className="text-right">Total tax</th>
              </tr>
            </thead>
            <tbody>
              {report.byRate.map((b) => (
                <tr key={b.rate}>
                  <td className="font-bold text-slate-900">{b.rate}%</td>
                  <td className="text-right tabular-nums">₹{b.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right tabular-nums">₹{b.cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right tabular-nums">₹{b.sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="text-right tabular-nums font-bold text-slate-900">₹{b.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily totals chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Daily totals</p>
            <p className="text-xs text-slate-400">{report.dailyTotals.length} day{report.dailyTotals.length !== 1 ? 's' : ''} in range</p>
          </div>
          <button className="btn-secondary text-xs" onClick={exportDailyCsv} disabled={report.dailyTotals.length === 0}>
            <Download size={13} /> CSV
          </button>
        </div>
        {report.dailyTotals.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">Nothing to chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={report.dailyTotals.map((d) => ({ ...d, date: dayjs(d.date).format('D MMM') }))}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip formatter={(v: number) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
              <Line type="monotone" dataKey="total" name="Grand total" stroke="#0B4245" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="tax"   name="Tax"         stroke="#f59e0b" strokeWidth={2}   dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
