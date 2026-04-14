/**
 * Fetches live parking bays from the MeloPark FastAPI backend (`GET /api/parking`).
 * In dev, use Vite proxy (empty VITE_API_URL) so requests go to the same origin.
 */

function inferLimitType(bayType) {
  const t = (bayType || '').toLowerCase()
  if (/\b4\s*p\b|4\s*hour|4h\b/i.test(t)) return '4p'
  if (/\b3\s*p\b|3\s*hour|3h\b/i.test(t)) return '3p'
  if (/\b2\s*p\b|2\s*hour|2h\b/i.test(t)) return '2p'
  if (bayType === 'Timed') return '2p'
  return '2p'
}

function buildTimeline(status, bayType) {
  const free = status === 'free'
  return [
    {
      time: 'Now',
      desc: free
        ? 'Sensor reports this bay is unoccupied'
        : status === 'occupied'
          ? 'Sensor reports a vehicle is present'
          : 'Sensor status unclear — treat as occupied until verified',
      on: free,
    },
    {
      time: 'Rules',
      desc: `${bayType}: always confirm times and fees on posted street signage.`,
      on: false,
    },
  ]
}

export function mapApiRecordToBay(record) {
  const id = String(record.bay_id ?? record.bayid ?? '')
  const status = (record.status || 'unknown').toLowerCase()
  const isFree = status === 'free'
  const bayType = record.bay_type || 'Other'
  const isTrap = bayType === 'Loading Zone' || bayType === 'No Standing'

  let type = 'occupied'
  if (isTrap) type = 'trap'
  else if (isFree) type = 'available'

  const limitType = inferLimitType(bayType)

  return {
    id,
    name: `CBD Bay ${id}`,
    type,
    limitType,
    lat: record.lat,
    lng: record.lng,
    spots: 1,
    free: isFree ? 1 : 0,
    desc: `${bayType} — live sensor: ${status}.`,
    tags: [bayType, isFree ? 'Unoccupied' : 'Occupied'],
    safe: isTrap
      ? 'Restricted category — read signs before parking'
      : isFree
        ? 'Sensor shows bay free now'
        : 'Sensor shows bay in use',
    limit: bayType,
    cost: 'See meter / PayStay / signage',
    applies: 'City of Melbourne on-street rules',
    warn: isTrap
      ? 'Loading or no-standing zones can incur heavy fines — check posted times.'
      : null,
    timeline: buildTimeline(status, bayType),
    sensorLastUpdated: record.last_updated ?? null,
    source: 'live',
  }
}

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
