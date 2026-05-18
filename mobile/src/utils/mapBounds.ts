import type { PressureBounds } from '../services/apiPressure';

/** Match web MapPage bounds jitter thresholds. */
export const BOUNDS_EDGE_EPS_DEG = 0.00035;
export const BOUNDS_AREA_EPS_RATIO = 0.02;

export function boundsArea(b: PressureBounds): number {
  const h = Math.max(0, (b.north ?? 0) - (b.south ?? 0));
  const w = Math.max(0, (b.east ?? 0) - (b.west ?? 0));
  return h * w;
}

export function isSignificantBoundsChange(
  prev: PressureBounds | null,
  next: PressureBounds,
): boolean {
  if (!prev) return true;
  const maxEdgeDelta = Math.max(
    Math.abs(next.north - prev.north),
    Math.abs(next.south - prev.south),
    Math.abs(next.east - prev.east),
    Math.abs(next.west - prev.west),
  );
  if (maxEdgeDelta >= BOUNDS_EDGE_EPS_DEG) return true;
  const prevArea = boundsArea(prev);
  const nextArea = boundsArea(next);
  const denom = Math.max(prevArea, 1e-9);
  return Math.abs(nextArea - prevArea) / denom >= BOUNDS_AREA_EPS_RATIO;
}

/** Mapbox MapState / RegionPayload visible bounds → API bbox. */
export function mapStateToPressureBounds(bounds: {
  ne: GeoJSON.Position;
  sw: GeoJSON.Position;
}): PressureBounds {
  const [east, north] = bounds.ne;
  const [west, south] = bounds.sw;
  return { west, south, east, north };
}

/** `getVisibleBounds()` returns [[rightLon, topLat], [leftLon, bottomLat]]. */
export function boundsToKey(bounds: PressureBounds | null | undefined): string {
  if (!bounds) return '';
  return `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
}

export function visibleBoundsPairToPressureBounds(
  pair: [GeoJSON.Position, GeoJSON.Position],
): PressureBounds {
  const [[east, north], [west, south]] = pair;
  return { west, south, east, north };
}

/** Legacy visibleBounds array from onRegionDidChange. */
export function visibleBoundsToPressureBounds(visibleBounds: GeoJSON.Position[]): PressureBounds | null {
  if (!visibleBounds || visibleBounds.length < 2) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const coord of visibleBounds) {
    const [lng, lat] = coord;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (!Number.isFinite(west)) return null;
  return { west, south, east, north };
}
