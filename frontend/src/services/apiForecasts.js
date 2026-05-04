/**
 * apiForecasts.js
 * ===============
 * API layer for Epic 6 Predictive Parking Intelligence endpoints.
 *
 * All functions talk to /api/forecasts/* on the FastAPI backend.
 * They follow the same error-throwing pattern as apiPressure.js
 * so callers can catch uniformly.
 */

/**
 * US 6.1 -- Fetch peak-time and event warnings for the next N hours.
 *
 * @param {number} hours - Hours ahead to forecast (1-12, default 6)
 * @returns {Promise<{generated_at, hours_ahead, data_source, warnings[]}>}
 */
export async function fetchForecastWarnings(hours = 6) {
  const params = new URLSearchParams({ hours: String(hours) })
  const resp = await fetch(`/api/forecasts/warnings?${params}`)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Forecast warnings API ${resp.status}: ${detail}`)
  }
  return resp.json()
}

/**
 * Fetch predicted zone pressure at a given arrival datetime.
 *
 * @param {string|null} at - ISO-8601 arrival datetime, or null for now
 * @returns {Promise<{generated_at, arrival_at, data_source, zones[]}>}
 */
export async function fetchForecastPressure(at = null) {
  const params = new URLSearchParams()
  if (at) params.set('at', at)
  const resp = await fetch(`/api/forecasts/pressure?${params}`)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Forecast pressure API ${resp.status}: ${detail}`)
  }
  return resp.json()
}

/**
 * US 6.2 -- Fetch alternative zone recommendations for a destination.
 *
 * @param {number} lat - Destination latitude
 * @param {number} lon - Destination longitude
 * @param {string|null} at - ISO-8601 arrival datetime, or null for now
 * @param {number} radius - Search radius in metres (default 1500)
 * @param {number} limit - Max alternatives (default 3)
 * @returns {Promise<{target_zone, alternatives[], at, generated_at}>}
 */
export async function fetchForecastAlternatives(lat, lon, at = null, radius = 1500, limit = 3) {
  const params = new URLSearchParams({
    lat:    String(lat),
    lon:    String(lon),
    radius: String(radius),
    limit:  String(limit),
  })
  if (at) params.set('at', at)
  const resp = await fetch(`/api/forecasts/alternatives?${params}`)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Forecast alternatives API ${resp.status}: ${detail}`)
  }
  return resp.json()
}

/**
 * Fetch event risk scores per zone (next 48 hours).
 *
 * @returns {Promise<{generated_at, event_risks[]}>}
 */
export async function fetchForecastEventRisk() {
  const resp = await fetch('/api/forecasts/events')
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`Forecast events API ${resp.status}: ${detail}`)
  }
  return resp.json()
}
