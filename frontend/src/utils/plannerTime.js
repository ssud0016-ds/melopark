/** Display formats and planner arrival_iso: calendar clock in Australia/Melbourne. */

/** Default “how long I plan to park” when the planner has no stored value yet. */
export const DEFAULT_PLANNER_DURATION_MINS = 60

/** Canonical UI / API duration chips (minutes); order matches user-facing labels. */
export const PLANNER_DURATION_PRESETS_MINS = Object.freeze([30, 60, 90, 120, 180, 240])

const PLANNER_DURATION_PRESET_LABEL_BY_MINS = new Map(
  PLANNER_DURATION_PRESETS_MINS.map((m, i) => {
    const labels = ['30 min', '1 hr', '1.5 hr', '2 hr', '3 hr', '4 hr']
    return [m, labels[i]]
  }),
)

const MELBOURNE_TZ = 'Australia/Melbourne'

const DATE_OPTS = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: MELBOURNE_TZ,
}

const TIME_OPTS = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: MELBOURNE_TZ,
}

/** @param {number} utcMs */
function readMelbourneWallParts(utcMs) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const o = {}
  for (const { type, value } of f.formatToParts(new Date(utcMs))) {
    if (type !== 'literal') o[type] = value
  }
  return {
    y: Number(o.year),
    m: Number(o.month),
    d: Number(o.day),
    h: Number(o.hour),
    min: Number(o.minute),
    sec: Number(o.second),
  }
}

/** @param {{ y: number, m: number, d: number, h: number, min: number, sec: number }} a */
function cmpMelbourneWallParts(a, b) {
  const ta = [a.y, a.m, a.d, a.h, a.min, a.sec]
  const tb = [b.y, b.m, b.d, b.h, b.min, b.sec]
  for (let i = 0; i < 6; i += 1) {
    if (ta[i] < tb[i]) return -1
    if (ta[i] > tb[i]) return 1
  }
  return 0
}

/**
 * UTC milliseconds for an instant whose Melbourne civil time is (y, mo, d, hh, mm, ss).
 * Uses binary search — handles DST if the civil time exists.
 * @returns {number | null}
 */
export function melbourneWallClockToUtcMs(y, mo, d, hh, mm, ss = 0) {
  const target = { y, m: mo, d, h: hh, min: mm, sec: ss }
  let lo = Date.UTC(y, mo - 1, d, 0, 0, 0) - 18 * 3600 * 1000
  let hi = Date.UTC(y, mo - 1, d, 0, 0, 0) + 18 * 3600 * 1000
  while (cmpMelbourneWallParts(readMelbourneWallParts(lo), target) > 0) lo -= 3600 * 1000
  while (cmpMelbourneWallParts(readMelbourneWallParts(hi), target) < 0) hi += 3600 * 1000

  let best = null
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const c = cmpMelbourneWallParts(readMelbourneWallParts(mid), target)
    if (c === 0) {
      best = mid
      break
    }
    if (c < 0) lo = mid + 1
    else hi = mid - 1
  }
  return best
}

/**
 * Melbourne offset at instant as ±HH:MM for ISO-8601 suffix (Python fromisoformat compatible).
 * @param {number} utcMs
 */
export function melbourneOffsetIsoSuffix(utcMs) {
  const d = new Date(utcMs)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MELBOURNE_TZ,
    timeZoneName: 'longOffset',
  }).formatToParts(d)
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const normalized = raw.replace(/\u2212/g, '-')
  const m = normalized.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return '+10:00'
  const sign = m[1]
  const h = m[2].padStart(2, '0')
  const min = (m[3] ?? '00').padStart(2, '0')
  return `${sign}${h}:${min}`
}

const pad2 = (n) => String(n).padStart(2, '0')

/**
 * ISO-8601 string with explicit Australia/Melbourne offset for this wall-clock time.
 * @param {number} y
 * @param {number} mo 1–12
 * @param {number} d
 * @param {number} hh
 * @param {number} mm
 * @param {number} [ss]
 */
