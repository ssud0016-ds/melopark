// Slim native port of frontend/src/utils/plannerTime.js — only the
// formatters BayDetailSheet + friends need. Melbourne timezone via Intl.

export const DEFAULT_PLANNER_DURATION_MINS = 60;

const MELBOURNE_TZ = 'Australia/Melbourne';

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: MELBOURNE_TZ,
};

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: MELBOURNE_TZ,
};

/** e.g. "2 hr" for the "Stay limit:" row */
export function formatStayLimitShort(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(Number(mins))) return null;
  const n = Number(mins);
  if (n === 60) return '1 hr';
  if (n === 90) return '1.5 hr';
  if (n % 60 === 0) return `${n / 60} hr`;
  return `${n} min`;
}

/** "6:30 PM" only */
export function formatLeaveByClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleTimeString('en-AU', TIME_OPTS) || null;
  } catch {
    return null;
  }
}

/** "Mon, 17/05/2026" — Melbourne wall clock from an instant. */
export function formatMelbourneDate(iso: string | null | undefined): string {
  const d = new Date(iso ?? Date.now());
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-AU', DATE_OPTS).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('weekday')}, ${get('day')}/${get('month')}/${get('year')}`;
  } catch {
    return '';
  }
}

/** "3:24 PM" — Melbourne wall clock from an instant. */
export function formatMelbourneTime(iso: string | null | undefined): string {
  const d = new Date(iso ?? Date.now());
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('en-AU', TIME_OPTS).toUpperCase();
  } catch {
    return '';
  }
}

/** Map duration-filter code to short label used in the "Showing" strip. */
const DUR_LABELS: Record<string, string> = {
  '15m': '15 min',
  '15min': '15 min',
  '30m': '30 min',
  '30min': '30 min',
  '1h': '1H',
  '2h': '2H',
  '3h': '3H',
  '4h': '4H',
};
export function durationFilterLabel(
  durationFilter: string | null | undefined,
  customDuration?: number | null,
): string {
  if (!durationFilter) return 'Any duration';
  if (durationFilter === 'custom') {
    return customDuration ? `${customDuration} min` : 'Custom';
  }
  return DUR_LABELS[durationFilter] || durationFilter;
}
