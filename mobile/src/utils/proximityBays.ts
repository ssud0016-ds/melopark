import type { Bay } from '../services/apiBays';
import { haversineMeters, SEARCH_RADIUS_M, type LatLng } from './mapGeo';

export type ProximityFreeCounts = {
  proxFreeBays: number;
  proxFreeSpots: number;
};

export function baysWithinRadius(
  bays: Bay[],
  center: LatLng,
  radiusM = SEARCH_RADIUS_M,
): Bay[] {
  return bays.filter(
    (b) => haversineMeters(b.lat, b.lng, center.lat, center.lng) < radiusM,
  );
}

export function proximityFreeCounts(
  bays: Bay[],
  center: LatLng | null,
  radiusM = SEARCH_RADIUS_M,
): ProximityFreeCounts {
  if (!center) return { proxFreeBays: 0, proxFreeSpots: 0 };
  const available = baysWithinRadius(bays, center, radiusM).filter((b) => b.type === 'available');
  return {
    proxFreeBays: available.length,
    proxFreeSpots: available.reduce((sum, bay) => sum + (bay.free || 0), 0),
  };
}

/** Compact label for ScopeStrip chip. */
export function formatProximityChipLabel(
  counts: ProximityFreeCounts,
  radiusM = SEARCH_RADIUS_M,
): string {
  const { proxFreeBays, proxFreeSpots } = counts;
  const n = proxFreeSpots === proxFreeBays ? proxFreeBays : proxFreeSpots;
  return `${n} free · ${radiusM}m`;
}

/** Full label matching web MapPage copy; null when no free bays. */
export function formatProximityDetailLabel(
  counts: ProximityFreeCounts,
  radiusM = SEARCH_RADIUS_M,
): string | null {
  const { proxFreeBays, proxFreeSpots } = counts;
  if (proxFreeBays === 0) return null;
  if (proxFreeSpots === proxFreeBays) {
    return `${proxFreeBays} free bay${proxFreeBays !== 1 ? 's' : ''} within ${radiusM} m`;
  }
  return `${proxFreeSpots} free spot${proxFreeSpots !== 1 ? 's' : ''} across ${proxFreeBays} bay${proxFreeBays !== 1 ? 's' : ''} within ${radiusM} m`;
}
