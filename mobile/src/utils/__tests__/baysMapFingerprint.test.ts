import type { Bay } from '../../services/apiBays';
import { baysMapFingerprint } from '../baysMapFingerprint';

function bay(overrides: Partial<Bay> & Pick<Bay, 'id'>): Bay {
  return {
    id: overrides.id,
    name: overrides.name ?? null,
    type: overrides.type ?? 'available',
    lat: overrides.lat ?? -37.81,
    lng: overrides.lng ?? 144.96,
    spots: 1,
    free: overrides.free ?? 1,
    bayType: 'Other',
    durationMins: null,
    hasRules: false,
    allowDetail: true,
    sensorLastUpdated: overrides.sensorLastUpdated ?? null,
    source: 'live',
  };
}

describe('baysMapFingerprint', () => {
  it('is empty for no bays', () => {
    expect(baysMapFingerprint([])).toBe('');
  });

  it('is stable regardless of input order', () => {
    const a = bay({ id: '1', lat: -37.81, lng: 144.96 });
    const b = bay({ id: '2', lat: -37.82, lng: 144.97 });
    expect(baysMapFingerprint([a, b])).toBe(baysMapFingerprint([b, a]));
  });

  it('changes when occupancy or position changes', () => {
    const base = bay({ id: '1' });
    expect(baysMapFingerprint([base])).not.toBe(
      baysMapFingerprint([bay({ id: '1', type: 'occupied', free: 0 })]),
    );
    expect(baysMapFingerprint([base])).not.toBe(
      baysMapFingerprint([bay({ id: '1', lat: -37.815 })]),
    );
  });

  it('ignores non-map fields like sensorLastUpdated', () => {
    const a = bay({ id: '1', sensorLastUpdated: '2026-01-01T00:00:00Z' });
    const b = bay({ id: '1', sensorLastUpdated: '2026-01-01T00:00:10Z' });
    expect(baysMapFingerprint([a])).toBe(baysMapFingerprint([b]));
  });
});
