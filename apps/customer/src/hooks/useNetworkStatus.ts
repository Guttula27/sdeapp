import { useEffect, useState } from 'react';

// Network state hook — see apps/web/src/hooks/useNetworkStatus.ts for the
// rationale. Duplicated per-app so each Vite bundle stays isolated; the
// implementations are identical and tracked together by intent.

export interface NetworkStatus {
  online: boolean;
  since: number;
  apiReachable: boolean;
}

type Listener = (s: NetworkStatus) => void;

let current: NetworkStatus = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  since: Date.now(),
  apiReachable: true,
};
const listeners: Set<Listener> = new Set();

function publish() {
  for (const l of listeners) l(current);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    current = { ...current, online: true, since: Date.now(), apiReachable: true };
    publish();
  });
  window.addEventListener('offline', () => {
    current = { ...current, online: false, since: Date.now(), apiReachable: false };
    publish();
  });
}

export function markApiOffline() {
  if (current.apiReachable) {
    current = { ...current, apiReachable: false, since: Date.now() };
    publish();
  }
}

export function markApiReachable() {
  if (!current.apiReachable) {
    current = { ...current, apiReachable: true, since: Date.now() };
    publish();
  }
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(current);
  useEffect(() => {
    listeners.add(setStatus);
    setStatus(current);
    return () => { listeners.delete(setStatus); };
  }, []);
  return status;
}
