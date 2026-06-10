import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api from '../../../services/api';
import { downloadCsv, rowsToCsv } from '../../../utils/csvExport';

type CategoryRow = {
  categoryId: string; categoryName: string;
  quantity: number; revenue: number;
  subcategories: Array<{ id: string; name: string; quantity: number; revenue: number }>;
};

/**
 * Category-level sales tab — two-level expand: category → subcategory.
 * Helps operators see whether revenue concentration is healthy
 * (top-heavy by category is often a sign to refresh the menu).
 */
export default function CategoryTab({ outletId, from, to }: { outletId: string; from: string; to: string }) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!outletId) return;
    setLoading(true);
    api.get(`/reports/category-sales?outletId=${outletId}&from=${from}&to=${to}`)
      .then((r) => setRows(r.data.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    // Flatten the tree: one row per (category, subcategory) pair plus a
    // category-only row at the top.
    const flat: Record<string, string | number>[] = [];
    for (const c of rows) {
      flat.push({ Category: c.categoryName, Subcategory: '— total —', Quantity: c.quantity, Revenue: c.revenue });
      for (const s of c.subcategories) {
        flat.push({ Category: c.categoryName, Subcategory: s.name, Quantity: s.quantity, Revenue: s.revenue });
      }
    }
    downloadCsv(`category-sales-${from}-to-${to}.csv`, rowsToCsv(flat));
  };

  const totalRevenue = rows.reduce((s, c) => s + c.revenue, 0);
  const totalQty     = rows.reduce((s, c) => s + c.quantity, 0);

  if (loading) return <div className="card h-40 animate-pulse" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-2xl font-black text-slate-900 tabular-nums">{rows.length}</p>
          <p className="text-xs text-slate-500 mt-1">Categories sold from</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-black text-slate-900 tabular-nums">{totalQty.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-1">Items sold</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Revenue from these items</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Sales by category</p>
            <p className="text-xs text-slate-400">Click a row to expand its subcategories.</p>
          </div>
          <button className="btn-secondary text-xs" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={13} /> CSV
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 italic px-5 py-8 text-center">No sales in this range.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">% of total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const open = expanded.has(c.categoryId);
                const pct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
                return (
                  <>
                    <tr
                      key={c.categoryId}
                      onClick={() => toggle(c.categoryId)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="font-bold text-slate-900">
                        <span className="inline-block w-3 text-slate-400">{open ? '▾' : '▸'}</span> {c.categoryName}
                      </td>
                      <td className="text-right tabular-nums">{c.quantity.toLocaleString('en-IN')}</td>
                      <td className="text-right tabular-nums font-bold">₹{c.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="text-right tabular-nums text-slate-500">{pct.toFixed(1)}%</td>
                    </tr>
                    {open && c.subcategories.map((s) => (
                      <tr key={s.id} className="bg-slate-50">
                        <td className="text-slate-600 pl-10">{s.name}</td>
                        <td className="text-right tabular-nums">{s.quantity.toLocaleString('en-IN')}</td>
                        <td className="text-right tabular-nums">₹{s.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="text-right tabular-nums text-slate-500">{totalRevenue > 0 ? ((s.revenue / totalRevenue) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