export function melbourneWallClockToAwareIso(y, mo, d, hh, mm, ss = 0) {
  const utcMs = melbourneWallClockToUtcMs(y, mo, d, hh, mm, ss)
  if (utcMs == null) {
    const off = melbourneOffsetIsoSuffix(Date.UTC(y, mo - 1, d, 12, 0, 0))
    return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${off}`
  }
  const off = melbourneOffsetIsoSuffix(utcMs)
  return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${off}`
}

/**
 * Parse `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss` as Melbourne wall clock → aware ISO.
 * @param {string} dateTimeLocal
 */
export function melbourneAwareIsoFromDateTimeLocal(dateTimeLocal) {
  const [datePart, timePart] = dateTimeLocal.trim().split('T')
  if (!datePart || !timePart) return null
  const [ys, mos, ds] = datePart.split('-')
  const [hs, ms, ...rest] = timePart.split(':')
  const y = Math.floor(Number(ys))
  const mo = Math.floor(Number(mos))
  const d = Math.floor(Number(ds))
  const hh = Math.floor(Number(hs))
  const mm = Math.floor(Number(ms))
  const sec = rest.length ? Math.floor(Number(rest[0])) : 0
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(mo) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm) ||
    !Number.isFinite(sec)
  )
    return null
  return melbourneWallClockToAwareIso(y, mo, d, hh, mm, sec)
}

/** Melbourne civil time parts for "now" (for defaults / inputs). */
export function melbourneNowWallParts() {
  return readMelbourneWallParts(Date.now())
}

/**
 * `YYYY-MM-DDTHH:mm` suitable for date/time inputs; digits are Melbourne wall clock.
 * @param {string | null | undefined} isoAwareOrUtc Optional instant (offset, Z, or parseable Date).
 */
export function toMelbourneDateTimeInputValue(iso) {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const p = readMelbourneWallParts(d.getTime())
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.min)}`
}

export function formatPlannerBannerDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', DATE_OPTS)
}

export function formatPlannerBannerTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-AU', TIME_OPTS)
}

/** "Tue 16 Apr, 4:30 PM" for "At …" labels and banner */
export function formatAtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const datePart = d.toLocaleDateString('en-AU', DATE_OPTS)
  const timePart = d.toLocaleTimeString('en-AU', TIME_OPTS)
  return `${datePart}, ${timePart}`
}

/** Next 15-minute boundary strictly in the future (Melbourne civil clock). */
export function nextQuarterHourDefaults() {
  const p = melbourneNowWallParts()
  const baseMs = melbourneWallClockToUtcMs(p.y, p.m, p.d, p.h, p.min, 0)
  if (baseMs == null) {
    return {
      dateStr: `${p.y}-${pad2(p.m)}-${pad2(p.d)}`,
      timeStr: `${pad2(p.h)}:${pad2(p.min)}`,
      iso: melbourneWallClockToAwareIso(p.y, p.m, p.d, p.h, p.min, 0),
      durationMins: DEFAULT_PLANNER_DURATION_MINS,
    }
  }
  const totalMin = p.h * 60 + p.min
  const rem = totalMin % 15
  const addMin = rem === 0 && p.sec === 0 ? 15 : 15 - rem
  const ms = baseMs + addMin * 60 * 1000
  const p2 = readMelbourneWallParts(ms)
  return {
    dateStr: `${p2.y}-${pad2(p2.m)}-${pad2(p2.d)}`,
    timeStr: `${pad2(p2.h)}:${pad2(p2.min)}`,
    iso: melbourneWallClockToAwareIso(p2.y, p2.m, p2.d, p2.h, p2.min, 0),
    durationMins: DEFAULT_PLANNER_DURATION_MINS,
  }
}

export function formatDurationLabel(mins) {
  const m = Number(mins)
  if (!Number.isFinite(m)) return ''
  const presetLabel = PLANNER_DURATION_PRESET_LABEL_BY_MINS.get(m)
  if (presetLabel != null) return presetLabel
  if (m < 60) return `${m} min`
  if (m % 60 === 0) return `${m / 60} hr`
  return `${m} min`
}

/** e.g. "2 hr" for "Stay limit:" row */
export function formatStayLimitShort(mins) {
  if (mins == null || !Number.isFinite(Number(mins))) return null
  const n = Number(mins)
  if (n === 60) return '1 hr'
  if (n === 90) return '1.5 hr'
  if (n % 60 === 0) return `${n / 60} hr`
  return `${n} min`
}

/** "6:30 PM" only */
export function formatLeaveByClock(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-AU', TIME_OPTS) || null
}
