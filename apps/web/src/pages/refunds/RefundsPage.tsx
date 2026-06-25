import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  RotateCcw, CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw, Loader2,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  INITIATED:  { label: 'Awaiting approval', bg: 'bg-amber-50',  text: 'text-amber-800',   icon: Clock },
  APPROVED:   { label: 'Approved',          bg: 'bg-sky-50',    text: 'text-sky-800',     icon: CheckCircle2 },
  PROCESSING: { label: 'Processing',        bg: 'bg-indigo-50', text: 'text-indigo-800',  icon: Loader2 },
  COMPLETED:  { label: 'Completed',         bg: 'bg-emerald-50',text: 'text-emerald-800', icon: CheckCircle2 },
  FAILED:     { label: 'Failed',            bg: 'bg-rose-50',   text: 'text-rose-800',    icon: AlertCircle },
  CANCELLED:  { label: 'Cancelled',         bg: 'bg-slate-50',  text: 'text-slate-600',   icon: XCircle },
};

const FILTERS = ['ACTIVE', 'INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
type FilterValue = typeof FILTERS[number];

export default function RefundsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier, can } = useUserRole();
  const outletId = user?.outletId || '';
  // Approval right is tied to the same responsibility as cancellation —
  // both are money-out actions a manager needs to authorise. Refine
  // later if you split into a dedicated REFUND_APPROVE perm.
  const canApprove = tier === 'outlet' || tier === 'business' || can.cancelOrder;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('ACTIVE');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/refunds`);
      setRows(data?.data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [outletId]);
  useEffect(() => { refresh(); }, [refresh]);

  const approve = async (id: string) => {
    setActingOn(id);
    try {
      await api.post(`/outlets/${outletId}/refunds/${id}/approve`, {});
      toast.success('Refund approved');
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Approve failed');
    } finally {
      setActingOn(null);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this refund? The customer will not be paid back.')) return;
    setActingOn(id);
    try {
      await api.post(`/outlets/${outletId}/refunds/${id}/cancel`, {});
      toast.success('Refund cancelled');
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Cancel failed');
    } finally {
      setActingOn(null);
    }
  };

  if (!outletId) {
    return <div className="p-8 text-sm text-slate-500">Refunds are scoped per outlet. Your account isn't tied to one.</div>;
  }

  const visible = rows.filter((r) =>
    filter === 'ACTIVE'
      ? ['INITIATED', 'APPROVED', 'PROCESSING'].includes(r.status)
      : r.status === filter,
  );

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-rose-700" /> Refunds
          </h1>
          <p className="text-xs text-slate-500">
            Initiated refunds awaiting approval, plus the full history of completed and failed refunds.
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors',
              filter === f
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
            )}
          >
            {f === 'ACTIVE'
              ? 'Active'
              : STATUS_BADGE[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            No refunds in this view.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left  font-semibold px-4 py-2.5">Order</th>
                <th className="text-left  font-semibold px-4 py-2.5 hidden md:table-cell">Initiated</th>
                <th className="text-right font-semibold px-4 py-2.5">Amount</th>
                <th className="text-left  font-semibold px-4 py-2.5">Mode</th>
                <th className="text-left  font-semibold px-4 py-2.5">Status</th>
                <th className="text-left  font-semibold px-4 py-2.5 hidden lg:table-cell">Reason</th>
                <th className="text-right font-semibold px-4 py-2.5 w-[220px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.INITIATED;
                const Icon = badge.icon;
                const isInitiated = r.status === 'INITIATED';
                const canCancel = ['INITIATED', 'APPROVED'].includes(r.status);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[11px] font-semibold text-slate-900">
                        {r.order?.orderNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        of ₹{Number(r.order?.totalAmount ?? 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">
                      <div>{new Date(r.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</div>
                      <div className="text-[10px] text-slate-400">by {r.initiatedBy?.name ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                      ₹{Number(r.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{r.mode}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', badge.bg, badge.text)}>
                        <Icon size={10} className={r.status === 'PROCESSING' ? 'animate-spin' : ''} />
                        {badge.label.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell max-w-[240px] truncate">
                      {r.reason || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isInitiated && canApprove && (
                          <button
                            onClick={() => approve(r.id)}
                            disabled={actingOn === r.id}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => cancel(r.id)}
                            disabled={actingOn === r.id}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={12} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Cash refunds settle at the cashier's drawer on approval. Gateway (UPI/Card) refunds fire Razorpay's
        refund API and complete asynchronously via webhook — typically a few seconds for "optimum" speed, longer
        for "normal" speed instruments.
      </p>
    </div>
  );
}
