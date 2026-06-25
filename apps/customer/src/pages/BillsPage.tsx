import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, CheckCircle2, Clock, XCircle, ChevronRight,
} from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

/**
 * "My Bills" — every split-bill share assigned to the auth'd
 * customer's phone, newest first. Tap a row → /bills/:shareId to
 * pay or see status.
 */
export default function BillsPage() {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/me/split-shares')
      .then((r) => setRows(r.data?.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Receipt size={18} className="text-brand-700" /> My bills
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Shared bills sent to your number. Tap to view and pay.
        </p>
      </header>

      <main className="p-4 space-y-2">
        {loading ? (
          <div className="text-center text-xs text-slate-400 py-12">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-600 font-semibold">No bills yet</p>
            <p className="text-xs text-slate-400 mt-1">
              When someone splits a bill with you, it shows up here.
            </p>
          </div>
        ) : rows.map((row) => {
          const order = row.order;
          const isPaid = row.status === 'PAID';
          const isCancelled = row.status === 'CANCELLED' || row.status === 'EXPIRED';
          const StatusIcon = isPaid ? CheckCircle2 : isCancelled ? XCircle : Clock;
          const statusClass = isPaid
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : isCancelled
              ? 'bg-slate-100 text-slate-500 border-slate-200'
              : 'bg-amber-50 text-amber-800 border-amber-200';
          return (
            <button
              key={row.id}
              onClick={() => navigate(`/bills/${row.id}`)}
              className="w-full bg-white rounded-xl border border-slate-200 px-3 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden">
                {order?.outlet?.logoUrl
                  ? <img src={order.outlet.logoUrl} alt="" className="w-full h-full object-cover" />
                  : <Receipt size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {order?.outlet?.name ?? 'Outlet'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Order {order?.orderNumber}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  ₹{Number(row.amount).toFixed(2)}
                </span>
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${statusClass}`}>
                  <StatusIcon size={9} />
                  {row.status}
                </span>
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          );
        })}
      </main>
    </div>
  );
}
