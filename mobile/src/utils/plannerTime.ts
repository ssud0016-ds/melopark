/** Melbourne wall-clock planner helpers — port of frontend/src/utils/plannerTime.js */

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

const SHOWING_DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: MELBOURNE_TZ,
};

type WallParts = { y: number; m: number; d: number; h: number; min: number; sec: number };

function readMelbourneWallParts(utcMs: number): WallParts {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const o: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(new Date(utcMs))) {
    if (type !== 'literal') o[type] = value;
  }
  return {
    y: Number(o.year),
    m: Number(o.month),
    d: Number(o.day),
    h: Number(o.hour),
    min: Number(o.minute),
    sec: Number(o.second),
  };
}

function cmpMelbourneWallParts(a: WallParts, b: WallParts): number {
  const ta = [a.y, a.m, a.d, a.h, a.min, a.sec];
  const tb = [b.y, b.m, b.d, b.h, b.min, b.sec];
  for (let i = 0; i < 6; i += 1) {
    if (ta[i] < tb[i]) return -1;
    if (ta[i] > tb[i]) return 1;
  }
  return 0;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** UTC ms for Melbourne civil time (y, mo, d, hh, mm, ss). */
export function melbourneWallClockToUtcMs(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  ss = 0,
): number | null {
  const target = { y, m: mo, d, h: hh, min: mm, sec: ss };
  let lo = Date.UTC(y, mo - 1, d, 0, 0, 0) - 18 * 3600 * 1000;
  let hi = Date.UTC(y, mo - 1, d, 0, 0, 0) + 18 * 3600 * 1000;
  while (cmpMelbourneWallParts(readMelbourneWallParts(lo), target) > 0) lo -= 3600 * 1000;
  while (cmpMelbourneWallParts(readMelbourneWallParts(hi), target) < 0) hi += 3600 * 1000;

  let best: number | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = cmpMelbourneWallParts(readMelbourneWallParts(mid), target);
    if (c === 0) {
      best = mid;
      break;
    }
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return best;
}

export function melbourneOffsetIsoSuffix(utcMs: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MELBOURNE_TZ,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(utcMs));
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  const normalized = raw.replace(/\u2212/g, '-');
  const m = normalized.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return '+10:00';
  const sign = m[1];
  const h = m[2].padStart(2, '0');
  const min = (m[3] ?? '00').padStart(2, '0');
  return `${sign}${h}:${min}`;
}

export function melbourneWallClockToAwareIso(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  ss = 0,
): string {
  const utcMs = melbourneWallClockToUtcMs(y, mo, d, hh, mm, ss);
  if (utcMs == null) {
    const off = melbourneOffsetIsoSuffix(Date.UTC(y, mo - 1, d, 12, 0, 0));
    return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${off}`;
  }
  const off = melbourneOffsetIsoSuffix(utcMs);
  return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${off}`;
}

export function melbourneAwareIsoFromDateTimeLocal(dateTimeLocal: string): string | null {
  const [datePart, timePart] = dateTimeLocal.trim().split('T');
  if (!datePart || !timePart) return null;
  const [ys, mos, ds] = datePart.split('-');
  const [hs, ms, ...rest] = timePart.split(':');
  const y = Math.floor(Number(ys));
  const mo = Math.floor(Number(mos));
  const d = Math.floor(Number(ds));
  const hh = Math.floor(Number(hs));
  const mm = Math.floor(Number(ms));
  const sec = rest.length ? Math.floor(Number(rest[0])) : 0;
  if (![y, mo, d, hh, mm, sec].every(Number.isFinite)) return null;
  return melbourneWallClockToAwareIso(y, mo, d, hh, mm, sec);
}

export function melbourneNowWallParts(): WallParts {
  return readMelbourneWallParts(Date.now());
}

export function toMelbourneDateTimeInputValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = readMelbourneWallParts(d.getTime());
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.min)}`;
}

export function splitMelbourneDateTimeParts(iso?: string | null): { date: string; time: string } {
  const dt = toMelbourneDateTimeInputValue(iso);
  if (!dt) return { date: '', time: '' };
  const [date, time] = dt.split('T');
  return { date: date || '', time: time || '' };
}

/** Offset from now in Melbourne wall clock → aware ISO. */
export function melbourneAwareIsoFromNowOffset(minutesFromNow: number): string {
  const p = melbourneNowWallParts();
  const baseMs = melbourneWallClockToUtcMs(p.y, p.m, p.d, p.h, p.min, 0) ?? Date.now();
  const ms = baseMs + minutesFromNow * 60 * 1000;
  const p2 = readMelbourneWallParts(ms);
  return melbourneWallClockToAwareIso(p2.y, p2.m, p2.d, p2.h, p2.min, 0);
}

export function formatRelativeDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = melbourneNowWallParts();
  const target = readMelbourneWallParts(d.getTime());
  const todayStr = `${now.y}-${pad2(now.m)}-${pad2(now.d)}`;
  const tomorrowMs = Date.UTC(now.y, now.m - 1, now.d + 1);
  const tomorrow = readMelbourneWallParts(tomorrowMs);
  const tomorrowStr = `${tomorrow.y}-${pad2(tomorrow.m)}-${pad2(tomorrow.d)}`;
  const targetStr = `${target.y}-${pad2(target.m)}-${pad2(target.d)}`;
  const timePart = d.toLocaleTimeString('en-AU', TIME_OPTS);
  if (targetStr === todayStr) return `Today, ${timePart}`;
  if (targetStr === tomorrowStr) return `Tomorrow, ${timePart}`;
  return `${pad2(target.d)}/${pad2(target.m)}/${target.y}, ${timePart}`;
}

export function formatStayLimitShort(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(Number(mins))) return null;
  const n = Number(mins);
  if (n === 60) return '1 hr';
  if (n === 90) return '1.5 hr';
  if (n % 60 === 0) return `${n / 60} hr`;
  return `${n} min`;
}

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

export function formatMelbourneDate(iso?: string | null): string {
  const d = new Date(iso ?? Date.now());
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-AU', SHOWING_DATE_OPTS).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('weekday')}, ${get('day')}/${get('month')}/${get('year')}`;
  } catch {
    return '';
  }
}

export function formatMelbourneTime(iso?: string | null): string {
  const d = new Date(iso ?? Date.now());
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('en-AU', TIME_OPTS).toUpperCase();
  } catch {
    return '';
  }
}

/** Chip label for filter sheet date button — "Sun, 05/19/2026". */
export function formatArrivalDateChipLabel(iso?: string | null): string {
  if (!iso) return 'Date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date';
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parts = readMelbourneWallParts(d.getTime());
  const dow = dayAbbr[new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay()];
  return `${dow}, ${pad2(parts.m)}/${pad2(parts.d)}/${parts.y}`;
}

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

/** Shared duration minutes for filters + bay evaluation. */
export const DURATION_FILTER_TO_MINS: Record<string, number> = {
  '15m': 15,
  '15min': 15,
  '30m': 30,
  '30min': 30,
  '1h': 60,
  '2h': 120,
  '3h': 180,
  '4h': 240,
};

export function isFuturePlanningArrival(iso?: string | null): boolean {
  if (!iso) return false;
  const planned = new Date(iso);
  if (Number.isNaN(planned.getTime())) return false;
  return planned.getTime() > Date.now() + 60_000;
}
