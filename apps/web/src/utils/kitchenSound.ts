/**
 * Kitchen bell — WebAudio synthesised tone played when a new order
 * arrives in the KitchenPage. Ported from the customer ringtones
 * module; kept self-contained so the admin app doesn't pull in the
 * customer build.
 *
 * Browser autoplay policy means the first sound after a page load
 * needs a user gesture to unlock the AudioContext. We attach one-time
 * listeners on first interaction with the kitchen screen.
 *
 * Persistence: volume + mute live in localStorage so a kitchen station
 * keeps its preference across reloads / shift changes.
 */

const VOLUME_KEY = 'paynpik-kitchen-bell-volume';
const MUTE_KEY   = 'paynpik-kitchen-bell-mute';
const DEFAULT_VOLUME = 80;

let ctx: AudioContext | null = null;
let unlocked = false;

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
 * Attach one-time gesture listeners so the AudioContext resumes on the
 * first kitchen interaction. After that, socket-triggered bells will
 * actually be audible. Idempotent — safe to call from a useEffect.
 */
export function setupKitchenAudioUnlock(): void {
  if (unlocked) return;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    unlocked = true;
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
}

export function getKitchenBellVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw == null) return DEFAULT_VOLUME;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}

export function setKitchenBellVolume(v: number): void {
  try { localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(100, Math.round(v))))); }
  catch { /* ignore */ }
}

export function isKitchenBellMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; }
  catch { return false; }
}

export function setKitchenBellMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); }
  catch { /* ignore */ }
}

/**
 * Play a two-tone bell sequence sized to cut through kitchen noise.
 * Idempotent — multiple rapid calls produce overlapping tones, which
 * is actually desirable when a burst of orders comes in.
 */
export function playKitchenBell(): boolean {
  if (isKitchenBellMuted()) return false;
  const volume = getKitchenBellVolume();
  if (volume <= 0) return false;

  const c = getCtx();
  if (!c) return false;
  if (c.state === 'suspended') c.resume().catch(() => {});

  const peakGain = (volume / 100) * 0.5;
  const sequence = [
    // Bright two-tone ding-ding — louder + higher than the customer
    // chime so it reads as "kitchen alert" without being confusing.
    { freq: 1568, dur: 0.18 }, // G6
    { freq: 1318, dur: 0.32 }, // E6
  ];

  try {
    const now = c.currentTime;
    let t = now;
    for (const { freq, dur } of sequence) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(peakGain, 0.0002), t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.04;
    }
    return true;
  } catch {
    return false;
  }
}
