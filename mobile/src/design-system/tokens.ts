// Central runtime token export (plan §3.2 row 2).
// Single import surface for non-Tailwind consumers.

export { colorBlindColors, colors, statusColor, type ColorToken } from './colors';
export { elevation, type ElevationToken } from './elevation';
export { haptics } from './haptics';
export { motion, useReducedMotion, usePulseRing, type PulseRingState } from './motion';
export { fontFamily, interFontMap, typography, type TypographyToken } from './typography';
export { zIndex } from './zIndex';
export { minTapTarget, assertTapTarget } from './touch';
export { useFocusRing } from './focus';
export { rootStyle } from './layout';

export const nativeTabBarHeight = 56;
