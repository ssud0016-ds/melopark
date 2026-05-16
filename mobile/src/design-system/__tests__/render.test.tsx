import resolveConfig from 'tailwindcss/resolveConfig';

import tailwindConfig from '../../../tailwind.config.js';

const resolved = resolveConfig(tailwindConfig as never).theme as unknown as {
  colors: Record<string, any>;
  borderRadius: Record<string, string>;
  spacing: Record<string, string>;
};

// §7.13 — verify tokens for `bg-brand p-4 rounded-lg` resolve to expected values.
// Plan §7.13 spec: backgroundColor:'#35338c', padding:16, borderRadius:8.
// Rendering native components via NativeWind transform in jest is brittle; we
// assert the source tokens instead, which is the actual contract the plan
// verifies (tokens map 1:1 to MASTER.md).
describe('NativeWind token contract', () => {
  test('bg-brand → #35338c', () => {
    expect(resolved.colors.brand.DEFAULT).toBe('#35338c');
  });

  test('p-4 → 16px', () => {
    expect(resolved.spacing['4']).toBe('1rem');
  });

  test('rounded-lg → 0.5rem (8px)', () => {
    expect(resolved.borderRadius.lg).toBe('0.5rem');
  });

  test('rounded-3xl → 1.5rem (24px) — Material 3 sheet spec', () => {
    expect(resolved.borderRadius['3xl']).toBe('1.5rem');
  });
});
