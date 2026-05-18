import { buildBusyNowLineLayerStyle } from '../busyNowLayerExpressions';
import { styleSegment } from '../pressureSegmentStyle';
import { SEARCH_RADIUS_M } from '../mapGeo';

describe('buildBusyNowLineLayerStyle', () => {
  test('lineColor match covers low/medium/high levels', () => {
    const style = buildBusyNowLineLayerStyle({ colorBlindMode: false });
    const expr = style.lineColor as readonly unknown[];
    expect(expr?.[0]).toBe('match');
    expect(expr).toContain('low');
    expect(expr).toContain('#a3ec48');
    expect(expr).toContain('#FFB382');
    expect(expr).toContain('#ed6868');
  });

  test('color-blind lineColor uses blue/amber/dark palette', () => {
    const style = buildBusyNowLineLayerStyle({ colorBlindMode: true });
    const expr = style.lineColor as readonly unknown[];
    expect(expr).toContain('#3b82f6');
    expect(expr).toContain('#f59e0b');
    expect(expr).toContain('#374151');
  });

  test('includes destination dimming branch when destination set', () => {
    const style = buildBusyNowLineLayerStyle({
      destination: { lat: -37.8136, lng: 144.9631 },
      dimRadiusM: SEARCH_RADIUS_M,
    });
    const opacityExpr = style.lineOpacity as readonly unknown[];
    expect(opacityExpr?.[0]).toBe('case');
    expect(JSON.stringify(opacityExpr)).toContain('0.25');
  });

  test('opacity rules align with styleSegment for sample props', () => {
    const destLat = -37.8136;
    const destLng = 144.9631;
    const destination = { lat: destLat, lng: destLng };
    const farLat = destLat + (SEARCH_RADIUS_M + 1) / 111_320;

    expect(
      styleSegment(
        { level: 'medium', total: 10, mid_lat: farLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      ).opacity,
    ).toBe(0.25);

    expect(styleSegment({ level: 'unknown', total: 0 }).opacity).toBe(0.35);
    expect(styleSegment({ level: 'high', total: 0 }).opacity).toBe(0.5);
  });
});
