import type { Bay } from '../../services/apiBays';
import {
  baysWithinRadius,
  formatProximityChipLabel,
  formatProximityDetailLabel,
  proximityFreeCounts,
} from '../proximityBays';
import { SEARCH_RADIUS_M } from '../mapGeo';

const center = { lat: -37.8136, lng: 144.9631 };

function bay(
  id: string,
  lat: number,
  lng: number,
  type: Bay['type'] = 'available',
  free: 0 | 1 = 1,
): Bay {
  return {
    id,
    name: null,
    type,
    lat,
    lng,
    spots: 1,
    free,
    bayType: 'Other',
    durationMins: null,
    hasRules: true,
    allowDetail: true,
    sensorLastUpdated: null,
    source: 'live',
  };
}

describe('proximityBays', () => {
  test('filters bays within radius using haversine', () => {
    const close = bay('1', center.lat + 0.0001, center.lng);
    const far = bay('2', center.lat + 0.01, center.lng, 'available', 1);
    const inRadius = baysWithinRadius([close, far], center);
    expect(inRadius.map((b) => b.id)).toEqual(['1']);
  });

  test('counts available bays and free spots within radius', () => {
    const bays = [
      bay('1', center.lat, center.lng),
      bay('2', center.lat + 0.0002, center.lng),
      bay('3', center.lat + 0.0003, center.lng, 'occupied', 0),
    ];
    expect(proximityFreeCounts(bays, center)).toEqual({
      proxFreeBays: 2,
      proxFreeSpots: 2,
    });
  });

  test('returns zero counts when center is null', () => {
    expect(proximityFreeCounts([bay('1', center.lat, center.lng)], null)).toEqual({
      proxFreeBays: 0,
      proxFreeSpots: 0,
    });
  });

  test('formatProximityChipLabel uses compact copy', () => {
    expect(formatProximityChipLabel({ proxFreeBays: 3, proxFreeSpots: 3 })).toBe(
      `3 free · ${SEARCH_RADIUS_M}m`,
    );
    expect(formatProximityChipLabel({ proxFreeBays: 2, proxFreeSpots: 3 })).toBe(
      `3 free · ${SEARCH_RADIUS_M}m`,
    );
  });

  test('formatProximityDetailLabel matches web pluralization', () => {
    expect(formatProximityDetailLabel({ proxFreeBays: 1, proxFreeSpots: 1 })).toBe(
      `1 free bay within ${SEARCH_RADIUS_M} m`,
    );
    expect(formatProximityDetailLabel({ proxFreeBays: 2, proxFreeSpots: 2 })).toBe(
      `2 free bays within ${SEARCH_RADIUS_M} m`,
    );
    expect(formatProximityDetailLabel({ proxFreeBays: 0, proxFreeSpots: 0 })).toBeNull();
  });
});
