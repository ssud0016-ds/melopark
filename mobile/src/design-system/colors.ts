// Runtime color constants. Mirror tailwind.config.js theme exactly.
// Single source of truth for non-Tailwind reach (status bar, splash, native props).

export const colors = {
  brand: '#35338c',
  brandLight: '#8388c6',
  brandDark: '#2f2d7a',
  accent: '#a3ec48',
  surface: '#ffffff',
  surfaceSecondary: '#dce8ff',
  surfaceTertiary: '#f4f6ff',
  surfaceDark: '#111827',
  surfaceDarkSecondary: '#1f2937',
  surfaceDarkTertiary: '#374151',
  statusGood: '#15803d',
  statusGoodBg: '#f0fdf4',
  statusCaution: '#b45309',
  statusCautionBg: '#fffbeb',
  statusAvoid: '#b91c1c',
  statusAvoidBg: '#fef2f2',
  statusUnknown: '#94a3b8',
  statusUnknownBg: '#f1f5f9',
  danger: '#ed6868',
} as const;

export type ColorToken = keyof typeof colors;
