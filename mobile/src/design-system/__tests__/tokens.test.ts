import resolveConfig from 'tailwindcss/resolveConfig';

import tailwindConfig from '../../../tailwind.config.js';
import { colorBlindColors, colors, statusColor } from '../colors';
import { elevation } from '../elevation';
import { interFontMap } from '../typography';
import { zIndex } from '../zIndex';

const resolved = resolveConfig(tailwindConfig as never).theme as unknown as {
  colors: Record<string, unknown>;
};

function getColor(path: string): string {
  // Walk e.g. 'brand.DEFAULT' or 'status.good'.
  return path.split('.').reduce<any>((acc, key) => acc?.[key], resolved.colors);
}

describe('design-system tokens', () => {
  // §7.1
  test('tailwind resolves brand DEFAULT to #35338c', () => {
    expect(getColor('brand.DEFAULT')).toBe('#35338c');
  });

  // §7.2
  test('tailwind resolves status.good to #15803d', () => {
    expect(getColor('status.good')).toBe('#15803d');
  });

  // §7.3
  test('tailwind resolves surface.dark to #111827 (dark-mode target)', () => {
    expect(getColor('surface.dark')).toBe('#111827');
  });

  // §7.4
  test('colors.ts constants match Tailwind theme exactly', () => {
    expect(colors.brand).toBe(getColor('brand.DEFAULT'));
    expect(colors.accent).toBe(getColor('accent.DEFAULT'));
    expect(colors.surface).toBe(getColor('surface.DEFAULT'));
    expect(colors.surfaceDark).toBe(getColor('surface.dark'));
    expect(colors.surfaceDarkSecondary).toBe(getColor('surface.dark-secondary'));
    expect(colors.surfaceTertiary).toBe(getColor('surface.tertiary'));
    expect(colors.statusGood).toBe(getColor('status.good'));
    expect(colors.statusCaution).toBe(getColor('status.caution'));
    expect(colors.statusAvoid).toBe(getColor('status.avoid'));
    expect(colors.statusUnknown).toBe(getColor('status.unknown'));
  });

  test('color-blind status palette uses blue amber charcoal mapping', () => {
    expect(colorBlindColors.statusGood).toBe('#3b82f6');
    expect(colorBlindColors.statusCaution).toBe('#f59e0b');
    expect(colorBlindColors.statusAvoid).toBe('#374151');
    expect(statusColor('good', true)).toBe(colorBlindColors.statusGood);
    expect(statusColor('avoid', false)).toBe(colors.statusAvoid);
  });

  // §7.5
  test('elevation.card = 1, elevation.sheet = 8', () => {
    expect(elevation.card).toBe(1);
    expect(elevation.sheet).toBe(8);
  });

  // §7.6
  test('zIndex.tabBar = 490', () => {
    expect(zIndex.tabBar).toBe(490);
  });

  // §7.12
  test('Inter font map registers 5 weights', () => {
    expect(Object.keys(interFontMap)).toEqual([
      'Inter_400Regular',
      'Inter_500Medium',
      'Inter_600SemiBold',
      'Inter_700Bold',
      'Inter_800ExtraBold',
    ]);
    Object.values(interFontMap).forEach((font) => expect(font).toBeDefined());
  });
});
