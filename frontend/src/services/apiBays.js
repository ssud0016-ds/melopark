/**
 * Frontend API layer for MeloPark parking data.
 *
 * Data-source policy (enforced here):
 *   - Sensor occupancy (free/occupied/unknown) → CoM sensor API, cached by backend
 *   - Bay type label (e.g. "Loading Zone", "Timed") → CoM restriction API, cached by backend
 *   - Street name → CoM sensor API field `roadsegmentdescription`
 *   - ALL rule decisions (verdict/reason/restriction) → GET /api/bays/{id}/evaluate
 *
 * This file MUST NOT contain any rule inference, regex guessing, or fake data.
 * Fields that have no real source are left absent (undefined) so UI can show
 * honest "not available" messages.
 */

/**
 * Map a raw `/api/parking` record into the bay object used by the frontend.
 *
 * ONLY real, API-backed fields are set here.
 * Rule decisions are NOT made here – they come from the evaluate endpoint.
 *
 * Fields:
 *   id              – CoM kerbside sensor ID (real)
 *   name            – Street name from CoM roadsegmentdescription, or null (real)
 *   type            – Visual map-dot category: available / trap / occupied
 *                     Derived from sensor status + bayType (both from real APIs).
 *                     Used ONLY for map dot colour – not for rule decisions.
 *   lat / lng       – GPS coordinates (real)
 *   spots           – Always 1; each CoM sensor monitors a single kerbside bay
 *   free            – 0 or 1 from sensor (real)
 *   bayType         – Raw CoM type string, e.g. "Loading Zone", "Timed", "Other"
 *   hasRules        – Mirrors `/api/parking` `has_restriction_data` (CoM restrictions
 *                     cache hit). Badge / sort / map counts only — Epic 2 verdicts
 *                     still come from `/api/bays/{id}/evaluate`.
 *   allowDetail     – Live bays may always open the detail sheet (evaluate).
 *   sensorLastUpdated – Timestamp from CoM sensor feed (real)
 *   source          – "live" when from API, "demo" when from static fallback
 */
export function mapApiRecordToBay(record) {
  const id = String(record.bay_id ?? record.bayid ?? '')
  const status = (record.status || 'unknown').toLowerCase()
  const isFree = status === 'free'
  const bayType = record.bay_type || 'Other'
  const hasRules = record.has_restriction_data === true

  // Map dot colour category – derived from real API data (not rule inference).
  // "trap" applies to absolute restrictions (Loading Zone, No Standing) which
  // the CoM restriction API classifies directly; no time logic is applied here.
  const isDefinitelyRestricted =
    bayType === 'Loading Zone' || bayType === 'No Standing' || bayType === 'Disabled'
  let type = 'occupied'
  if (isDefinitelyRestricted) type = 'trap'
  else if (isFree) type = 'available'

  return {
    id,
    name: record.street_name || null,   // null → UI uses ID-first title (see bayLabels.js)
    type,
    lat: record.lat,
    lng: record.lng,
    spots: 1,                           // CoM model: 1 sensor = 1 kerbside bay
    free: isFree ? 1 : 0,
    bayType,                            // raw CoM type string (real external API)
    durationMins: record.duration_mins ?? null,
    hasRules,
    allowDetail: true,
    sensorLastUpdated: record.last_updated ?? null,
    source: 'live',
  }
}

/**
 * Fetch live parking bays from `GET /api/parking`.
 * Returns an array of bay objects produced by mapApiRecordToBay.
 */
export async function fetchParkingBays() {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const url = `${base}/api/parking`
  // Avoid infinite loading overlays when the API socket hangs.
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), 10000)
  let res
  try {
    res = await fetch(url, { signal: ctrl.signal })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Parking API timeout after 10s. Check backend/proxy and retry.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      const d = body.detail ?? body.message
      if (Array.isArray(d)) {
        detail = d.map((x) => (typeof x === 'string' ? x : x.msg || JSON.stringify(x))).join(' ')
      } else if (d != null) {
        detail = String(d)
      }
    } catch {
      /* ignore */
    }
    const msg =
      res.status === 503
        ? 'Parking data is not ready yet – the server may still be loading sensors.'
        : `Could not load bays (${res.status})${detail ? `: ${detail}` : ''}`
    throw new Error(msg)
  }
  const records = await res.json()
  if (!Array.isArray(records)) throw new Error('Unexpected API response shape')
  return records.map(mapApiRecordToBay)
}

