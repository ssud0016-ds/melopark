import type { Bay } from '../services/apiBays';

/** Stable key for map-visible bay fields — skip React/Mapbox refresh when unchanged. */
export function baysMapFingerprint(bays: Bay[]): string {
  if (bays.length === 0) return '';
  const parts = bays.map(
    (b) => `${b.id}:${b.type}:${b.free}:${b.lat.toFixed(6)}:${b.lng.toFixed(6)}`,
  );
  parts.sort();
  return parts.join('|');
}
