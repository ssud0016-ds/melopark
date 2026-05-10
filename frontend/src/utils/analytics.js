/**
 * Minimal analytics counter shim. Epic 7 §5.
 *
 * In-memory counters; pluggable later. Errors swallowed.
 */

const counters = Object.create(null)
const events = []

/**
 * @param {string} event
 * @param {Record<string, unknown>} [props]
 */
export function track(event, props = {}) {
  try {
    counters[event] = (counters[event] || 0) + 1
    events.push({ event, props, ts: Date.now() })
    if (
      typeof process !== 'undefined' &&
      process.env &&
      process.env.NODE_ENV !== 'production'
    ) {
      // eslint-disable-next-line no-console
      console.debug?.('[analytics]', event, props)
    }
  } catch {
    /* swallow */
  }
}

export function getCounters() {
  return { ...counters }
}

export function getEvents() {
  return events.slice()
}

export function resetCounters() {
  for (const k of Object.keys(counters)) delete counters[k]
  events.length = 0
}
