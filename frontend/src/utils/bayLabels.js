/**
 * Display labels for kerbside bays (street name from API when present).
 */

/** Primary heading: street name, or `Bay #id` when the feed has no street label. */
export function bayHeading(bay) {
  const id = bay?.id != null ? String(bay.id) : ''
  const name = typeof bay?.name === 'string' ? bay.name.trim() : ''
  if (name) return name
  return id ? `Bay #${id}` : 'Bay'
}

/** Muted subtitle when street name is missing; otherwise null. */
export function bayMissingStreetNote(bay) {
  const name = typeof bay?.name === 'string' ? bay.name.trim() : ''
  if (name) return null
  return 'Street not listed in data'
}

/** Live occupancy label for the signal row. Drives off bay.free (sensor). */
export function liveOccupancyLabel(bay) {
  if (bay?.free === 1) return 'Free'
  if (bay?.free === 0) return 'Taken'
  return 'No sensor'
}

/** Rules verdict label for the signal row. Drives off evaluation.verdict. */
export function rulesVerdictLabel(evaluation) {
  const v = evaluation?.verdict
  if (v === 'yes') return 'Allowed now'
  if (v === 'no') return 'Not allowed'
  return 'Unclear'
}

/**
 * Parse "X Street between A and B" -> "X Street (A to B)".
 * Falls back to original string when pattern does not match.
 */
export function streetShort(name) {
  if (typeof name !== 'string') return ''
  const trimmed = name.trim()
  if (!trimmed) return ''
  const m = trimmed.match(/^(.+?)\s+between\s+(.+?)\s+and\s+(.+)$/i)
  if (!m) return trimmed
  return `${m[1].trim()} (${m[2].trim()} to ${m[3].trim()})`
}
