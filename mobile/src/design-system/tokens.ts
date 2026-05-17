// Central runtime token export (plan §3.2 row 2).
// Single import surface for non-Tailwind consumers.

export { colors, type ColorToken } from './colors';
export { elevation, type ElevationToken } from './elevation';
export { haptics } from './haptics';
export { motion, useReducedMotion, usePulseRing, type PulseRingState } from './motion';
export { fontFamily, interFontMap, typography, type TypographyToken } from './typography';
export { zIndex } from './zIndex';
export { minTapTarget, assertTapTarget } from './touch';
export { useFocusRing } from './focus';
export { rootStyle } from './layout';

export const nativeTabBarHeight = 56;
export const nativeSearchBarHeight = 48;
export const sheetSnapPoints = ['15%', '50%', '75%'] as const;
export const SNAP_PEEK = 0;
export const SNAP_HALF = 1;
export const SNAP_FULL = 2;
