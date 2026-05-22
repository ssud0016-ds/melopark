import { boundsFromLatLngs, DEFAULT_MAP_CENTER, normToLatLng } from '../mapGeo';

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

describe('normToLatLng / DEFAULT_MAP_CENTER', () => {
  test('DEFAULT_MAP_CENTER is Mapbox lng,lat from web norm 0.52, 0.66', () => {
    const ll = normToLatLng(0.52, 0.66);
    expect(DEFAULT_MAP_CENTER[0]).toBeCloseTo(ll.lng, 10);
    expect(DEFAULT_MAP_CENTER[1]).toBeCloseTo(ll.lat, 10);
  });

  /** Web mobile Leaflet default — same norm point as native Mapbox initial camera. */
  test('DEFAULT_MAP_CENTER matches web mobile CBD overview WGS84', () => {
    const ll = normToLatLng(0.52, 0.66);
    expect(ll.lat).toBeCloseTo(-37.817, 2);
    expect(ll.lng).toBeCloseTo(144.962, 2);
    expect(DEFAULT_MAP_CENTER[0]).toBeCloseTo(144.962, 2);
    expect(DEFAULT_MAP_CENTER[1]).toBeCloseTo(-37.817, 2);
  });
});
