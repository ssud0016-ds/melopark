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
