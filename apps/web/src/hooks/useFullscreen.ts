import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fullscreen toggle for an arbitrary container. Returns a ref to attach
 * to the page wrapper + the current state + a toggle handler.
 *
 * Implementation notes:
 *   - The handler is intentionally *not* `async`. Browsers require
 *     `requestFullscreen()` to be called *synchronously* inside a user-
 *     gesture handler. Wrapping it in an async function and awaiting it
 *     can drop the gesture context on Firefox + Safari (Chrome is
 *     forgiving). We invoke it synchronously and handle the returned
 *     Promise via .catch so failures still log.
 *   - Errors are routed to console.warn rather than swallowed so a
 *     blocked request leaves a breadcrumb a developer can see in
 *     DevTools.
 *   - iOS Safari doesn't expose requestFullscreen on arbitrary elements;
 *     the function silently no-ops there (no error to log).
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && !!document.fullscreenElement,
  );

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) {
      // Ref not yet attached — caller likely forgot to wire it on a div.
      console.warn('[useFullscreen] toggle called but ref.current is null');
      return;
    }
    if (!document.fullscreenElement) {
      // Vendor-prefixed fallback for older browsers — request() returns
      // a Promise on modern engines, but a few older Safari builds
      // resolved synchronously.
      const req: any =
        (el as any).requestFullscreen ||
        (el as any).webkitRequestFullscreen ||
        (el as any).msRequestFullscreen;
      if (typeof req !== 'function') {
        console.warn('[useFullscreen] requestFullscreen is unavailable on this element');
        return;
      }
      try {
        const result = req.call(el);
        if (result && typeof result.catch === 'function') {
          result.catch((err: any) => {
            console.warn('[useFullscreen] requestFullscreen rejected:', err);
          });
        }
      } catch (err) {
        console.warn('[useFullscreen] requestFullscreen threw synchronously:', err);
      }
    } else {
      const exit: any =
        (document as any).exitFullscreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).msExitFullscreen;
      if (typeof exit !== 'function') return;
      try {
        const result = exit.call(document);
        if (result && typeof result.catch === 'function') {
          result.catch((err: any) => {
            console.warn('[useFullscreen] exitFullscreen rejected:', err);
          });
        }
      } catch (err) {
        console.warn('[useFullscreen] exitFullscreen threw synchronously:', err);
      }
    }
  }, []);

  // Listen for fullscreenchange so the icon stays in sync even when the
  // user exits with Escape or via the OS keyboard shortcut. Also tracks
  // the vendor-prefixed event for older Safari.
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  return { ref, isFullscreen, toggle };
}
