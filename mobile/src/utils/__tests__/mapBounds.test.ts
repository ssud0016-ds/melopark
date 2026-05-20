import type { Bay } from '../../services/apiBays';
import {
  BOUNDS_EDGE_EPS_DEG,
  boundsArea,
  cullBaysToBounds,
  isSignificantBoundsChange,
  mapStateToPressureBounds,
} from '../mapBounds';

function bay(id: string, lat: number, lng: number): Bay {
  return {
    id,
    name: null,
    type: 'available',
    lat,
    lng,
    spots: 1,
    free: 1,
    bayType: 'Other',
    durationMins: null,
    hasRules: false,
    allowDetail: true,
    sensorLastUpdated: null,
    source: 'live',
  };
}

describe('mapBounds', () => {
  test('mapStateToPressureBounds converts ne/sw', () => {
    expect(
      mapStateToPressureBounds({
        ne: [144.97, -37.8],
        sw: [144.94, -37.82],
      }),
    ).toEqual({ west: 144.94, south: -37.82, east: 144.97, north: -37.8 });
  });

  test('isSignificantBoundsChange on first bounds', () => {
    const b = { west: 144.94, south: -37.82, east: 144.97, north: -37.8 };
    expect(isSignificantBoundsChange(null, b)).toBe(true);
  });

  test('ignores tiny pan below edge epsilon', () => {
    const prev = { west: 144.94, south: -37.82, east: 144.97, north: -37.8 };
    const next = {
      west: prev.west + BOUNDS_EDGE_EPS_DEG / 2,
      south: prev.south,
      east: prev.east,
      north: prev.north,
    };
    expect(isSignificantBoundsChange(prev, next)).toBe(false);
  });

  test('boundsArea', () => {
    const b = { west: 0, south: 0, east: 1, north: 1 };
    expect(boundsArea(b)).toBe(1);
  });

  test('cullBaysToBounds keeps in-view and padded neighbours', () => {
    const bounds = { west: 144.94, south: -37.82, east: 144.97, north: -37.8 };
    const inside = bay('in', -37.81, 144.955);
    const outside = bay('out', -38.0, 145.5);
    const culled = cullBaysToBounds([inside, outside], bounds, 0);
    expect(culled.map((b) => b.id)).toEqual(['in']);
  });
});
