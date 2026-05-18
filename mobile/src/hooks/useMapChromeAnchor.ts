import { useCallback, useMemo } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nativeTabBarHeight } from '../design-system';

/** Gap between map chrome pills and the top edge of the parking chance sheet. */
export const MAP_CHROME_SHEET_GAP = 12;

/** ScopeStrip / MapLegend row height (min touch target). */
export const MAP_CHROME_PILL_HEIGHT = 44;

/** Pure helpers for unit tests. */
export function chromeTranslateYFromSheetTop(
  sheetTopY: number,
  pillHeight = MAP_CHROME_PILL_HEIGHT,
  gap = MAP_CHROME_SHEET_GAP,
): number {
  return sheetTopY - pillHeight - gap;
}

export function chromeTranslateYWithoutSheet(
  layoutHeight: number,
  tabBarOffset: number,
  pillHeight = MAP_CHROME_PILL_HEIGHT,
  gap = MAP_CHROME_SHEET_GAP,
): number {
  return layoutHeight - tabBarOffset - pillHeight - gap;
}

/**
 * Anchors ScopeStrip + MapLegend to the parking sheet top (gorhom translateY pattern).
 */
export function useMapChromeAnchor(sheetActive: boolean) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  /** Tab bar + home indicator — for scroll padding and idle chrome only. */
  const tabBarOffset = insets.bottom + nativeTabBarHeight;
  const layoutHeight = useSharedValue(windowHeight);
  const animatedPosition = useSharedValue(windowHeight);

  const onMapLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) {
        layoutHeight.value = h;
      }
    },
    [layoutHeight],
  );

  const anchorStyle = useAnimatedStyle(() => {
    'worklet';
    const gap = 12;
    const pillH = 44;
    const translateY = sheetActive
      ? animatedPosition.value - pillH - gap
      : layoutHeight.value - tabBarOffset - pillH - gap;
    return {
      top: 0,
      transform: [{ translateY }],
    };
  }, [sheetActive, tabBarOffset]);

  return useMemo(
    () => ({
      animatedPosition,
      anchorStyle,
      tabBarOffset,
      onMapLayout,
    }),
    [animatedPosition, anchorStyle, tabBarOffset, onMapLayout],
  );
}
