import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  Wallet, ChevronRight, RefreshCw, FileText, Lock, Unlock,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

/**
 * Cashier shift + Z report UI.
 *
 * Layout:
 *   • "My Drawer" card — every cashier. Open / close their own
 *     drawer; view their Z report.
 *   • "Outlet Shift" card — outlet admins. Sees the envelope state,
 *     every cashier shift inside it, and closes the envelope at end
 *     of day. Z report at this level sums every cashier underneath.
 */
export default function ShiftsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const outletId = user?.outletId || '';

  const [myShift, setMyShift] = useState<any>(null);
  const [outletShift, setOutletShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [openMyOpen, setOpenMyOpen] = useState(false);
  const [closeMyOpen, setCloseMyOpen] = useState(false);
  const [closeOutletOpen, setCloseOutletOpen] = useState(false);
  const [zReport, setZReport] = useState<any>(null);
  const [zScope, setZScope] = useState<'cashier' | 'outlet' | null>(null);

  // Form state for open / close
  const [openingFloat, setOpeningFloat] = useState('0');
  const [openNote, setOpenNote] = useState('');
  const [declaredCash, setDeclaredCash] = useState('0');
  const [closeNote, setCloseNote] = useState('');
  const [closeOutletNote, setCloseOutletNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [mineRes, outletRes] = await Promise.all([
        api.get(`/outlets/${outletId}/shifts/cashier/mine`).catch(() => null),
        api.get(`/outlets/${outletId}/shifts/outlet/active`).catch(() => null),
      ]);
      setMyShift(mineRes?.data?.data ?? null);
      setOutletShift(outletRes?.data?.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [outletId]);
  useEffect(() => { refresh(); }, [refresh]);

  const openMyDrawer = async () => {
    setSubmitting(true);
    try {
      await api.post(`/outlets/${outletId}/shifts/cashier/open`, {
        openingFloat: Number(openingFloat) || 0,
        note: openNote || undefined,
      });
      toast.success('Drawer opened');
      setOpenMyOpen(false);
      setOpeningFloat('0');
      setOpenNote('');
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not open drawer');
    } finally {
      setSubmitting(false);
    }
  };

  const closeMyDrawer = async () => {
    if (!myShift) return;
    setSubmitting(true);
    try {
      await api.post(`/outlets/${outletId}/shifts/cashier/${myShift.id}/close`, {
        declaredCash: Number(declaredCash) || 0,
        closeNote: closeNote || undefined,
      });
      toast.success('Drawer closed');
      setCloseMyOpen(false);
      setDeclaredCash('0');
      setCloseNote('');
      // Auto-open the Z report so the cashier can review / print before walking away.
      await openCashierZReport(myShift.id);
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not close drawer');
    } finally {
      setSubmitting(false);
    }
  };

  const closeOutletShift = async () => {
    if (!outletShift) return;
    setSubmitting(true);
    try {
      await api.post(`/outlets/${outletId}/shifts/outlet/${outletShift.id}/close`, {
        closeNote: closeOutletNote || undefined,
      });
      toast.success('Outlet shift closed');
      setCloseOutletOpen(false);
      setCloseOutletNote('');
      await openOutletZReport(outletShift.id);
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not close outlet shift');
    } finally {
      setSubmitting(false);
    }
  };

  const openCashierZReport = async (id: string) => {
    try {
      const { data } = await api.get(`/outlets/${outletId}/shifts/cashier/${id}/z-report`);
      setZReport(data.data);
      setZScope('cashier');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load Z report');
    }
  };
  const openOutletZReport = async (id: string) => {
    try {
      const { data } = await api.get(`/outlets/${outletId}/shifts/outlet/${id}/z-report`);
      setZReport(data.data);
      setZScope('outlet');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load Z report');
    }
  };

  const canManageOutletShift = tier === 'outlet' || tier === 'business';

  if (!outletId) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Cashier shifts live per outlet. Your account isn't tied to one.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cashier shifts</h1>
          <p className="text-xs text-slate-500">
            Open your drawer at the start of the shift, close at end of day, print the Z report for reconciliation.
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      {/* My drawer card */}
      <div className="card">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700">
            <Wallet size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm">My drawer</p>
            <p className="text-[11px] text-slate-500">
              {loading
                ? 'Loading…'
                : myShift
                  ? `Open since ${new Date(myShift.openedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`
                  : 'No active drawer — open one to start taking payments.'}
            </p>
          </div>
          {myShift ? (
            <>
              <button className="btn-secondary text-xs" onClick={() => openCashierZReport(myShift.id)}>
                <FileText size={12} /> Z report
              </button>
              <button
                className="btn-danger text-xs"
                onClick={() => { setDeclaredCash('0'); setCloseMyOpen(true); }}
              >
                <Lock size={12} /> Close drawer
              </button>
            </>
          ) : (
            <button className="btn-primary text-xs" onClick={() => setOpenMyOpen(true)}>
              <Unlock size={12} /> Open drawer
            </button>
          )}
        </div>
        {myShift && (
          <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <KV label="Opening float" value={`₹${Number(myShift.openingFloat).toFixed(2)}`} />
            <KV label="Opened by" value={user?.name ?? '—'} />
            {myShift.openNote && <KV label="Note" value={myShift.openNote} />}
          </div>
        )}
      </div>

      {/* Outlet shift card — only for admins */}
      {canManageOutletShift && (
        <div className="card">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <ChevronRight size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm">Outlet shift envelope</p>
              <p className="text-[11px] text-slate-500">
                {loading
                  ? 'Loading…'
                  : outletShift
                    ? `Active since ${new Date(outletShift.openedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`
                    : 'No outlet shift open. Will auto-create when the first cashier opens their drawer.'}
              </p>
            </div>
            {outletShift && (
              <>
                <button className="btn-secondary text-xs" onClick={() => openOutletZReport(outletShift.id)}>
                  <FileText size={12} /> Outlet Z report
                </button>
                <button
                  className="btn-danger text-xs"
                  onClick={() => { setCloseOutletNote(''); setCloseOutletOpen(true); }}
                >
                  <Lock size={12} /> Close outlet shift
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Open my drawer modal */}
      <Modal
        open={openMyOpen}
        onClose={() => setOpenMyOpen(false)}
        title="Open my drawer"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setOpenMyOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={openMyDrawer} disabled={submitting}>
              <Unlock size={14} /> Open drawer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600">Opening float (cash in drawer)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Note (optional)</label>
            <input
              type="text"
              value={openNote}
              onChange={(e) => setOpenNote(e.target.value)}
              placeholder="e.g. morning shift"
              className="input mt-1"
            />
          </div>
        </div>
      </Modal>

      {/* Close my drawer modal */}
      <Modal
        open={closeMyOpen}
        onClose={() => setCloseMyOpen(false)}
        title="Close my drawer"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setCloseMyOpen(false)}>Cancel</button>
            <button className="btn-danger" onClick={closeMyDrawer} disabled={submitting}>
              <Lock size={14} /> Close drawer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Count the cash in your drawer and enter the amount below. The Z report
            will compare it against the expected cash from card/UPI/cash payments
            stamped against this shift and show the variance.
          </p>
          <div>
            <label className="text-xs font-bold text-slate-600">Declared cash (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={declaredCash}
              onChange={(e) => setDeclaredCash(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Close note (optional)</label>
            <input
              type="text"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="e.g. variance because of refund missed"
              className="input mt-1"
            />
          </div>
        </div>
      </Modal>

      {/* Close outlet shift modal */}
      <Modal
        open={closeOutletOpen}
        onClose={() => setCloseOutletOpen(false)}
        title="Close outlet shift"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setCloseOutletOpen(false)}>Cancel</button>
            <button className="btn-danger" onClick={closeOutletShift} disabled={submitting}>
              <Lock size={14} /> Close outlet shift
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            Closing the outlet shift ends the day's envelope. Any cashier drawers
            still open will be auto-closed (no declared cash; variance left blank
            for the operator to reconcile from the per-cashier Z report later).
          </p>
          <p>
            Mid-flight orders are NOT blocked — they keep their existing shift tag
            but any payments collected after this point land on whatever shift is
            active at the time.
          </p>
          <div>
            <label className="text-xs font-bold text-slate-600">Close note (optional)</label>
            <input
              type="text"
              value={closeOutletNote}
              onChange={(e) => setCloseOutletNote(e.target.value)}
              className="input mt-1"
            />
          </div>
        </div>
      </Modal>

      {/* Z report viewer modal */}
      <Modal
        open={!!zReport}
        onClose={() => { setZReport(null); setZScope(null); }}
        title={zScope === 'outlet' ? 'Outlet Z report' : 'Cashier Z report'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              className="btn-secondary"
              onClick={() => { if (zReport) window.print(); }}
            >
              <FileText size={14} /> Print
            </button>
            <button className="btn-primary" onClick={() => { setZReport(null); setZScope(null); }}>
              Close
            </button>
          </div>
        }
      >
        {zReport && (zScope === 'cashier'
          ? <CashierZ report={zReport} />
          : <OutletZ report={zReport} />
        )}
      </Modal>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function Money({ value }: { value: any }) {
  const n = Number(value ?? 0);
  return <span className="tabular-nums">₹{n.toFixed(2)}</span>;
}

function CashierZ({ report }: { report: any }) {
  const { shift, paymentsByMode, refundsByMode, orderAggregates, cash } = report;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KV label="Cashier" value={shift.cashier?.name ?? '—'} />
        <KV label="Opened" value={new Date(shift.openedAt).toLocaleString('en-IN')} />
        <KV label="Closed" value={shift.closedAt ? new Date(shift.closedAt).toLocaleString('en-IN') : 'Active'} />
      </div>

      <Section title="Drawer reconciliation">
        <Row label="Opening float"><Money value={cash.openingFloat} /></Row>
        <Row label="Expected cash"><Money value={cash.expectedCash} /></Row>
        <Row label="Declared cash">{cash.declaredCash != null ? <Money value={cash.declaredCash} /> : <span className="text-slate-400">—</span>}</Row>
        <Row label="Variance">
          {cash.variance != null
            ? <span className={Number(cash.variance) === 0 ? 'text-emerald-700' : 'text-rose-700 font-semibold'}><Money value={cash.variance} /></span>
            : <span className="text-slate-400">—</span>}
        </Row>
      </Section>

      <Section title="Orders during shift">
        <Row label="Orders placed">{orderAggregates.ordersCount}</Row>
        <Row label="Cancelled">{orderAggregates.cancelledCount}</Row>
        <Row label="Subtotal"><Money value={orderAggregates.subtotal} /></Row>
        <Row label="Tax (SGST+CGST)"><Money value={orderAggregates.tax} /></Row>
        <Row label="Discounts"><Money value={orderAggregates.discounts} /></Row>
        <Row label="Total billed"><Money value={orderAggregates.total} /></Row>
      </Section>

      <Section title="Payments collected">
        {paymentsByMode.length === 0
          ? <p className="text-xs text-slate-400 px-3 py-2">No payments yet</p>
          : paymentsByMode.map((p: any) => (
              <Row key={p.mode} label={`${p.mode} · ${p.count} txn${p.count === 1 ? '' : 's'}`}>
                <Money value={p.amount} />
              </Row>
            ))}
      </Section>

      {refundsByMode.length > 0 && (
        <Section title="Refunds issued">
          {refundsByMode.map((p: any) => (
            <Row key={p.mode} label={`${p.mode} · ${p.count} txn${p.count === 1 ? '' : 's'}`}>
              <Money value={p.amount} />
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function OutletZ({ report }: { report: any }) {
  const { shift, cashierReports } = report;
  // Aggregate across cashier reports
  const total = cashierReports.reduce((s: number, c: any) => s + Number(c.orderAggregates.total ?? 0), 0);
  const totalCash = cashierReports.flatMap((c: any) => c.paymentsByMode)
    .filter((p: any) => p.mode === 'CASH').reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KV label="Opened" value={new Date(shift.openedAt).toLocaleString('en-IN')} />
        <KV label="Closed" value={shift.closedAt ? new Date(shift.closedAt).toLocaleString('en-IN') : 'Active'} />
        <KV label="Opened by" value={shift.openedBy?.name ?? '—'} />
      </div>

      <Section title="Outlet totals">
        <Row label="Cashiers"><span className="tabular-nums">{cashierReports.length}</span></Row>
        <Row label="Grand total billed"><Money value={total} /></Row>
        <Row label="Cash collected"><Money value={totalCash} /></Row>
      </Section>

      {cashierReports.map((cr: any) => (
        <div key={cr.shift.id} className="border border-slate-200 rounded-xl">
          <div className="px-3 py-2 bg-slate-50 rounded-t-xl text-xs font-bold text-slate-700">
            {cr.shift.cashier?.name ?? 'Cashier'} ·{' '}
            {new Date(cr.shift.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {cr.shift.closedAt ? ` → ${new Date(cr.shift.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' (still open)'}
          </div>
          <div className="px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KV label="Orders" value={String(cr.orderAggregates.ordersCount)} />
            <KV label="Total" value={`₹${Number(cr.orderAggregates.total).toFixed(2)}`} />
            <KV label="Expected cash" value={`₹${Number(cr.cash.expectedCash ?? 0).toFixed(2)}`} />
            <KV
              label="Variance"
              value={cr.cash.variance != null ? `₹${Number(cr.cash.variance).toFixed(2)}` : '—'}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-xl">
      <div className="px-3 py-2 bg-slate-50 rounded-t-xl text-[10px] uppercase tracking-wider font-bold text-slate-500">
        {title}
      </div>
      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{children}</span>
    </div>
  );
}
