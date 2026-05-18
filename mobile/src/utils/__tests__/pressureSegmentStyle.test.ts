import { SEARCH_RADIUS_M } from '../mapGeo';
import { getStatusFillColor, styleSegment } from '../pressureSegmentStyle';

describe('getStatusFillColor', () => {
  test('uses default palette when color-blind mode is off', () => {
    expect(getStatusFillColor('available', false)).toBe('#a3ec48');
    expect(getStatusFillColor('caution', false)).toBe('#FFB382');
    expect(getStatusFillColor('occupied', false)).toBe('#ed6868');
  });

  test('uses color-blind palette when mode is on', () => {
    expect(getStatusFillColor('available', true)).toBe('#3b82f6');
    expect(getStatusFillColor('caution', true)).toBe('#f59e0b');
    expect(getStatusFillColor('occupied', true)).toBe('#374151');
  });
});

describe('styleSegment', () => {
  test('uses green for low pressure', () => {
    const s = styleSegment({ level: 'low', total: 5 });
    expect(s.opacity).toBe(0.85);
    expect(s.color).toBe('#a3ec48');
  });

  test('uses red for high pressure', () => {
    const s = styleSegment({ level: 'high', total: 5 });
    expect(s.color).toBe('#ed6868');
    expect(s.opacity).toBe(0.85);
  });

  test('uses dim grey for unknown pressure', () => {
    const s = styleSegment({ level: 'unknown', total: 0 });
    expect(s.opacity).toBe(0.35);
    expect(s.color).toBe('#cbd5e1');
  });

  test('thickens line for segments with many bays', () => {
    expect(styleSegment({ level: 'medium', total: 25 }).weight).toBe(6);
    expect(styleSegment({ level: 'medium', total: 12 }).weight).toBe(4);
    expect(styleSegment({ level: 'medium', total: 5 }).weight).toBe(3);
  });

  test('adds dashArray for high+colorBlind', () => {
    const s = styleSegment({ level: 'high', total: 5 }, { colorBlindMode: true });
    expect(s.dashArray).toBe('6,4');
  });

  test('no dash for non-CB mode', () => {
    const s = styleSegment({ level: 'high', total: 5 }, { colorBlindMode: false });
    expect(s.dashArray).toBeNull();
  });

  describe('zero-bay opacity', () => {
    test('sets opacity 0.5 when total is 0 and level is high', () => {
      expect(styleSegment({ level: 'high', total: 0 }).opacity).toBe(0.5);
    });

    test('sets opacity 0.5 when total is 0 and level is low', () => {
      expect(styleSegment({ level: 'low', total: 0 }).opacity).toBe(0.5);
    });

    test('keeps full opacity 0.85 when total is 5 and level is high', () => {
      expect(styleSegment({ level: 'high', total: 5 }).opacity).toBe(0.85);
    });

    test('keeps unknown-level opacity 0.35 even when total is 0', () => {
      expect(styleSegment({ level: 'unknown', total: 0 }).opacity).toBe(0.35);
    });
  });

  describe('destination dimming', () => {
    const destLat = -37.8136;
    const destLng = 144.9631;
    const destination = { lat: destLat, lng: destLng };
    const closeLat = destLat + (SEARCH_RADIUS_M - 1) / 111_320;
    const farLat = destLat + (SEARCH_RADIUS_M + 1) / 111_320;

    test(`keeps full opacity for segment within dimRadiusM (${SEARCH_RADIUS_M - 1} m)`, () => {
      const s = styleSegment(
        { level: 'medium', total: 10, mid_lat: closeLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      );
      expect(s.opacity).toBe(0.85);
    });

    test(`dims segment beyond dimRadiusM (${SEARCH_RADIUS_M + 1} m)`, () => {
      const s = styleSegment(
        { level: 'medium', total: 10, mid_lat: farLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      );
      expect(s.opacity).toBe(0.25);
    });

    test('does not dim when no destination set', () => {
      const s = styleSegment(
        { level: 'medium', total: 10, mid_lat: farLat, mid_lon: destLng },
        { destination: null, dimRadiusM: SEARCH_RADIUS_M },
      );
      expect(s.opacity).toBe(0.85);
    });

    test('does not dim unknown level (already dim grey)', () => {
      const s = styleSegment(
        { level: 'unknown', total: 0, mid_lat: farLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      );
      expect(s.opacity).toBe(0.35);
    });
  });
});
