import type { Landmark } from '../../data/landmarks';
import { shouldFlyBackToDefaultOnDestinationClear } from '../parkingMapCamera';

const dest: Landmark = {
  name: 'RMIT',
  sub: 'City',
  lat: -37.81,
  lng: 144.96,
  category: 'school',
};

describe('shouldFlyBackToDefaultOnDestinationClear', () => {
  test('returns false when both null', () => {
    expect(shouldFlyBackToDefaultOnDestinationClear(null, null)).toBe(false);
  });

  test('returns false when setting destination', () => {
    expect(shouldFlyBackToDefaultOnDestinationClear(null, dest)).toBe(false);
  });

  test('returns false when changing destination', () => {
    expect(shouldFlyBackToDefaultOnDestinationClear(dest, { ...dest, name: 'Other' })).toBe(false);
  });

  test('returns true when clearing destination', () => {
    expect(shouldFlyBackToDefaultOnDestinationClear(dest, null)).toBe(true);
  });
});
