// Shared ringtone playback. Used by both the Profile preview button and
// the live alert handler, so the user actually hears what they previewed.
//
// Two browser quirks we work around:
//
// 1. Autoplay policy — Chrome/Safari refuse to play audio that wasn't
//    triggered by a user gesture. A Socket.IO event is NOT a gesture,
//    so an AudioContext created from an alert handler starts in
//    'suspended' state and produces silence. We unlock once on the first
//    user interaction (handled by setupAudioUnlock at app boot).
//
// 2. iOS Safari requires the SAME AudioContext to have been
//    resumed-by-gesture — creating a fresh one inside the alert handler
//    still gets suspended. So we hold a single module-level context.

const TONES: Record<string, { freq: number; dur: number }[]> = {
  chime: [{ freq: 880, dur: 0.18 }, { freq: 1320, dur: 0.22 }],
  bell:  [{ freq: 1568, dur: 0.4 }],
  ping:  [{ freq: 2093, dur: 0.12 }, { freq: 2093, dur: 0.12 }],
  buzz:  [{ freq: 200, dur: 0.25 }, { freq: 200, dur: 0.25 }],
  ding:  [{ freq: 1200, dur: 0.25 }],
  pop:   [{ freq: 600, dur: 0.15 }, { freq: 800, dur: 0.15 }],
  soft:  [{ freq: 440, dur: 0.5 }],
};

export const RINGTONE_OPTIONS = Object.keys(TONES) as ReadonlyArray<keyof typeof TONES>;

const VIBRATE_PATTERNS: Record<string, number[]> = {
  chime: [120, 60, 120],
  bell:  [200],
  ping:  [80, 40, 80],
  buzz:  [300, 100, 300],
  ding:  [150],
  pop:   [60, 40, 60],
  soft:  [200, 100, 200],
};

const VIBRATE_PREF_KEY = 'paynpik-customer-vibrate';

export function isVibrateEnabled(): boolean {
  try {
    return localStorage.getItem(VIBRATE_PREF_KEY) === '1';
  } catch { return false; }
}

export function setVibrateEnabled(on: boolean): void {
  try { localStorage.setItem(VIBRATE_PREF_KEY, on ? '1' : '0'); }
  catch { /* private mode / quota — best-effort */ }
}

let ctx: AudioContext | null = null;
let unlocked = false;

// iOS Safari (including installed PWAs on iOS) does not implement
// navigator.vibrate at all. We surface this explicitly so the toggle can
// say "iOS doesn't support vibration" instead of just "Not supported".
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function getCtx(): AudioContext | null {
  if (!ctx) {
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch { return null; }
  }
  return ctx;
}

/**
 * Attach one-time listeners on common user-gesture events so the
 * shared AudioContext gets resumed. After that, subsequent playRingtone
 * calls from Socket.IO handlers will actually produce sound.
 *
 * Call once near app boot (from CustomerAlertsContext mount is fine).
 */
export function setupAudioUnlock() {
  if (unlocked) return;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') {
      c.resume().catch(() => {});
    }
    unlocked = true;
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
}

export interface PlayOptions {
  /** 0..100. Maps to a sensible WebAudio gain. Defaults to 70. */
  volume?: number;
  /** When true, also calls navigator.vibrate() with a pattern matching the tone. */
  vibrate?: boolean;
}

/**
 * Play a short alert tone via WebAudio. Falls back silently if audio
 * is unsupported, blocked by browser policy, or the context can't be
 * created. Returns whether playback was attempted (not whether the user
 * heard anything — we can't know that).
 */
export function playRingtone(kind: string | null | undefined, opts: PlayOptions = {}): boolean {
  const seq = TONES[kind || 'chime'] || TONES.chime;
  const volume = Math.max(0, Math.min(100, opts.volume ?? 70));
  const peakGain = (volume / 100) * 0.35; // 0.35 was the original hardcoded peak

  // Vibrate first (independent of audio — works even if audio is blocked).
  if (opts.vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      const pattern = VIBRATE_PATTERNS[kind || 'chime'] || VIBRATE_PATTERNS.chime;
      navigator.vibrate(pattern);
    } catch { /* some browsers throw if vibrate is disabled at OS level */ }
  }

  if (volume <= 0) return true; // user muted audio; vibrate still fired

  const c = getCtx();
  if (!c) return false;

  // If the context is still suspended (no user interaction yet), the
  // sound won't play. We try to resume anyway in case the gesture
  // already happened but our listener missed it.
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }

  try {
    const now = c.currentTime;
    let t = now;
    seq.forEach(({ freq, dur }) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(peakGain, 0.0002), t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.06;
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Loud-alert loop. Plays the ringtone + vibrates on a recurring interval
 * and returns a stop() handle. Use for ORDER_READY / PICKUP_READY where
 * the customer needs to physically come pick up the order — the noise
 * stops only when they tap acknowledge.
 *
 * Intervals around 2.5–3s feel urgent without being unbearable. The
 * first beat fires immediately so there's no awkward initial silence.
 */
export function startLoudAlert(kind: string | null | undefined, opts: PlayOptions = {}): { stop: () => void } {
  const fire = () => playRingtone(kind, { volume: opts.volume ?? 100, vibrate: opts.vibrate });
  fire();
  const id = setInterval(fire, 2800);
  return {
    stop() {
      clearInterval(id);
      // Cancel any in-flight vibration so the device doesn't keep
      // buzzing after the user dismisses.
      if (vibrationSupported()) {
        try { navigator.vibrate(0); } catch { /* ignore */ }
      }
    },
  };
}
