import { useMemo } from 'react';

import { colors } from '../design-system';
import { useDarkMode } from './useDarkMode';

/** Semantic theme palette — mirrors web Tailwind dark: variants. */
export type ThemeColors = {
  sheet: string;
  chrome: string;
  chromeMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  tabActive: string;
  tabInactive: string;
  statusGoodBg: string;
  statusCautionBg: string;
  statusAvoidBg: string;
  liveChipBg: string;
  liveChipText: string;
  handle: string;
  brand: string;
  brandOnBrand: string;
};

/** Pure resolver for tests and non-hook call sites. */
export function getThemeColors(dark: boolean): ThemeColors {
  return {
    sheet: dark ? colors.surfaceDark : colors.surface,
    chrome: dark ? colors.surfaceDarkSecondary : colors.surface,
    chromeMuted: dark ? colors.surfaceDarkTertiary : colors.surfaceTertiary,
    border: dark ? 'rgba(55,65,81,0.6)' : 'rgba(226,232,240,0.6)',
    text: dark ? '#f3f4f6' : colors.surfaceDark,
    textSecondary: dark ? '#9ca3af' : '#6b7280',
    textMuted: dark ? '#6b7280' : '#9ca3af',
    tabActive: dark ? colors.brandLight : colors.brand,
    tabInactive: dark ? '#6b7280' : '#9ca3af',
    statusGoodBg: dark ? 'rgba(6,78,59,0.5)' : colors.statusGoodBg,
    statusCautionBg: dark ? 'rgba(120,53,15,0.3)' : colors.statusCautionBg,
    statusAvoidBg: dark ? 'rgba(127,29,29,0.3)' : colors.statusAvoidBg,
    liveChipBg: dark ? 'rgba(6,78,59,0.5)' : colors.statusGoodBg,
    liveChipText: dark ? '#6ee7b7' : colors.statusGood,
    handle: dark ? '#4b5563' : colors.surfaceDarkTertiary,
    brand: colors.brand,
    brandOnBrand: colors.surface,
  };
}

export function useThemeColors(): ThemeColors {
  const { dark } = useDarkMode();
  return useMemo(() => getThemeColors(dark), [dark]);
}
