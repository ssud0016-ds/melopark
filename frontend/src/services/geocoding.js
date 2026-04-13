/**
 * Geocoding service using OpenStreetMap Nominatim (free, no API key required).
 * Searches are automatically scoped to Melbourne, Victoria, Australia.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/**
 * Geocode a text query into a lat/lng location.
 *
 * @param {string} query - user-entered search string
 * @returns {Promise<{ lat: number, lng: number, name: string } | null>}
 *   Resolved location, or null if nothing was found.
 */
export async function geocode(query) {
  const params = new URLSearchParams({
    q: `${query.trim()}, Melbourne, Victoria, Australia`,
    format: 'json',
    limit: '1',
  })

  const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'MelOPark/1.0 (university project)' },
  })

  if (!resp.ok) throw new Error(`Geocoding request failed: ${resp.status}`)

  const results = await resp.json()
  if (results.length === 0) return null

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    name: results[0].display_name,
  }
}
