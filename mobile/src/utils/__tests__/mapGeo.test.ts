import { boundsFromLatLngs } from '../mapGeo';

describe('mapGeo boundsFromLatLngs', () => {
  test('wraps two CBD points with non-zero span', () => {
    const dest = { lat: -37.8136, lng: 144.9631 };
    const alt = { lat: -37.8123, lng: 144.9612 };
    const bounds = boundsFromLatLngs([dest, alt]);
    expect(bounds).not.toBeNull();
    const [neLng, neLat] = bounds!.ne;
    const [swLng, swLat] = bounds!.sw;
    expect(neLat).toBeGreaterThan(swLat);
    expect(neLng).toBeGreaterThan(swLng);
    expect(neLat - swLat).toBeGreaterThanOrEqual(0.001);
    expect(neLng - swLng).toBeGreaterThanOrEqual(0.001);
  });

  test('expands degenerate single-point bounds', () => {
    const p = { lat: -37.81, lng: 144.96 };
    const bounds = boundsFromLatLngs([p]);
    expect(bounds).not.toBeNull();
    expect(bounds!.ne[1] - bounds!.sw[1]).toBeCloseTo(0.001, 5);
    expect(bounds!.ne[0] - bounds!.sw[0]).toBeCloseTo(0.001, 5);
  });

  test('returns null for empty input', () => {
    expect(boundsFromLatLngs([])).toBeNull();
  });
});
