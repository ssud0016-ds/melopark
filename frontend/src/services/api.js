/**
 * API client for the FastAPI backend.
 *
 * In development, defaults to localhost:8000.
 * In production, set VITE_API_URL to the deployed backend URL.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchJSON(path, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })

  const resp = await fetch(url.toString())

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || `API error ${resp.status}`)
  }

  return resp.json()
}


/**
 * Returns a flat array of simplified bay objects:
 * [{ bay_id, lat, lng, status, last_updated }, ...]
 */
export async function getParkingBays() {
  return fetchJSON(`${BASE_URL}/api/parking`)
}

export async function getRestrictions(bayId) {
  return fetchJSON(`${BASE_URL}/restrictions/${bayId}`)
}

export async function translateRestriction(bayId, { arrival, duration } = {}) {
  return fetchJSON(`${BASE_URL}/restrictions/${bayId}/translate`, {
    arrival,
    duration,
  })
}

export async function healthCheck() {
  return fetchJSON(`${BASE_URL}/health`)
}
