// Melbourne CBD bounding box (WGS84). Normalised x ∈ [0,1] west→east, y ∈ [0,1] north→south.
const NORTH_LAT = -37.8055
const SOUTH_LAT = -37.8225
const WEST_LNG = 144.9475
const EAST_LNG = 144.9745

/** Walking / search radius used for filters and Leaflet Circle (metres). */
export const SEARCH_RADIUS_M = 400

export function normToLatLng(x, y) {
  const lat = NORTH_LAT + y * (SOUTH_LAT - NORTH_LAT)
  const lng = WEST_LNG + x * (EAST_LNG - WEST_LNG)
  return { lat, lng }
}

export function toLatLngTuple(ll) {
  return [ll.lat, ll.lng]
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function metersBetweenNormPoints(bx, by, dx, dy) {
  const b = normToLatLng(bx, by)
  const d = normToLatLng(dx, dy)
  return haversineMeters(b.lat, b.lng, d.lat, d.lng)
}

/** Lat/lng from a UI bay (live API has lat/lng; demo data uses x/y only). */
export function bayLatLng(bay) {
  if (typeof bay.lat === 'number' && typeof bay.lng === 'number') {
    return { lat: bay.lat, lng: bay.lng }
  }
  return normToLatLng(bay.x ?? 0.5, bay.y ?? 0.5)
}

export function metersBetweenBayAndDestination(bay, destination) {
  const b = bayLatLng(bay)
  const d = destinationLatLng(destination)
  return haversineMeters(b.lat, b.lng, d.lat, d.lng)
}

/** Lat/lng from destination (supports either real lat/lng or legacy x/y). */
export function destinationLatLng(destination) {
  if (!destination) return null
  if (typeof destination.lat === 'number' && typeof destination.lng === 'number') {
    return { lat: destination.lat, lng: destination.lng }
  }
  return normToLatLng(destination.x ?? 0.5, destination.y ?? 0.5)
}

/** Rough CBD bounds plus padding – filters live markers for map performance. */
const CBD_PAD = 0.015

export function isApproxCbd(lat, lng) {
  return (
    lat >= SOUTH_LAT - CBD_PAD &&
    lat <= NORTH_LAT + CBD_PAD &&
    lng >= WEST_LNG - CBD_PAD &&
    lng <= EAST_LNG + CBD_PAD
  )
}

export function walkingMinutesFromMeters(m) {
  return Math.max(1, Math.ceil(m / 80))
}

/** Default map view – CBD overview. */
export const DEFAULT_MAP_CENTER = toLatLngTuple(normToLatLng(0.52, 0.66))
export const DEFAULT_MAP_ZOOM = 15
export const DESTINATION_MAP_ZOOM = 17
