import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  CloudOff, CheckCircle2, RefreshCw, Trash2, Printer as PrinterIcon, AlertCircle, Clock, Receipt,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { listOfflineOrders, closeOfflineTab, type OfflineOrder } from '../../utils/idb';
import api from '../../services/api';
import { drain } from '../../utils/outbox';
import { replayEntry } from '../../services/api';
import {
  connectPrinter, isPrinterConnected, isBluetoothSupported, printCustomerReceipt,
} from '../../utils/bluetoothPrinter';
import { buildReceiptPayload } from '../../utils/receiptPayload';

/**
 * Local "offline orders" reconciliation view.
 *
 * Lists every order the admin web placed while offline (or while the
 * API was unreachable), grouped by sync state. From here staff can:
 *   - Reprint the original receipt (Bluetooth path works offline too)
 *   - Force a sync attempt now (kicks the outbox drain)
 *   - See the server-issued ON- order number once the replay succeeds
 *
 * The records live in IndexedDB (utils/idb.ts). Cleaned up manually via
 * the trash button when reconciliation is complete and the staff no
 * longer wants to see them in the list.
 */
export default function OfflineOrdersPage() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const { online, apiReachable } = useNetworkStatus();

  // Outlet-tier and business-tier admins both work here; platform tier
  // doesn't really have one outlet's offline orders to inspect.
  if (tier === 'platform') return <Navigate to="/dashboard" replace />;

  const outletId = user?.outletId || '';
  const [rows, setRows] = useState<OfflineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listOfflineOrders(outletId || undefined);
      // Newest first — operators care about today's pending more than
      // last week's already-synced.
      all.sort((a, b) => b.createdAt - a.createdAt);
      setRows(all);
    } finally {
      setLoading(false);
    }
  }, [outletId]);
  useEffect(() => { refresh(); }, [refresh]);

  // Whenever the api comes back, the OfflineBanner kicks a drain on its
  // own. We listen for the same transition and refresh the list so the
  // sync-state column flips to "Synced" without a manual reload.
  useEffect(() => {
    if (online && apiReachable) {
      const id = window.setTimeout(refresh, 1500);
      return () => window.clearTimeout(id);
    }
  }, [online, apiReachable, refresh]);

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await drain(replayEntry);
      if (result.succeeded > 0) toast.success(t('offlineOrders.toastSyncedCount', { count: result.succeeded }));
      else if (result.failed > 0) toast.error(t('offlineOrders.toastFailedCount', { count: result.failed }));
      else toast(t('offlineOrders.toastNothingToSync'), { icon: 'ℹ️' });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || t('offlineOrders.toastSyncFail'));
    } finally {
      setSyncing(false);
    }
  };

  const reprint = async (row: OfflineOrder) => {
    const printerId = row.snapshot?.outlet?.receiptPrinterId ?? null;
    if (!isBluetoothSupported()) {
      toast.error(t('offlineOrders.toastBluetoothUnsupported'));
      return;
    }
    // The snapshot doesn't carry the outlet's receiptPrinterId — pull
    // it from the live outlet record instead. If the printer was
    // unpaired since the order was placed, this errors clearly.
    const printerToUse = printerId;
    if (!printerToUse) {
      toast.error(t('offlineOrders.toastNoPrinter'));
      return;
    }
    try {
      if (!isPrinterConnected(printerToUse)) await connectPrinter(printerToUse);
      await printCustomerReceipt(printerToUse, buildReceiptPayload(row.snapshot));
      toast.success(t('offlineOrders.toastReprinted'));
    } catch (e: any) {
      toast.error(e?.message || t('offlineOrders.toastPrintFail'));
    }
  };

  const bill = async (row: OfflineOrder) => {
    const batchesSuffix = row.batches && row.batches.length > 1
      ? t('offlineOrders.confirmBillBatches', { count: row.batches.length })
      : '';
    if (!window.confirm(
      t('offlineOrders.confirmBill', { id: row.id, batchesSuffix }),
    )) return;
    const billedAt = new Date().toISOString();
    try {
      // 1. Print first — even if the next step trips on a permission
      //    or transient error, the customer has the receipt.
      if (isBluetoothSupported()) {
        const printerId = row.snapshot?.outlet?.receiptPrinterId ?? null;
        if (printerId) {
          try {
            if (!isPrinterConnected(printerId)) await connectPrinter(printerId);
            await printCustomerReceipt(printerId, buildReceiptPayload(row.snapshot));
          } catch (printErr: any) {
            toast.error(t('offlineOrders.toastReceiptPrintFail', { msg: printErr?.message || String(printErr) }));
          }
        }
      }

      // 2. Close the tab locally + stamp servedAt.
      await closeOfflineTab(row.id, billedAt);

      // 3. Build the consolidated POST body from batches.
      const consolidatedBody = buildConsolidatedPostBody(row);
      const isLegacyRow = !consolidatedBody;
      if (isLegacyRow) {
        toast.success(t('offlineOrders.toastLegacyBilled'), { icon: '📡' });
        await refresh();
        void drain(replayEntry).then(() => refresh()).catch(() => { /* best-effort */ });
        return;
      }

      // 4. Fire the placement.
      try {
        const { data } = await api.post(
          `/outlets/${row.outletId}/orders`,
          consolidatedBody,
          {
            headers: { 'Idempotency-Key': row.id },
            __outboxLabel: `Bill ${row.id}`,
          } as any,
        );
        const placed = data?.data;
        if (placed?.id) {
          try {
            await api.patch(
              `/outlets/${row.outletId}/orders/${placed.id}/status`,
              { status: 'SERVED', actedAt: billedAt, force: true },
              { headers: { 'Idempotency-Key': `${row.id}-served` } },
            );
          } catch { /* best-effort */ }
          toast.success(t('offlineOrders.toastBilledSynced', { number: placed.orderNumber }));
        } else {
          toast.success(t('offlineOrders.toastBilledLocalPending'));
        }
      } catch (e: any) {
        const httpStatus = e?.response?.status ?? 0;
        const isInfraTransient = !e?.response || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
        if (isInfraTransient) {
          toast.success(t('offlineOrders.toastBillQueued'), { icon: '📡' });
        } else {
          toast.error(e?.response?.data?.message || t('offlineOrders.toastBillFailedServer'));
        }
      }

      await refresh();
      void drain(replayEntry).then(() => refresh()).catch(() => { /* best-effort */ });
    } catch (e: any) {
      toast.error(e?.message || t('offlineOrders.toastCouldNotBill'));
    }
  };

  const buildConsolidatedPostBody = (row: OfflineOrder): any | null => {
    const batches = row.batches;
    if (!batches || batches.length === 0) return null;
    const head = batches[0].payload ?? {};
    const allItems: any[] = [];
    for (const b of batches) {
      for (const it of b.items) allItems.push(it);
    }
    return {
      ...head,
      items: allItems,
    };
  };

  const remove = async (row: OfflineOrder) => {
    if (!window.confirm(t('offlineOrders.confirmRemove', { id: row.id }))) return;
    try {
      const req = indexedDB.open('paynpik-pos');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('offline-orders', 'readwrite');
        tx.objectStore('offline-orders').delete(row.id);
        tx.oncomplete = () => refresh();
      };
    } catch {
      toast.error(t('offlineOrders.toastCouldNotRemove'));
    }
  };

  const counts = {
    pending: rows.filter((r) => r.syncState === 'pending').length,
    synced:  rows.filter((r) => r.syncState === 'synced').length,
    failed:  rows.filter((r) => r.syncState === 'failed').length,
  };

  if (!outletId) {
    return (
      <div className="p-8 text-sm text-slate-500">
        {t('offlineOrders.outletScopedNotice')}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('offlineOrders.title')}</h1>
          <p className="text-xs text-slate-500">
            {t('offlineOrders.subtitle')}
          </p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing || counts.pending === 0}
          className="btn-primary text-xs"
        >
          {syncing
            ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <RefreshCw size={13} />}
          {syncing
            ? t('offlineOrders.syncing')
            : counts.pending
              ? t('offlineOrders.syncNowWithCount', { count: counts.pending })
              : t('offlineOrders.syncNow')}
        </button>
      </header>

      {/* Lane summaries */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Summary icon={Clock}         label={t('offlineOrders.lanePending')} value={counts.pending} accent="text-amber-700"   bg="bg-amber-50"   border="border-amber-200" />
        <Summary icon={CheckCircle2}  label={t('offlineOrders.laneSynced')}  value={counts.synced}  accent="text-emerald-700" bg="bg-emerald-50" border="border-emerald-200" />
        <Summary icon={AlertCircle}   label={t('offlineOrders.laneFailed')}  value={counts.failed}  accent="text-rose-700"    bg="bg-rose-50"    border="border-rose-200" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12">
          <CloudOff size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">{t('offlineOrders.emptyTitle')}</p>
          <p className="text-[11px] text-slate-400 mt-1">{t('offlineOrders.emptyHint')}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left  font-semibold px-4 py-2.5">{t('offlineOrders.colOrder')}</th>
                <th className="text-left  font-semibold px-4 py-2.5 hidden md:table-cell">{t('offlineOrders.colWhen')}</th>
                <th className="text-right font-semibold px-4 py-2.5">{t('offlineOrders.colTotal')}</th>
                <th className="text-left  font-semibold px-4 py-2.5">{t('offlineOrders.colStatus')}</th>
                <th className="text-right font-semibold px-4 py-2.5 w-[260px]">{t('offlineOrders.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-[11px] font-semibold text-slate-900">{row.id}</div>
                    {row.serverOrderNumber && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {t('offlineOrders.serverPrefix')} <span className="font-mono">{row.serverOrderNumber}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">
                    {new Date(row.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                    ₹{Number(row.snapshot?.totalAmount ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <StateBadge state={row.syncState} error={row.syncError} />
                    {row.servedAt && (
                      <span
                        className="ml-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 align-middle"
                        title={t('offlineOrders.billedTitle', { when: new Date(row.servedAt).toLocaleString('en-IN') })}
                      >
                        <Receipt size={9} /> {t('offlineOrders.billedBadge')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => reprint(row)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                        title={t('offlineOrders.reprintTitle')}
                      >
                        <PrinterIcon size={12} /> {t('offlineOrders.reprint')}
                      </button>
                      {row.syncState === 'pending' && !row.servedAt && (
                        <button
                          onClick={() => bill(row)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title={t('offlineOrders.billTitle')}
                        >
                          <Receipt size={12} /> {t('offlineOrders.bill')}
                        </button>
                      )}
                      <button
                        onClick={() => remove(row)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                        title={t('offlineOrders.clearTitle')}
                      >
                        <Trash2 size={12} /> {t('offlineOrders.clear')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-4">
        <Trans
          i18nKey="offlineOrders.footerNaming"
          components={{
            off: <span className="font-mono" />,
            on:  <span className="font-mono" />,
          }}
        />
      </p>
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────── */
function Summary({ icon: Icon, label, value, accent, bg, border }: {
  icon: any; label: string; value: number; accent: string; bg: string; border: string;
}) {
  return (
    <div className={clsx('rounded-xl border px-3 py-2.5 flex items-center gap-2', bg, border)}>
      <Icon size={14} className={accent} />
      <div className="flex-1 min-w-0">
        <p className={clsx('text-[10px] uppercase tracking-wider', accent)}>{label}</p>
        <p className="text-base font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function StateBadge({ state, error }: { state: OfflineOrder['syncState']; error?: string }) {
  const { t } = useTranslation();
  if (state === 'synced')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={10} /> {t('offlineOrders.stateSynced')}</span>;
  if (state === 'failed')
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700"
        title={error || t('offlineOrders.stateFailedTitle')}
      >
        <AlertCircle size={10} /> {t('offlineOrders.stateFailed')}
      </span>
    );
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={10} /> {t('offlineOrders.statePending')}</span>;
}
