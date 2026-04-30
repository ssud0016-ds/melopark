/**
 * API layer for Epic 5 parking pressure endpoints.
 */

export async function fetchPressure(at = null, horizon = 'now') {
  const params = new URLSearchParams({ horizon })
  if (at) params.set('at', at)
  const resp = await fetch(`/api/pressure?${params}`)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Pressure API ${resp.status}: ${detail}`)
  }
  return resp.json()
}

export async function fetchAlternatives(lat, lon, at = null, radius = 800, limit = 3) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(radius),
    limit: String(limit),
  })
  if (at) params.set('at', at)
  const resp = await fetch(`/api/pressure/alternatives?${params}`)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Alternatives API ${resp.status}: ${detail}`)
  }
  const data = await resp.json()
  // Normalize: backend returns target_zone, frontend expects target
  return { target: data.target_zone, alternatives: data.alternatives }
}

export async function fetchZoneHulls() {
  const resp = await fetch('/api/pressure/zones/geojson')
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Zone hulls API ${resp.status}: ${detail}`)
  }
  return resp.json()
}
