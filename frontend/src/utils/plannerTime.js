/** Display formats: Tue 16 Apr, 4:30 PM (Melbourne). */

const DATE_OPTS = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Australia/Melbourne',
}

const TIME_OPTS = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Australia/Melbourne',
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

/** Next 15-minute boundary strictly in the future (local clock). */
export function nextQuarterHourDefaults() {
  const d = new Date()
  const m = d.getMinutes()
  const rem = m % 15
  const add = rem === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0 ? 15 : 15 - rem
  d.setMinutes(m + add, 0, 0)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return {
    dateStr: `${y}-${mo}-${da}`,
    timeStr: `${hh}:${mm}`,
    iso: `${y}-${mo}-${da}T${hh}:${mm}:00`,
    durationMins: 60,
  }
}

export function formatDurationLabel(mins) {
  const m = Number(mins)
  if (!Number.isFinite(m)) return ''
  if (m === 30) return '30 min'
  if (m === 60) return '1 hr'
  if (m === 90) return '1.5 hr'
  if (m === 120) return '2 hr'
  if (m === 180) return '3 hr'
  if (m === 240) return '4 hr'
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
