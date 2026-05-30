import { useEffect, useRef } from 'react';

// Fires `callback` whenever the tab regains focus / visibility.
// Throttled to avoid a double-trigger (some browsers fire both
// `focus` and `visibilitychange` back-to-back on tab switch).
//
// Use case: customer leaves the menu tab open in the background while
// staff updates an item's availability. When the customer returns,
// the callback re-fetches the menu so what they see matches reality.
//
// Notes:
//   • Skipped while the document is hidden — no point spending bandwidth
//     when the user can't see the result.
//   • `minIntervalMs` debounces — defaults to 5s. Tune up to 30s for
//     pages that are read-heavy and rarely change.

export function useRefreshOnFocus(
  callback: () => void | Promise<void>,
  opts: { minIntervalMs?: number; pollIntervalMs?: number } = {},
) {
  const lastRunRef = useRef(0);
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const minInterval = opts.minIntervalMs ?? 5000;
  const pollInterval = opts.pollIntervalMs;

  useEffect(() => {
    const maybeRun = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRunRef.current < minInterval) return;
      lastRunRef.current = now;
      try { void cbRef.current(); } catch { /* ignore */ }
    };

    document.addEventListener('visibilitychange', maybeRun);
    window.addEventListener('focus', maybeRun);

    // Optional foreground polling. Only ticks while the tab is visible
    // (the maybeRun visibility check enforces this) so a backgrounded
    // tab doesn't drain mobile battery.
    let timer: any = null;
    if (pollInterval && pollInterval > 0) {
      timer = setInterval(maybeRun, pollInterval);
    }

    return () => {
      document.removeEventListener('visibilitychange', maybeRun);
      window.removeEventListener('focus', maybeRun);
      if (timer) clearInterval(timer);
    };
  }, [minInterval, pollInterval]);
}
