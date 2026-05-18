import { boundsToBbox, destinationToBounds } from '../useMapViewport';

describe('map viewport helpers', () => {
  test('builds padded destination bounds and bbox string', () => {
    const bounds = destinationToBounds({ lat: -37.81, lng: 144.96 }, 0.01);

    expect(bounds.minLat).toBeCloseTo(-37.82);
    expect(bounds.maxLat).toBeCloseTo(-37.8);
    expect(bounds.minLng).toBeCloseTo(144.95);
    expect(bounds.maxLng).toBeCloseTo(144.97);
    expect(boundsToBbox(bounds)).toContain('-37.82');
  });
});
