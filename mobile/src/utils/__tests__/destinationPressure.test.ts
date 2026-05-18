import {
  buildAlternativePinSubtitle,
  chanceLabelForLevel,
  DESTINATION_CHANCE_TEXT,
  displayAlternativeLabel,
  formatTargetZoneMetadata,
  isTargetZoneBusy,
  pickBetterAlternatives,
  targetZoneBarPct,
  targetZoneMainLabel,
} from '../destinationPressure';

describe('destinationPressure', () => {
  test('CHANCE_TEXT matches web BusyNowPanel', () => {
    expect(DESTINATION_CHANCE_TEXT.medium).toBe('Getting busy');
    expect(DESTINATION_CHANCE_TEXT.high).toBe('Hard to park');
    expect(DESTINATION_CHANCE_TEXT.low).toBe('Good chance');
  });

  test('targetZoneBarPct clamps 0-100', () => {
    expect(targetZoneBarPct({ pressure: 0.55 })).toBe(55);
    expect(targetZoneBarPct({ pressure: 1.2 })).toBe(100);
  });

  test('formatTargetZoneMetadata matches web line', () => {
    expect(
      formatTargetZoneMetadata({
        label: 'Test Zone',
        level: 'medium',
        free_bays: 3,
        total_bays: 9,
      }),
    ).toBe('Destination: Test Zone · Getting busy · 3/9 bays free');
  });

  test('targetZoneMainLabel splits cross street', () => {
    expect(targetZoneMainLabel('Lygon St (Elgin St)')).toBe('Lygon St');
  });

  test('isTargetZoneBusy', () => {
    expect(isTargetZoneBusy('high')).toBe(true);
    expect(isTargetZoneBusy('medium')).toBe(true);
    expect(isTargetZoneBusy('low')).toBe(false);
  });

  test('chanceLabelForLevel', () => {
    expect(chanceLabelForLevel('high')).toBe('Hard to park');
  });

  test('displayAlternativeLabel prefixes generic zone ids', () => {
    expect(displayAlternativeLabel('Zone 123', 123)).toBe('Nearby · Zone 123');
    expect(displayAlternativeLabel('Queensberry St')).toBe('Queensberry St');
  });

  test('pickBetterAlternatives filters and sorts like web BusyNowPanel', () => {
    const target = { level: 'high', pressure: 0.8 };
    const alts = [
      { zone_id: 1, label: 'Worse St', level: 'high', pressure: 0.85, walk_distance_m: 100 },
      { zone_id: 2, label: 'Good St', level: 'low', pressure: 0.2, walk_distance_m: 320 },
      { zone_id: 3, label: 'Mid St', level: 'medium', pressure: 0.5, walk_distance_m: 200 },
    ];
    const better = pickBetterAlternatives(target, alts);
    expect(better.map((a) => a.label)).toEqual(['Good St', 'Mid St']);
    expect(better).toHaveLength(2);
  });

  test('pickBetterAlternatives returns empty when target not busier than all', () => {
    const target = { level: 'low', pressure: 0.1 };
    const alts = [{ zone_id: 1, label: 'A', level: 'low', pressure: 0.2, walk_distance_m: 100 }];
    expect(pickBetterAlternatives(target, alts)).toEqual([]);
  });

  test('buildAlternativePinSubtitle includes distance', () => {
    expect(
      buildAlternativePinSubtitle({
        zone_id: 1,
        label: 'Queensberry St',
        level: 'low',
        free_bays: 8,
        walk_distance_m: 320,
      }),
    ).toContain('320 m away');
  });
});
