import {
  BOUNDS_EDGE_EPS_DEG,
  boundsArea,
  isSignificantBoundsChange,
  mapStateToPressureBounds,
} from '../mapBounds';

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
});
