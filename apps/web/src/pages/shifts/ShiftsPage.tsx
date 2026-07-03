import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      toast.success(t('shifts.toastDrawerOpened'));
      setOpenMyOpen(false);
      setOpeningFloat('0');
      setOpenNote('');
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('shifts.toastCouldNotOpenDrawer'));
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
      toast.success(t('shifts.toastDrawerClosed'));
      setCloseMyOpen(false);
      setDeclaredCash('0');
      setCloseNote('');
      // Auto-open the Z report so the cashier can review / print before walking away.
      await openCashierZReport(myShift.id);
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('shifts.toastCouldNotCloseDrawer'));
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
      toast.success(t('shifts.toastOutletClosed'));
      setCloseOutletOpen(false);
      setCloseOutletNote('');
      await openOutletZReport(outletShift.id);
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('shifts.toastCouldNotCloseOutlet'));
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
      toast.error(e?.response?.data?.message || t('shifts.toastZReportFail'));
    }
  };
  const openOutletZReport = async (id: string) => {
    try {
      const { data } = await api.get(`/outlets/${outletId}/shifts/outlet/${id}/z-report`);
      setZReport(data.data);
      setZScope('outlet');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('shifts.toastZReportFail'));
    }
  };

  const canManageOutletShift = tier === 'outlet' || tier === 'business';

  if (!outletId) {
    return (
      <div className="p-8 text-sm text-slate-500">
        {t('shifts.outletScopedNotice')}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('shifts.title')}</h1>
          <p className="text-xs text-slate-500">
            {t('shifts.subtitle')}
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          <RefreshCw size={12} /> {t('shifts.refresh')}
        </button>
      </header>

      {/* My drawer card */}
      <div className="card">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700">
            <Wallet size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm">{t('shifts.myDrawer')}</p>
            <p className="text-[11px] text-slate-500">
              {loading
                ? t('shifts.loading')
                : myShift
                  ? t('shifts.openSince', { when: new Date(myShift.openedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) })
                  : t('shifts.noActiveDrawer')}
            </p>
          </div>
          {myShift ? (
            <>
              <button className="btn-secondary text-xs" onClick={() => openCashierZReport(myShift.id)}>
                <FileText size={12} /> {t('shifts.zReport')}
              </button>
              <button
                className="btn-danger text-xs"
                onClick={() => { setDeclaredCash('0'); setCloseMyOpen(true); }}
              >
                <Lock size={12} /> {t('shifts.closeDrawer')}
              </button>
            </>
          ) : (
            <button className="btn-primary text-xs" onClick={() => setOpenMyOpen(true)}>
              <Unlock size={12} /> {t('shifts.openDrawer')}
            </button>
          )}
        </div>
        {myShift && (
          <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <KV label={t('shifts.kvOpeningFloat')} value={`₹${Number(myShift.openingFloat).toFixed(2)}`} />
            <KV label={t('shifts.kvOpenedBy')} value={user?.name ?? '—'} />
            {myShift.openNote && <KV label={t('shifts.kvNote')} value={myShift.openNote} />}
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
              <p className="font-bold text-slate-900 text-sm">{t('shifts.outletEnvelope')}</p>
              <p className="text-[11px] text-slate-500">
                {loading
                  ? t('shifts.loading')
                  : outletShift
                    ? t('shifts.outletActiveSince', { when: new Date(outletShift.openedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) })
                    : t('shifts.outletNoShift')}
              </p>
            </div>
            {outletShift && (
              <>
                <button className="btn-secondary text-xs" onClick={() => openOutletZReport(outletShift.id)}>
                  <FileText size={12} /> {t('shifts.outletZReport')}
                </button>
                <button
                  className="btn-danger text-xs"
                  onClick={() => { setCloseOutletNote(''); setCloseOutletOpen(true); }}
                >
                  <Lock size={12} /> {t('shifts.closeOutletShift')}
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
        title={t('shifts.modalOpenMyTitle')}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setOpenMyOpen(false)}>{t('shifts.cancel')}</button>
            <button className="btn-primary" onClick={openMyDrawer} disabled={submitting}>
              <Unlock size={14} /> {t('shifts.openDrawer')}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600">{t('shifts.openFloatLabel')}</label>
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
            <label className="text-xs font-bold text-slate-600">{t('shifts.noteOptional')}</label>
            <input
              type="text"
              value={openNote}
              onChange={(e) => setOpenNote(e.target.value)}
              placeholder={t('shifts.notePlaceholder')}
              className="input mt-1"
            />
          </div>
        </div>
      </Modal>

      {/* Close my drawer modal */}
      <Modal
        open={closeMyOpen}
        onClose={() => setCloseMyOpen(false)}
        title={t('shifts.modalCloseMyTitle')}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setCloseMyOpen(false)}>{t('shifts.cancel')}</button>
            <button className="btn-danger" onClick={closeMyDrawer} disabled={submitting}>
              <Lock size={14} /> {t('shifts.closeDrawer')}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {t('shifts.closeMyHint')}
          </p>
          <div>
            <label className="text-xs font-bold text-slate-600">{t('shifts.declaredCashLabel')}</label>
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
            <label className="text-xs font-bold text-slate-600">{t('shifts.closeNoteLabel')}</label>
            <input
              type="text"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder={t('shifts.closeNotePlaceholder')}
              className="input mt-1"
            />
          </div>
        </div>
      </Modal>

      {/* Close outlet shift modal */}
      <Modal
        open={closeOutletOpen}
        onClose={() => setCloseOutletOpen(false)}
        title={t('shifts.modalCloseOutletTitle')}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary" onClick={() => setCloseOutletOpen(false)}>{t('shifts.cancel')}</button>
            <button className="btn-danger" onClick={closeOutletShift} disabled={submitting}>
              <Lock size={14} /> {t('shifts.closeOutletShift')}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            {t('shifts.closeOutletHint1')}
          </p>
          <p>
            {t('shifts.closeOutletHint2')}
          </p>
          <div>
            <label className="text-xs font-bold text-slate-600">{t('shifts.closeNoteLabel')}</label>
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
        title={zScope === 'outlet' ? t('shifts.zTitleOutlet') : t('shifts.zTitleCashier')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              className="btn-secondary"
              onClick={() => { if (zReport) window.print(); }}
            >
              <FileText size={14} /> {t('shifts.print')}
            </button>
            <button className="btn-primary" onClick={() => { setZReport(null); setZScope(null); }}>
              {t('shifts.close')}
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
  const { t } = useTranslation();
  const { shift, paymentsByMode, refundsByMode, orderAggregates, cash } = report;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KV label={t('shifts.kvCashier')} value={shift.cashier?.name ?? '—'} />
        <KV label={t('shifts.kvOpened')} value={new Date(shift.openedAt).toLocaleString('en-IN')} />
        <KV label={t('shifts.kvClosed')} value={shift.closedAt ? new Date(shift.closedAt).toLocaleString('en-IN') : t('shifts.statusActive')} />
      </div>

      <Section title={t('shifts.secDrawerReconciliation')}>
        <Row label={t('shifts.kvOpeningFloat')}><Money value={cash.openingFloat} /></Row>
        <Row label={t('shifts.rowExpectedCash')}><Money value={cash.expectedCash} /></Row>
        <Row label={t('shifts.rowDeclaredCash')}>{cash.declaredCash != null ? <Money value={cash.declaredCash} /> : <span className="text-slate-400">—</span>}</Row>
        <Row label={t('shifts.rowVariance')}>
          {cash.variance != null
            ? <span className={Number(cash.variance) === 0 ? 'text-emerald-700' : 'text-rose-700 font-semibold'}><Money value={cash.variance} /></span>
            : <span className="text-slate-400">—</span>}
        </Row>
      </Section>

      <Section title={t('shifts.secOrdersDuringShift')}>
        <Row label={t('shifts.rowOrdersPlaced')}>{orderAggregates.ordersCount}</Row>
        <Row label={t('shifts.rowCancelled')}>{orderAggregates.cancelledCount}</Row>
        <Row label={t('shifts.rowSubtotal')}><Money value={orderAggregates.subtotal} /></Row>
        <Row label={t('shifts.rowTax')}><Money value={orderAggregates.tax} /></Row>
        <Row label={t('shifts.rowDiscounts')}><Money value={orderAggregates.discounts} /></Row>
        <Row label={t('shifts.rowTotalBilled')}><Money value={orderAggregates.total} /></Row>
      </Section>

      <Section title={t('shifts.secPaymentsCollected')}>
        {paymentsByMode.length === 0
          ? <p className="text-xs text-slate-400 px-3 py-2">{t('shifts.noPaymentsYet')}</p>
          : paymentsByMode.map((p: any) => (
              <Row key={p.mode} label={t('shifts.txnCount', { mode: p.mode, count: p.count })}>
                <Money value={p.amount} />
              </Row>
            ))}
      </Section>

      {refundsByMode.length > 0 && (
        <Section title={t('shifts.secRefundsIssued')}>
          {refundsByMode.map((p: any) => (
            <Row key={p.mode} label={t('shifts.txnCount', { mode: p.mode, count: p.count })}>
              <Money value={p.amount} />
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function OutletZ({ report }: { report: any }) {
  const { t } = useTranslation();
  const { shift, cashierReports } = report;
  // Aggregate across cashier reports
  const total = cashierReports.reduce((s: number, c: any) => s + Number(c.orderAggregates.total ?? 0), 0);
  const totalCash = cashierReports.flatMap((c: any) => c.paymentsByMode)
    .filter((p: any) => p.mode === 'CASH').reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KV label={t('shifts.kvOpened')} value={new Date(shift.openedAt).toLocaleString('en-IN')} />
        <KV label={t('shifts.kvClosed')} value={shift.closedAt ? new Date(shift.closedAt).toLocaleString('en-IN') : t('shifts.statusActive')} />
        <KV label={t('shifts.kvOpenedBy')} value={shift.openedBy?.name ?? '—'} />
      </div>

      <Section title={t('shifts.secOutletTotals')}>
        <Row label={t('shifts.rowCashiers')}><span className="tabular-nums">{cashierReports.length}</span></Row>
        <Row label={t('shifts.rowGrandTotalBilled')}><Money value={total} /></Row>
        <Row label={t('shifts.rowCashCollected')}><Money value={totalCash} /></Row>
      </Section>

      {cashierReports.map((cr: any) => (
        <div key={cr.shift.id} className="border border-slate-200 rounded-xl">
          <div className="px-3 py-2 bg-slate-50 rounded-t-xl text-xs font-bold text-slate-700">
            {cr.shift.cashier?.name ?? t('shifts.cashierFallback')} ·{' '}
            {new Date(cr.shift.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {cr.shift.closedAt ? ` → ${new Date(cr.shift.closedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : t('shifts.cashierStillOpen')}
          </div>
          <div className="px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KV label={t('shifts.kvOrders')} value={String(cr.orderAggregates.ordersCount)} />
            <KV label={t('shifts.kvTotal')} value={`₹${Number(cr.orderAggregates.total).toFixed(2)}`} />
            <KV label={t('shifts.rowExpectedCash')} value={`₹${Number(cr.cash.expectedCash ?? 0).toFixed(2)}`} />
            <KV
              label={t('shifts.kvVariance')}
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
