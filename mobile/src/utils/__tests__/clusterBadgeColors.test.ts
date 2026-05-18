import {
  clusterCircleColorExpression,
  getClusterBadgeColors,
} from '../clusterBadgeColors';

describe('getClusterBadgeColors', () => {
  it('uses green/amber/red by availability ratio in normal mode', () => {
    expect(getClusterBadgeColors({ available: 6, total: 6, colorBlindMode: false }).bg).toBe('#16a34a');
    expect(getClusterBadgeColors({ available: 2, total: 10, colorBlindMode: false }).bg).toBe('#d97706');
    expect(getClusterBadgeColors({ available: 1, total: 10, colorBlindMode: false }).bg).toBe('#dc2626');
  });

  it('uses color-blind palette when enabled', () => {
    const high = getClusterBadgeColors({ available: 6, total: 6, colorBlindMode: true });
    expect(high.bg).toBe('#3b82f6');
    const low = getClusterBadgeColors({ available: 0, total: 6, colorBlindMode: true });
    expect(low.bg).toBe('#374151');
  });

  it('uses gray badge when cluster is empty', () => {
    expect(getClusterBadgeColors({ available: 0, total: 0, isDark: false }).bg).toBe('#e2e8f0');
    expect(getClusterBadgeColors({ available: 0, total: 0, isDark: true }).bg).toBe('#374151');
  });
});

describe('clusterCircleColorExpression', () => {
  it('returns a Mapbox case expression with ratio thresholds', () => {
    const expr = clusterCircleColorExpression(false, false);
    expect(expr[0]).toBe('case');
    expect(expr).toContain('#16a34a');
    expect(expr).toContain('#d97706');
    expect(expr).toContain('#dc2626');
  });
});
