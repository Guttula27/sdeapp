import dayjs from 'dayjs';

// Each preset returns a [from, to] pair as YYYY-MM-DD strings so the
// existing reports API (which expects ISO date strings) accepts them
// unchanged. "MTD" = month-to-date.

export type PresetId = 'today' | 'yesterday' | '7d' | '30d' | 'mtd' | 'lastMonth' | 'custom';

export const PRESET_LABELS: Record<PresetId, string> = {
  today:    'Today',
  yesterday:'Yesterday',
  '7d':     'Last 7 days',
  '30d':    'Last 30 days',
  mtd:      'Month to date',
  lastMonth:'Last month',
  custom:   'Custom',
};

export function rangeFor(preset: PresetId): { from: string; to: string } | null {
  const today = dayjs().endOf('day');
  switch (preset) {
    case 'today':     return { from: dayjs().startOf('day').toISOString(),                 to: today.toISOString() };
    case 'yesterday': return { from: dayjs().subtract(1, 'day').startOf('day').toISOString(), to: dayjs().subtract(1, 'day').endOf('day').toISOString() };
    case '7d':        return { from: dayjs().subtract(6, 'day').startOf('day').toISOString(),  to: today.toISOString() };
    case '30d':       return { from: dayjs().subtract(29, 'day').startOf('day').toISOString(), to: today.toISOString() };
    case 'mtd':       return { from: dayjs().startOf('month').toISOString(),               to: today.toISOString() };
    case 'lastMonth': return { from: dayjs().subtract(1, 'month').startOf('month').toISOString(), to: dayjs().subtract(1, 'month').endOf('month').toISOString() };
    case 'custom':    return null; // caller's responsibility
  }
}
