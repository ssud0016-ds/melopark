import {
  buildQuietStreetSelection,
  CHANCE_TEXT,
  coverageLabel,
  mapSegmentsToQuietStreets,
  pickTopQuietStreets,
  splitStreetName,
} from '../quietStreets';
import { QUIET_STREET_FLY_MS, QUIET_STREET_MAP_ZOOM } from '../mapGeo';

describe('quietStreets', () => {
  test('splitStreetName parses cross street', () => {
    expect(splitStreetName('Lygon St (Elgin St)')).toEqual({
      main: 'Lygon St',
      cross: 'Elgin St',
    });
  });

  test('pickTopQuietStreets returns max 3 sorted by live then level then free', () => {
    const segments = [
      { segment_id: '1', level: 'high', free: 10, total: 12, has_live_bays: true },
      { segment_id: '2', level: 'low', free: 2, total: 8, has_live_bays: true },
      { segment_id: '3', level: 'low', free: 7, total: 9, has_live_bays: true },
      { segment_id: '4', level: 'low', free: 1, total: 5, has_live_bays: false },
    ];
    const top = pickTopQuietStreets(segments);
    expect(top).toHaveLength(3);
    expect(top[0].segment_id).toBe('3');
    expect(top[1].segment_id).toBe('2');
    expect(top[2].segment_id).toBe('1');
  });

  test('mapSegmentsToQuietStreets maps fields', () => {
    const out = mapSegmentsToQuietStreets([
      {
        segment_id: 'abc',
        street_name: 'Collins St',
        level: 'low',
        free: 5,
        total: 8,
        has_live_bays: true,
        mid_lat: -37.81,
        mid_lon: 144.96,
      },
    ]);
    expect(out[0]).toMatchObject({
      id: 'abc',
      name: 'Collins St',
      fullStreetName: 'Collins St',
      freeBays: 5,
      totalBays: 8,
      status: 'good',
      hasLiveBays: true,
      coverage: 'Live bays',
    });
  });

  test('mapSegmentsToQuietStreets preserves full street_name for alt pin', () => {
    const out = mapSegmentsToQuietStreets([
      {
        segment_id: '1',
        street_name: 'Lygon St (Elgin St)',
        level: 'low',
        free: 7,
        total: 9,
        mid_lat: -37.81,
        mid_lon: 144.96,
      },
    ]);
    expect(out[0].name).toBe('Lygon St');
    expect(out[0].crossStreet).toBe('Elgin St');
    expect(out[0].fullStreetName).toBe('Lygon St (Elgin St)');
  });

  test('buildQuietStreetSelection matches web flyTo and alt pin', () => {
    const street = mapSegmentsToQuietStreets([
      {
        segment_id: 'seg-1',
        street_name: 'Lygon St',
        level: 'low',
        free: 7,
        total: 9,
        mid_lat: -37.81,
        mid_lon: 144.96,
      },
    ])[0];
    const sel = buildQuietStreetSelection(street);
    expect(sel).toMatchObject({
      lat: -37.81,
      lng: 144.96,
      flyOpts: { zoom: QUIET_STREET_MAP_ZOOM, durationMs: QUIET_STREET_FLY_MS },
      altPin: {
        segmentId: 'seg-1',
        label: 'Lygon St',
        subtitle: 'Good chance · 7/9 bays free',
      },
    });
    expect(QUIET_STREET_MAP_ZOOM).toBe(18);
    expect(QUIET_STREET_FLY_MS).toBe(800);
  });

  test('buildQuietStreetSelection returns null without coords', () => {
    const street = mapSegmentsToQuietStreets([
      { segment_id: 'x', street_name: 'No coords', level: 'low', free: 1, total: 1 },
    ])[0];
    expect(buildQuietStreetSelection(street)).toBeNull();
  });

  test('coverageLabel matches web', () => {
    expect(coverageLabel({ has_live_bays: false, total: 10 })).toBe('No live bay coverage');
    expect(coverageLabel({ has_live_bays: true, total: 2 })).toBe('Limited live data');
    expect(coverageLabel({ has_live_bays: true, total: 8 })).toBe('Live bays');
  });

  test('CHANCE_TEXT matches web', () => {
    expect(CHANCE_TEXT.low).toBe('Good chance');
    expect(CHANCE_TEXT.medium).toBe('Getting busy');
    expect(CHANCE_TEXT.high).toBe('Hard to park');
  });
});
