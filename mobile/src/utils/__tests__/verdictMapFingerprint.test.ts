import { verdictMapFingerprint } from '../verdictMapFingerprint';

describe('verdictMapFingerprint', () => {
  it('is empty for no verdicts', () => {
    expect(verdictMapFingerprint({})).toBe('');
  });

  it('is stable for key order', () => {
    expect(verdictMapFingerprint({ b: 'yes', a: 'no' })).toBe(verdictMapFingerprint({ a: 'no', b: 'yes' }));
  });

  it('changes when a verdict changes', () => {
    const a = { x: 'yes' };
    const b = { x: 'no' };
    expect(verdictMapFingerprint(a)).not.toBe(verdictMapFingerprint(b));
  });
});
