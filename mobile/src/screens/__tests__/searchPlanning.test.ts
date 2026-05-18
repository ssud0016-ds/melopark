import { buildSearchResults, nearestBayIds } from '../searchPlanning';
import type { Bay } from '../../services/apiBays';

const bay = (id: string, name: string, lat: number, lng: number): Bay => ({
  id,
  name,
  lat,
  lng,
  type: 'available',
  spots: 1,
  free: 1,
  bayType: 'Metered',
  durationMins: 60,
  hasRules: true,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
});

describe('searchPlanning', () => {
  const bays = [
    bay('1001', 'Queen Street', -37.81, 144.96),
    bay('1002', 'Queen Street', -37.811, 144.961),
    bay('2001', 'King Street', -37.82, 144.95),
  ];

  test('builds destination results from matching street names before bay rows', () => {
    const results = buildSearchResults(bays, 'queen');

    expect(results[0]).toMatchObject({
      kind: 'destination',
      label: 'Queen Street',
      bayCount: 2,
    });
    expect(results.some((item) => item.kind === 'bay' && item.bay.id === '1001')).toBe(true);
  });

  test('finds nearest bay ids for a destination', () => {
    expect(nearestBayIds(bays, { lat: -37.8105, lng: 144.9605 }, 2)).toEqual(['1001', '1002']);
  });
});
