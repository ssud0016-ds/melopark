import { buildUrl } from '../api';

describe('buildUrl', () => {
  test('skips undefined params', () => {
    const u = buildUrl('/api/bays', { lat: -37.81, hours: undefined, q: null });
    expect(u).toMatch(/lat=-37\.81$/);
    expect(u).not.toMatch(/hours=/);
    expect(u).not.toMatch(/q=/);
  });

  test('encodes special chars', () => {
    const u = buildUrl('/api/bays', { q: 'Spencer & King' });
    expect(u).toMatch(/Spencer\+%26\+King|Spencer%20%26%20King/);
  });

  test('omits ? when no params', () => {
    const u = buildUrl('/api/parking');
    expect(u.endsWith('/api/parking')).toBe(true);
  });
});
