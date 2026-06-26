import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { useUserRole } from '../../hooks/useUserRole';

// Row shape returned by GET /outlets/:outletId/dues/receivable.
type ReceivableRow = {
  userId: string;
  name: string | null;
  phone: string | null;
  tag: { id: string; name: string; color: string; allowPayLater: boolean; maxDueAmount: number | null } | null;
  currentBalance: number;
  ordersInRangeTotal: number;
  settlementsInRangeTotal: number;
};

type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'RAZORPAY' | 'OTHER';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function DuesReceivablePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';
  const { can, tier } = useUserRole();

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);

  // Two independent date windows — see backend §receivable. Default
  // to the current calendar month so the table isn't empty on first
  // load.
  const firstOfMonth = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);
  const today = useMemo(() => new Date(), []);

  const [ordersFrom,      setOrdersFrom]      = useState(isoDate(firstOfMonth));
  const [ordersTo,        setOrdersTo]        = useState(isoDate(today));
  const [settlementsFrom, setSettlementsFrom] = useState(isoDate(firstOfMonth));
  const [settlementsTo,   setSettlementsTo]   = useState(isoDate(today));

  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Settle modal state.
  const [settleTarget, setSettleTarget] = useState<ReceivableRow | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState<PaymentMode>('CASH');
  const [settleReference, setSettleReference] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settling, setSettling] = useState(false);

  // Load outlet list — outlet-tier admins are pinned to their own.
  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then(({ data }) => {
        const list = data.data || [];
        setOutlets(list);
        if (!outletId && list.length) setOutletId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const fetchRows = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/dues/receivable`, {
        params: {
          ordersFrom, ordersTo, settlementsFrom, settlementsTo,
        },
      });
      setRows(data.data || data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load receivables');
    } finally {
      setLoading(false);
    }
  }, [outletId, ordersFrom, ordersTo, settlementsFrom, settlementsTo]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.currentBalance         += r.currentBalance;
        acc.ordersInRangeTotal     += r.ordersInRangeTotal;
        acc.settlementsInRangeTotal+= r.settlementsInRangeTotal;
        return acc;
      },
      { currentBalance: 0, ordersInRangeTotal: 0, settlementsInRangeTotal: 0 },
    );
  }, [rows]);

  const openSettle = (r: ReceivableRow) => {
    setSettleTarget(r);
    // Pre-fill with the full outstanding balance — most common case
    // is a clean settle, so save the admin a keystroke.
    setSettleAmount(r.currentBalance.toFixed(2));
    setSettleMode('CASH');
    setSettleReference('');
    setSettleNotes('');
  };

  const submitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    const amount = Number(settleAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > settleTarget.currentBalance + 0.01) {
      toast.error(`Amount exceeds outstanding balance (₹${settleTarget.currentBalance.toFixed(2)})`);
      return;
    }
    setSettling(true);
    try {
      await api.post(`/outlets/${outletId}/dues/settle`, {
        userId: settleTarget.userId,
        amount,
        paymentMode: settleMode,
        reference: settleReference.trim() || undefined,
        notes: settleNotes.trim() || undefined,
      });
      toast.success('Dues settled');
      setSettleTarget(null);
      fetchRows();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to settle');
    } finally {
      setSettling(false);
    }
  };

  const isMultiOutlet = tier !== 'outlet' && outlets.length > 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dues — Receivable</h1>
          <p className="page-subtitle">Customers carrying outstanding pay-later balances.</p>
        </div>
        {isMultiOutlet && (
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="input py-2 px-3 text-sm font-medium min-w-[180px]"
          >
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      {/* Period filters — two independent windows. */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Orders in range</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><input type="date" className="input" value={ordersFrom} onChange={(e) => setOrdersFrom(e.target.value)} /></Field>
            <Field label="To">  <input type="date" className="input" value={ordersTo}   onChange={(e) => setOrdersTo(e.target.value)}   /></Field>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Settlements in range</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><input type="date" className="input" value={settlementsFrom} onChange={(e) => setSettlementsFrom(e.target.value)} /></Field>
            <Field label="To">  <input type="date" className="input" value={settlementsTo}   onChange={(e) => setSettlementsTo(e.target.value)}   /></Field>
          </div>
        </div>
      </div>

      {/* Summary row. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Total outstanding" amount={totals.currentBalance} hint="Live balance, ignores date filters" />
        <SummaryCard label="Charged in range"  amount={totals.ordersInRangeTotal} hint="Sum of pay-later orders in the orders window" />
        <SummaryCard label="Collected in range" amount={totals.settlementsInRangeTotal} hint="Sum of settlements in the settlements window" tone="emerald" />
      </div>

      {/* Table. */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No customers with pay-later activity at this outlet yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left  px-4 py-2">Customer</th>
                <th className="text-left  px-4 py-2">Tag</th>
                <th className="text-right px-4 py-2">Outstanding</th>
                <th className="text-right px-4 py-2">Charged (range)</th>
                <th className="text-right px-4 py-2">Collected (range)</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-slate-800">{r.name || '—'}</div>
                    <div className="text-xs text-slate-500 font-mono">{r.phone || ''}</div>
                  </td>
                  <td className="px-4 py-2">
                    {r.tag ? (
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                        style={{ backgroundColor: r.tag.color }}
                      >
                        {r.tag.name}
                        {r.tag.maxDueAmount != null ? ` · cap ₹${r.tag.maxDueAmount}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-bold">
                    {r.currentBalance > 0 ? (
                      <span className="text-rose-700">₹{r.currentBalance.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">₹{r.ordersInRangeTotal.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">₹{r.settlementsInRangeTotal.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">
                    {can.settleCustomerDues ? (
                      <button
                        className="btn-primary !py-1 !px-2.5 text-xs disabled:opacity-50"
                        disabled={r.currentBalance <= 0}
                        onClick={() => openSettle(r)}
                      >
                        Settle
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">No permission</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Settle dialog. */}
      <Modal
        open={!!settleTarget}
        onClose={() => setSettleTarget(null)}
        title={`Settle dues — ${settleTarget?.name || ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSettleTarget(null)}>Cancel</button>
            <button form="settle-form" type="submit" className="btn-primary" disabled={settling}>
              {settling ? 'Saving…' : 'Record settlement'}
            </button>
          </>
        }
      >
        {settleTarget && (
          <form id="settle-form" onSubmit={submitSettle} className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Outstanding balance: <span className="font-bold">₹{settleTarget.currentBalance.toFixed(2)}</span>
            </div>
            <Field label="Amount (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Partial settle is allowed; you can't enter more than the outstanding balance.
              </p>
            </Field>
            <Field label="Payment mode">
              <select
                className="input"
                value={settleMode}
                onChange={(e) => setSettleMode(e.target.value as PaymentMode)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="RAZORPAY">Razorpay</option>
                <option value="OTHER">Other settlement (e.g. salary deduction)</option>
              </select>
            </Field>
            <Field label={`Reference (optional, ${settleMode === 'UPI' ? 'UPI txn id' : settleMode === 'RAZORPAY' ? 'Razorpay payment id' : 'memo'})`}>
              <input
                type="text"
                className="input"
                value={settleReference}
                onChange={(e) => setSettleReference(e.target.value)}
              />
            </Field>
            <Field label="Notes (optional)">
              <textarea
                className="input min-h-[60px]"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
              />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({ label, amount, hint, tone = 'slate' }: { label: string; amount: number; hint?: string; tone?: 'slate' | 'emerald' }) {
  const colour = tone === 'emerald' ? 'text-emerald-700' : 'text-slate-800';
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colour}`}>₹{amount.toFixed(2)}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
