import { useEffect, useState } from 'react';

// Network state hook — combines the browser's `navigator.onLine` signal with
// our own "API reachable" check so a flaky WAN (online to the LAN but the
// API is unreachable) still surfaces as offline to the UI.
//
// The hook is intentionally minimal: it returns the current online flag and
// when it last changed. Callers wire it to banners, retry logic, and so on.

export interface NetworkStatus {
  online: boolean;
  since: number; // ms since epoch of the last transition
  // Whether we've heard a server-confirmed offline signal (vs just the
  // browser's navigator.onLine flip). Useful for distinguishing "no Wi-Fi"
  // (broswer-known) from "Wi-Fi up but API down" (only known via failed
  // fetches reporting through markApiOffline).
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

// Called by the axios retry interceptor when a request finally gives up
// (all retries exhausted with a network error). Flips the API-reachable
// flag so the banner shows even when the browser still thinks we're
// online (captive portal, server down, VPN blip, etc.).
export function markApiOffline() {
  if (current.apiReachable) {
    current = { ...current, apiReachable: false, since: Date.now() };
    publish();
  }
}

// Called by the axios success interceptor on any successful response.
// Flips the API-reachable flag back on after a server-side blip clears.
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
    setStatus(current); // sync to latest in case it changed before mount
    return () => { listeners.delete(setStatus); };
  }, []);
  return status;
}
