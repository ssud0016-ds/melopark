import type { Bay } from '../services/apiBays';
import { dedupeByKey } from './dedupeByKey';
import { isAccessibilityBay } from './isAccessibilityBay';
import { getStatusFillColor, type BayStatus } from './pressureSegmentStyle';

function bayStatusForColor(type: Bay['type']): BayStatus {
  if (type === 'trap') return 'caution';
  if (type === 'occupied') return 'occupied';
  if (type === 'available') return 'available';
  return 'unknown';
}

function statusColor(type: Bay['type'], cb: boolean): string {
  return getStatusFillColor(bayStatusForColor(type), cb);
}

/** Single clustered source; isAccessible 1|0 for layer filters (Android-safe). */
export function buildMapBayShape(
  bays: Bay[],
  colorBlindMode: boolean,
  accessibleIds?: string[],
): GeoJSON.FeatureCollection {
  const filterSet = accessibleIds && accessibleIds.length > 0 ? new Set(accessibleIds) : null;
  const filtered = bays.filter((b) => (filterSet ? filterSet.has(b.id) : true));
  const unique = dedupeByKey(filtered, (b) => String(b.id));

  return {
    type: 'FeatureCollection',
    features: unique.map((b) => ({
      type: 'Feature',
      id: b.id,
      properties: {
        bayId: b.id,
        type: b.type,
        color: statusColor(b.type, colorBlindMode),
        /** String flag — Mapbox Android preserves strings in cluster leaf props reliably. */
        isAccessible: filterSet || isAccessibilityBay(b) ? 'yes' : 'no',
      },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    })),
  };
}
