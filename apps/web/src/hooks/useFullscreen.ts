import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fullscreen toggle for an arbitrary container. Returns a ref to attach
 * to the page wrapper + the current state + a toggle handler.
 *
 * The element passed to `requestFullscreen()` is the ref'd container,
 * so the page's own layout is what fills the screen (kitchen monitor
 * mode, landscape phone, etc.). When no ref is attached or the
 * Fullscreen API isn't available the hook degrades gracefully — the
 * toggle is a no-op and `isFullscreen` stays false.
 *
 * iOS Safari historically doesn't support fullscreen on arbitrary
 * elements (only <video>); the hook still returns sensible defaults
 * there so callers don't need to feature-detect.
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (typeof el.requestFullscreen === 'function') await el.requestFullscreen();
      } else if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      }
    } catch {
      /* user dismissed the permission prompt; nothing to surface */
    }
  }, []);

  // Listen for fullscreenchange so the icon stays in sync even when the
  // user exits with Escape or via the OS keyboard shortcut.
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return { ref, isFullscreen, toggle };
}
