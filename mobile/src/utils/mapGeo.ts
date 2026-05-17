export const SEARCH_RADIUS_M = 400;

const NORTH_LAT = -37.8055;
const SOUTH_LAT = -37.8225;
const WEST_LNG = 144.9475;
const EAST_LNG = 144.9745;

export const DEFAULT_MAP_CENTER: [number, number] = [144.9631, -37.8136];
export const DEFAULT_MAP_ZOOM = 13;
export const DESTINATION_MAP_ZOOM = 16;

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
