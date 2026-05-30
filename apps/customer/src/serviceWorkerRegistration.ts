// SW <-> outbox bridge.
//
// `vite-plugin-pwa` injects the actual service-worker registration into
// the bundle (via `injectRegister: 'auto'` in vite.config.ts). We don't
// register again here — duplicate registrations are no-ops anyway, but
// owning a single source of truth makes upgrades easier.
//
// What this module DOES own: the message channel between the SW and the
// in-app outbox. When the SW fires a 'sync' event (Background Sync API,
// supported on Chromium-flavoured browsers), it postMessages every open
// client. We forward that into `drain(replayEntry)` so queued writes
// flush in the background without the user lifting a finger.

import { drain } from './utils/outbox';
import { replayEntry } from './services/api';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Skip in dev — Workbox's runtime caching fights HMR.
  if (!(import.meta as any).env?.PROD) return;

  window.addEventListener('load', () => {
    // Listen for the SW's drain hint. The drain itself runs in the page
    // (which has the customer auth token) — the SW just decides when.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'outbox-drain') {
        drain(replayEntry).catch(() => { /* OfflineBanner surfaces toasts */ });
      }
    });

    // Best-effort Background Sync registration. Browsers that support it
    // (Chrome/Edge/Android) will fire 'sync' when the network returns
    // even while the tab is backgrounded. iOS Safari ignores this; the
    // in-page online listener still covers it.
    navigator.serviceWorker.ready.then((reg: any) => {
      if (reg.sync && typeof reg.sync.register === 'function') {
        reg.sync.register('paynpik-outbox-drain').catch(() => { /* ignore */ });
      }
    }).catch(() => { /* ignore */ });
  });
}
