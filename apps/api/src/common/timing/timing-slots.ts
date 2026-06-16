/**
 * Per-day-of-week availability evaluation, shared across every menu
 * node (Menu / Category / Subcategory / Item). All slot tables in the
 * schema share the same shape:
 *
 *   { dayOfWeek: 1..7 (ISO, Mon=1), startMinute: 0..1440, endMinute: 0..1440 }
 *
 * Storing minutes-since-midnight keeps the comparison timezone-clean
 * (no DST math at request time) — callers are expected to compute
 * `now` in the outlet's local timezone before calling these helpers.
 */
export interface TimingSlot {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface NowInOutletTz {
  dayOfWeek: number; // 1..7 (Mon..Sun)
  minute: number;    // 0..1439
}

/**
 * No slots = no constraint at this level (cascades to outlet hours).
 * One or more slots = available only inside one of them.
 */
export function isWithinSlots(slots: TimingSlot[] | undefined | null, now: NowInOutletTz): boolean {
  if (!slots || slots.length === 0) return true;
  return slots.some((s) =>
    s.dayOfWeek === now.dayOfWeek
    && now.minute >= s.startMinute
    && now.minute < s.endMinute,
  );
}

/**
 * Closest future "opens at" moment expressed as a (dayOfWeek, minute)
 * pair, or null when the node is currently within an open slot (the
 * caller doesn't need a hint). Used to render "Available from 7:00 AM"
 * style badges on the customer menu.
 *
 * Walks up to 7 days forward starting from `now`'s day so a Saturday
 * lookup correctly surfaces a Sunday slot.
 */
export function nextOpenAt(
  slots: TimingSlot[] | undefined | null,
  now: NowInOutletTz,
): { dayOfWeek: number; minute: number } | null {
  if (!slots || slots.length === 0) return null;
  if (isWithinSlots(slots, now)) return null;

  // Group slots by day for fast lookup.
  const byDay = new Map<number, TimingSlot[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }

  for (let offset = 0; offset < 7; offset++) {
    const day = ((now.dayOfWeek - 1 + offset) % 7) + 1;
    const daySlots = (byDay.get(day) ?? []).slice().sort((a, b) => a.startMinute - b.startMinute);
    for (const s of daySlots) {
      // Today: only future starts count. Future days: any slot start.
      if (offset > 0 || s.startMinute > now.minute) {
        return { dayOfWeek: day, minute: s.startMinute };
      }
    }
  }
  return null;
}

/**
 * Resolve "now" in the outlet's local timezone. Today every outlet is
 * implicitly Asia/Kolkata (IST, UTC+5:30) — when we add per-outlet
 * timezone columns this helper becomes the single place to thread that
 * through. dayOfWeek follows the ISO convention used everywhere else
 * in the menu timing tables: 1=Mon..7=Sun.
 */
export function nowInOutletTz(timezoneOffsetMinutes = 330): NowInOutletTz {
  const utc = new Date();
  const local = new Date(utc.getTime() + timezoneOffsetMinutes * 60_000);
  const jsDay = local.getUTCDay(); // 0=Sun..6=Sat
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { dayOfWeek, minute };
}

/**
 * Cascading evaluation — a node is "in schedule" only if its own slots
 * pass AND every ancestor in the chain passed too. Returns the
 * earliest blocking ancestor's nextOpenAt when out-of-window, so the
 * UI can show a single "Available from 7 AM" badge instead of stacking
 * conflicting hints from multiple levels.
 */
export function evaluateCascade(
  chain: Array<{ slots: TimingSlot[] | undefined | null; label?: string }>,
  now: NowInOutletTz,
): {
  inSchedule: boolean;
  blockedBy?: { label?: string; nextOpen: { dayOfWeek: number; minute: number } | null };
} {
  for (const node of chain) {
    if (!isWithinSlots(node.slots, now)) {
      return { inSchedule: false, blockedBy: { label: node.label, nextOpen: nextOpenAt(node.slots, now) } };
    }
  }
  return { inSchedule: true };
}
