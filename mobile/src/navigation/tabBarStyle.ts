import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nativeTabBarHeight, zIndex } from '../design-system';
import type { ThemeColors } from '../hooks/useThemeColors';

/** Full tab bar footprint: content row + home-indicator inset. */
export function tabBarTotalHeight(bottomInset: number) {
  return nativeTabBarHeight + bottomInset;
}

export function useTabBarLayout() {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => ({
      contentHeight: nativeTabBarHeight,
      safeBottom: insets.bottom,
      totalHeight: nativeTabBarHeight + insets.bottom,
      /** Sheet bottom aligns with top of tab bar (content + home-indicator padding). */
      sheetBottomInset: nativeTabBarHeight + insets.bottom,
    }),
    [insets.bottom],
  );
}

/** Tab bar container style (position + size). */
export function getTabBarStyle(theme: ThemeColors, bottomInset: number) {
  return {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: tabBarTotalHeight(bottomInset),
    paddingBottom: bottomInset,
    backgroundColor: theme.chrome,
    borderTopColor: theme.border,
    borderTopWidth: 0.5,
    zIndex: zIndex.tabBar,
    elevation: 4,
  } as const;
}