/**
 * Fetch rule evaluation for a single bay from `GET /api/bays/{bayId}/evaluate`.
 *
 * Returns the BayEvaluation object, or null if the request fails.
 *
 * Response fields:
 *   verdict          – "yes" | "no" | "unknown"
 *   reason           – plain-English explanation (always present)
 *   active_restriction – { typedesc, rule_category, plain_english,
 *                          max_stay_mins, expires_at } | null
 *   warning          – { description, ... } | null
 *   data_source      – "db" | "api_fallback" | "unknown"
 */
/**
 * @param {string} bayId
 * @param {{ arrivalIso?: string | null, durationMins?: number | null } | null} [options]
 * Omit or null for live (server uses now + default duration).
 *
 * Time contract:
 *   - Prefer timezone-aware ISO-8601 with explicit offset (e.g. +10:00/+11:00 or Z); the app sends Melbourne offset from planner UI.
 *   - Naive strings (no offset) remain supported: backend interprets them as Australia/Melbourne local wall time.
 */
export async function fetchBayEvaluation(bayId, options = null) {
  if (!bayId) return null
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams()
  if (options?.arrivalIso) params.set('arrival_iso', options.arrivalIso)
  if (options?.durationMins != null) params.set('duration_mins', String(options.durationMins))
  const qs = params.toString()
  const url = `${base}/api/bays/${encodeURIComponent(bayId)}/evaluate${qs ? `?${qs}` : ''}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data ?? null
  } catch {
    return null
  }
}

/**
 * Bulk verdicts for map colouring. bbox: south,west,north,east (WGS84).
 * @param {string} bbox
 * @param {{ arrivalIso: string, durationMins: number }} options
 * @returns {Promise<Array<{ bay_id: string, lat?: number, lon?: number, verdict: string }>>}
 */
export async function fetchEvaluateBulk(bbox, options) {
  if (!bbox || !options?.arrivalIso || options.durationMins == null) return []
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('bbox', bbox)
  params.set('arrival_iso', options.arrivalIso)
  params.set('duration_mins', String(options.durationMins))
  const url = `${base}/api/bays/evaluate-bulk?${params.toString()}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * Fetch nearby disability-only bays around a destination point.
 * Backend: GET /api/accessibility/nearby
 */
export async function fetchAccessibilityNearby({
  lat,
  lon,
  radiusM = 500,
  topN = 20,
  availableOnly = false,
}) {
  if (lat == null || lon == null) return null
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('lat', String(lat))
  params.set('lon', String(lon))
  params.set('radius_m', String(radiusM))
  params.set('top_n', String(topN))
  params.set('available_only', String(Boolean(availableOnly)))
  const url = `${base}/api/accessibility/nearby?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      const d = body?.detail
      if (Array.isArray(d)) {
        detail = d.map((x) => (typeof x === 'string' ? x : x?.msg || JSON.stringify(x))).join(' ')
      } else if (d != null) {
        detail = typeof d === 'string' ? d : JSON.stringify(d)
      }
    } catch {
      // ignore
    }
    throw new Error(`Could not load accessibility bays (${res.status})${detail ? `: ${detail}` : ''}`)
  }
  const data = await res.json()
  return data && typeof data === 'object' ? data : null
}

export async function fetchAccessibilityPoints({ topN = 5000 } = {}) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('top_n', String(topN))
  const url = `${base}/api/accessibility/points?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      const d = body?.detail
      detail = d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d))
    } catch {
      // ignore
    }
    throw new Error(`Could not load accessibility points (${res.status})${detail ? `: ${detail}` : ''}`)
  }
  const data = await res.json()
  return data && typeof data === 'object' ? data : { total_points: 0, points: [] }
}

/**
 * Fetch all disability-only bays from Epic 4 accessibility gold output.
 * Backend: GET /api/accessibility/all
 */
export async function fetchAccessibilityAll({ topN = 5000, availableOnly = false } = {}) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('top_n', String(topN))
  params.set('available_only', String(Boolean(availableOnly)))
  const url = `${base}/api/accessibility/all?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      const d = body?.detail
      detail = d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d))
    } catch {
      // ignore
    }
    throw new Error(`Could not load accessibility bays (${res.status})${detail ? `: ${detail}` : ''}`)
  }
  const data = await res.json()
  return data && typeof data === 'object' ? data : { total_candidates: 0, returned: 0, bays: [] }
}
