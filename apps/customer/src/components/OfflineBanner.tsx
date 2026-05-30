import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { WifiOff, Wifi, RefreshCw, CloudOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { subscribe, drain, getEntries, OutboxEntry } from '../utils/outbox';
import { replayEntry } from '../services/api';

// See apps/web/src/components/common/OfflineBanner.tsx for the full
// rationale. Same shape, customer-app paths.

export default function OfflineBanner() {
  const { online, apiReachable } = useNetworkStatus();
  const isDown = !online || !apiReachable;
  const [showRecovered, setShowRecovered] = useState(false);
  const [prevDown, setPrevDown] = useState(isDown);
  const [pending, setPending] = useState<OutboxEntry[]>(() => getEntries());
  const [draining, setDraining] = useState(false);

  useEffect(() => subscribe(setPending), []);

  useEffect(() => {
    if (prevDown && !isDown) {
      setShowRecovered(true);
      const t = setTimeout(() => setShowRecovered(false), 3000);
      drainNow().catch(() => {});
      return () => clearTimeout(t);
    }
    setPrevDown(isDown);
  }, [isDown, prevDown]);

  const drainNow = async () => {
    if (draining) return;
    setDraining(true);
    try {
      const result = await drain(replayEntry);
      if (result.succeeded > 0) {
        toast.success(`${result.succeeded} action${result.succeeded === 1 ? '' : 's'} synced`);
      }
      if (result.failed > 0) {
        for (const e of getEntries()) {
          toast.error(
            (t) => (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  <span className="font-bold">{e.label}</span> couldn't sync
                  {e.lastError ? <span className="block text-[10px] opacity-70 mt-0.5">{e.lastError}</span> : null}
                </span>
                <button
                  className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2 py-1 rounded-md inline-flex items-center gap-1"
                  onClick={async () => {
                    toast.dismiss(t.id);
                    await drainNow();
                  }}
                >
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            ),
            { id: `outbox-${e.idempotencyKey}`, duration: Infinity },
          );
        }
      }
    } finally {
      setDraining(false);
    }
  };

  const hasPending = pending.length > 0;
  if (!isDown && !showRecovered && !hasPending) return null;

  return (
    <div
      className={
        'fixed top-0 left-0 right-0 z-[100] px-3 py-1.5 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md ' +
        (isDown
          ? 'bg-red-600'
          : hasPending
            ? 'bg-amber-600'
            : 'bg-emerald-600')
      }
      role="status"
      aria-live="polite"
    >
      {isDown ? (
        <>
          <WifiOff size={13} />
          <span>{!navigator.onLine ? 'You appear to be offline' : 'Connection unstable — retrying'}</span>
          {hasPending && (
            <span className="ml-2 inline-flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-full">
              <CloudOff size={10} /> {pending.length} queued
            </span>
          )}
        </>
      ) : hasPending ? (
        <>
          <CloudOff size={13} />
          <span>{pending.length} action{pending.length === 1 ? '' : 's'} queued for sync</span>
          <button
            onClick={drainNow}
            disabled={draining}
            className="ml-2 bg-white/25 hover:bg-white/35 px-2 py-0.5 rounded-md inline-flex items-center gap-1 text-[11px]"
          >
            <RefreshCw size={10} className={draining ? 'animate-spin' : ''} />
            {draining ? 'Syncing…' : 'Retry now'}
          </button>
        </>
      ) : (
        <>
          <Wifi size={13} />
          <span>Back online</span>
        </>
      )}
    </div>
  );
}
