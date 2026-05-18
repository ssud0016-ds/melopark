import { segmentDetailFromApi } from '../segmentDetailFromApi';

describe('segmentDetailFromApi', () => {
  test('maps trend, bays, and events from API', () => {
    const out = segmentDetailFromApi({
      street_name: 'Test St',
      seg_descr: 'Block A',
      level: 'low',
      trend: 'up',
      pressure: 0.2,
      total: 10,
      free: 7,
      has_live_bays: true,
      occ_pct: 30,
      events: [{ name: 'Big Game', distance_m: 100, start_iso: '2026-05-02T18:00:00' }],
    });
    expect(out).toMatchObject({
      street_name: 'Test St',
      seg_descr: 'Block A',
      level: 'low',
      trend: 'up',
      total_bays: 10,
      free_bays: 7,
      has_live_bays: true,
      occ_pct: 30,
    });
    const mapped = [{ event_name: 'Big Game', distance_m: 100, start_iso: '2026-05-02T18:00:00' }];
    expect(out?.events_nearby).toEqual(mapped);
    expect(out?.events).toEqual(mapped);
  });

  test('returns null for empty input', () => {
    expect(segmentDetailFromApi(null)).toBeNull();
    expect(segmentDetailFromApi(undefined)).toBeNull();
  });
});
