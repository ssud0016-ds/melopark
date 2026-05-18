export const SEARCH_RADIUS_M = 400;

const NORTH_LAT = -37.8055;
const SOUTH_LAT = -37.8225;
const WEST_LNG = 144.9475;
const EAST_LNG = 144.9745;

export const DEFAULT_MAP_CENTER: [number, number] = [144.9631, -37.8136];
export const DEFAULT_MAP_ZOOM = 13;
export const DESTINATION_MAP_ZOOM = 16;
/** Web MapPage handleQuietStreetClick flyTo zoom. */
export const QUIET_STREET_MAP_ZOOM = 18;
/** Web MapPage handleQuietStreetClick flyTo duration (seconds → ms). */
export const QUIET_STREET_FLY_MS = 800;

/** Default Melbourne CBD bbox for quiet-segment fetch before Mapbox reports viewport. */
export const DEFAULT_CBD_BOUNDS = {
  west: WEST_LNG,
  south: SOUTH_LAT,
  east: EAST_LNG,
  north: NORTH_LAT,
} as const;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isApproxCbd(lat: number, lng: number, pad = 0.015): boolean {
  return (
    lat >= SOUTH_LAT - pad &&
    lat <= NORTH_LAT + pad &&
    lng >= WEST_LNG - pad &&
    lng <= EAST_LNG + pad
  );
}

export function walkingMinutesFromMeters(m: number): number {
  return Math.max(1, Math.ceil(m / 80));
}

export type LatLng = { lat: number; lng: number };

export type MapLatLngBounds = {
  ne: [number, number];
  sw: [number, number];
};

const BOUNDS_MIN_SPAN_DEG = 0.001;

/** NE/SW corners for Mapbox Camera.fitBounds ([lng, lat] positions). */
export function boundsFromLatLngs(points: LatLng[]): MapLatLngBounds | null {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  if (maxLat - minLat < BOUNDS_MIN_SPAN_DEG) {
    const mid = (maxLat + minLat) / 2;
    minLat = mid - BOUNDS_MIN_SPAN_DEG / 2;
    maxLat = mid + BOUNDS_MIN_SPAN_DEG / 2;
  }
  if (maxLng - minLng < BOUNDS_MIN_SPAN_DEG) {
    const mid = (maxLng + minLng) / 2;
    minLng = mid - BOUNDS_MIN_SPAN_DEG / 2;
    maxLng = mid + BOUNDS_MIN_SPAN_DEG / 2;
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

/**
 * Approximate a geodesic circle as a 64-point GeoJSON Polygon.
 * Good enough for visual overlays at city scale (Mapbox warps it lat-correctly).
 */
export function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const earth = 6371000;
  const latRad = (centerLat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dx = (radiusMeters * Math.cos(theta)) / (earth * Math.cos(latRad));
    const dy = (radiusMeters * Math.sin(theta)) / earth;
    const lng = centerLng + (dx * 180) / Math.PI;
    const lat = centerLat + (dy * 180) / Math.PI;
    coords.push([lng, lat]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}
