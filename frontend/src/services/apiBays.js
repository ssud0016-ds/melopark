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
 * Rule decisions are NOT made here — they come from the evaluate endpoint.
 *
 * Fields:
 *   id              – CoM kerbside sensor ID (real)
 *   name            – Street name from CoM roadsegmentdescription, or null (real)
 *   type            – Visual map-dot category: available / trap / occupied
 *                     Derived from sensor status + bayType (both from real APIs).
 *                     Used ONLY for map dot colour — not for rule decisions.
 *   lat / lng       – GPS coordinates (real)
 *   spots           – Always 1; each CoM sensor monitors a single kerbside bay
 *   free            – 0 or 1 from sensor (real)
 *   bayType         – Raw CoM type string, e.g. "Loading Zone", "Timed", "Other"
 *   sensorLastUpdated – Timestamp from CoM sensor feed (real)
 *   source          – "live" when from API, "demo" when from static fallback
 */
export function mapApiRecordToBay(record) {
  const id = String(record.bay_id ?? record.bayid ?? '')
  const status = (record.status || 'unknown').toLowerCase()
  const isFree = status === 'free'
  const bayType = record.bay_type || 'Other'

  // Map dot colour category — derived from real API data (not rule inference).
  // "trap" applies to absolute restrictions (Loading Zone, No Standing) which
  // the CoM restriction API classifies directly; no time logic is applied here.
  const isDefinitelyRestricted =
    bayType === 'Loading Zone' || bayType === 'No Standing' || bayType === 'Disabled'
  let type = 'occupied'
  if (isDefinitelyRestricted) type = 'trap'
  else if (isFree) type = 'available'

  return {
    id,
    name: record.street_name || null,   // null → UI shows "Unnamed Bay"
    type,
    lat: record.lat,
    lng: record.lng,
    spots: 1,                           // CoM model: 1 sensor = 1 kerbside bay
    free: isFree ? 1 : 0,
    bayType,                            // raw CoM type string (real external API)
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
  const res = await fetch(url)
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
        ? 'Parking data is not ready yet — the server may still be loading sensors.'
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
export async function fetchBayEvaluation(bayId) {
  if (!bayId) return null
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const url = `${base}/api/bays/${encodeURIComponent(bayId)}/evaluate`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data ?? null
  } catch {
    return null
  }
}
