import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  CloudOff, CheckCircle2, RefreshCw, Trash2, Printer as PrinterIcon, AlertCircle, Clock,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { listOfflineOrders, type OfflineOrder } from '../../utils/idb';
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
      if (result.succeeded > 0) toast.success(`Synced ${result.succeeded} order${result.succeeded === 1 ? '' : 's'}`);
      else if (result.failed > 0) toast.error(`${result.failed} order${result.failed === 1 ? '' : 's'} failed to sync`);
      else toast('Nothing to sync', { icon: 'ℹ️' });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const reprint = async (row: OfflineOrder) => {
    const printerId = row.snapshot?.outlet?.receiptPrinterId ?? null;
    if (!isBluetoothSupported()) {
      toast.error('Web Bluetooth is not supported on this browser');
      return;
    }
    // The snapshot doesn't carry the outlet's receiptPrinterId — pull
    // it from the live outlet record instead. If the printer was
    // unpaired since the order was placed, this errors clearly.
    const printerToUse = printerId;
    if (!printerToUse) {
      toast.error('No receipt printer is configured for this outlet');
      return;
    }
    try {
      if (!isPrinterConnected(printerToUse)) await connectPrinter(printerToUse);
      await printCustomerReceipt(printerToUse, buildReceiptPayload(row.snapshot));
      toast.success('Receipt reprinted');
    } catch (e: any) {
      toast.error(e?.message || 'Print failed');
    }
  };

  const remove = async (row: OfflineOrder) => {
    if (!window.confirm(`Remove ${row.id} from this list? (does not undo the order — the server copy stays)`)) return;
    try {
      // Defer to direct IDB delete — kept inline so we don't add yet
      // another helper to utils/idb.ts for a one-off action.
      const req = indexedDB.open('paynpik-pos');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('offline-orders', 'readwrite');
        tx.objectStore('offline-orders').delete(row.id);
        tx.oncomplete = () => refresh();
      };
    } catch {
      toast.error('Could not remove the record');
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
        Offline orders are kept per-outlet on the device that placed them. Your account isn't linked to an outlet.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Offline orders</h1>
          <p className="text-xs text-slate-500">
            Orders placed while the API was unreachable. They sync automatically when the network comes back —
            but you can also force a sync, reprint a receipt, or clear up reconciled rows.
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
          {syncing ? 'Syncing…' : `Sync now${counts.pending ? ` (${counts.pending})` : ''}`}
        </button>
      </header>

      {/* Lane summaries */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Summary icon={Clock}       label="Pending" value={counts.pending} accent="text-amber-700"   bg="bg-amber-50"   border="border-amber-200" />
        <Summary icon={CheckCircle2}  label="Synced"  value={counts.synced}  accent="text-emerald-700" bg="bg-emerald-50" border="border-emerald-200" />
        <Summary icon={AlertCircle} label="Failed"  value={counts.failed}  accent="text-rose-700"    bg="bg-rose-50"    border="border-rose-200" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12">
          <CloudOff size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No offline orders on this device.</p>
          <p className="text-[11px] text-slate-400 mt-1">Orders placed here while the network is down will show up automatically.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left  font-semibold px-4 py-2.5">Order</th>
                <th className="text-left  font-semibold px-4 py-2.5 hidden md:table-cell">When</th>
                <th className="text-right font-semibold px-4 py-2.5">Total</th>
                <th className="text-left  font-semibold px-4 py-2.5">Status</th>
                <th className="text-right font-semibold px-4 py-2.5 w-[260px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-[11px] font-semibold text-slate-900">{row.id}</div>
                    {row.serverOrderNumber && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Server: <span className="font-mono">{row.serverOrderNumber}</span>
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
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => reprint(row)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Send the snapshot back to the bluetooth printer"
                      >
                        <PrinterIcon size={12} /> Reprint
                      </button>
                      <button
                        onClick={() => remove(row)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Remove this row from the local list (server copy stays)"
                      >
                        <Trash2 size={12} /> Clear
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
        Naming: orders placed offline get an <span className="font-mono">OFF-…</span> prefix; orders confirmed online use
        <span className="font-mono"> ON-…</span>. The two formats can't collide — the orderNumber column is unique-indexed on the server.
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
  if (state === 'synced')
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={10} /> SYNCED</span>;
  if (state === 'failed')
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700"
        title={error || 'Server rejected the replay'}
      >
        <AlertCircle size={10} /> FAILED
      </span>
    );
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={10} /> PENDING</span>;
}
