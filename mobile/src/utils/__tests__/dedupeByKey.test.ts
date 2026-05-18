import { dedupeByKey } from '../dedupeByKey';
import { pickBetterAlternatives } from '../destinationPressure';
import { pickTopQuietStreets } from '../quietStreets';

describe('dedupeByKey', () => {
  it('keeps first item per key', () => {
    const out = dedupeByKey(
      [
        { id: '20099', v: 1 },
        { id: '20099', v: 2 },
        { id: '3', v: 3 },
      ],
      (x) => x.id,
    );
    expect(out).toHaveLength(2);
    expect(out[0].v).toBe(1);
  });
});

describe('pickTopQuietStreets dedupes segment_id', () => {
  it('drops duplicate segment rows before sort', () => {
    const top = pickTopQuietStreets([
      { segment_id: '20099', level: 'low', free: 5, total: 10, has_live_bays: true },
      { segment_id: '20099', level: 'high', free: 1, total: 10, has_live_bays: true },
      { segment_id: '2', level: 'low', free: 3, total: 8, has_live_bays: true },
    ]);
    expect(top).toHaveLength(2);
    expect(top.filter((s) => s.segment_id === '20099')).toHaveLength(1);
  });
});

describe('pickBetterAlternatives dedupes zone_id', () => {
  it('drops duplicate zones before filter', () => {
    const out = pickBetterAlternatives(
      { level: 'high', pressure: 0.9 },
      [
        { zone_id: 20099, label: 'Zone 20099', level: 'low', pressure: 0.2, walk_distance_m: 100 },
        { zone_id: 20099, label: 'Zone 20099', level: 'low', pressure: 0.1, walk_distance_m: 200 },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0].zone_id).toBe(20099);
  });
});
