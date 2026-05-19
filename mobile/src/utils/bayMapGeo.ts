import type { Bay } from '../services/apiBays';
import { dedupeByKey } from './dedupeByKey';
import { isAccessibilityBay } from './isAccessibilityBay';
import { getStatusFillColor, type BayStatus } from './pressureSegmentStyle';

function liveStatusColor(bay: Bay, colorBlindMode: boolean): string {
  const status: BayStatus =
    bay.type === 'occupied'
      ? 'occupied'
      : bay.type === 'trap'
        ? bay.free
          ? 'available'
          : 'occupied'
        : 'available';
  return getStatusFillColor(status, colorBlindMode);
}

function verifiedBayColor(
  bay: Bay,
  plannerMapActive: boolean,
  verdictByBayId: Record<string, string> | undefined,
  colorBlindMode: boolean,
): string {
  if (plannerMapActive && verdictByBayId) {
    const pv = verdictByBayId[bay.id];
    if (pv === 'yes') {
      return getStatusFillColor(bay.free === 1 ? 'available' : 'occupied', colorBlindMode);
    }
    if (pv === 'no') return getStatusFillColor('occupied', colorBlindMode);
    return getStatusFillColor('unknown', colorBlindMode);
  }
  return liveStatusColor(bay, colorBlindMode);
}

/** Single clustered source; isAccessible 1|0 for layer filters (Android-safe). */
export function buildMapBayShape(
  bays: Bay[],
  colorBlindMode: boolean,
  accessibleIds?: string[],
  options?: {
    plannerMapActive?: boolean;
    verdictByBayId?: Record<string, string>;
  },
): GeoJSON.FeatureCollection {
  const filterSet = accessibleIds && accessibleIds.length > 0 ? new Set(accessibleIds) : null;
  const filtered = bays.filter((b) => (filterSet ? filterSet.has(b.id) : true));
  const unique = dedupeByKey(filtered, (b) => String(b.id));
  const plannerActive = Boolean(options?.plannerMapActive && options?.verdictByBayId);

  return {
    type: 'FeatureCollection',
    features: unique.map((b) => ({
      type: 'Feature',
      id: b.id,
      properties: {
        bayId: b.id,
        type: b.type,
        color: verifiedBayColor(b, plannerActive, options?.verdictByBayId, colorBlindMode),
        /** String flag — Mapbox Android preserves strings in cluster leaf props reliably. */
        isAccessible: filterSet || isAccessibilityBay(b) ? 'yes' : 'no',
      },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    })),
  };
}
