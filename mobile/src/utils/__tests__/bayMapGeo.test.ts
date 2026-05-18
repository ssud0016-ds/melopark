import type { Bay } from '../../services/apiBays';
import { buildMapBayShape } from '../bayMapGeo';

const bay = (id: string, bayType: string): Bay => ({
  id,
  name: null,
  type: 'available',
  lat: -37.81,
  lng: 144.96,
  spots: 1,
  free: 1,
  bayType,
  durationMins: null,
  hasRules: false,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
});

describe('buildMapBayShape', () => {
  test('flags disability bays when not filtering', () => {
    const shape = buildMapBayShape([bay('1', 'Disabled'), bay('2', 'Other')], false);
    const byId = Object.fromEntries(
      shape.features.map((f) => [f.properties?.bayId, f.properties?.isAccessible]),
    );
    expect(byId['1']).toBe('yes');
    expect(byId['2']).toBe('no');
  });

  test('filters to gold ids and marks all accessible when filter on', () => {
    const shape = buildMapBayShape([bay('1', 'Other'), bay('2', 'Other')], false, ['1']);
    expect(shape.features).toHaveLength(1);
    expect(shape.features[0]?.properties?.isAccessible).toBe('yes');
  });
});
