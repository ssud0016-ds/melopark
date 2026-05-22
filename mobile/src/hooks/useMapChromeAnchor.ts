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

/** MapZoomHint pill height (padding + single line). */
export const MAP_ZOOM_HINT_HEIGHT = 34;

/** Gap between zoom hint and ScopeStrip row. */
export const MAP_ZOOM_HINT_GAP = 8;

/** Legend bottom clearance above sheet top — parity with web MapPage mobile legend (+60px). */
export const MAP_LEGEND_SHEET_CLEARANCE = 60;

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

/** Zoom hint sits above the ScopeStrip / MapLegend row. */
export function chromeHintTranslateYFromSheetTop(
  sheetTopY: number,
  pillHeight = MAP_CHROME_PILL_HEIGHT,
  sheetGap = MAP_CHROME_SHEET_GAP,
  hintGap = MAP_ZOOM_HINT_GAP,
  hintHeight = MAP_ZOOM_HINT_HEIGHT,
): number {
  return sheetTopY - pillHeight - sheetGap - hintGap - hintHeight;
}

export function chromeHintTranslateYWithoutSheet(
  layoutHeight: number,
  tabBarOffset: number,
  pillHeight = MAP_CHROME_PILL_HEIGHT,
  sheetGap = MAP_CHROME_SHEET_GAP,
  hintGap = MAP_ZOOM_HINT_GAP,
  hintHeight = MAP_ZOOM_HINT_HEIGHT,
): number {
  return layoutHeight - tabBarOffset - pillHeight - sheetGap - hintGap - hintHeight;
}

/** MapLegend bottom offset when sheet tracks animatedPosition (grows upward from bottom). */
export function legendBottomFromSheetTop(
  layoutHeight: number,
  sheetTopY: number,
  clearance = MAP_LEGEND_SHEET_CLEARANCE,
): number {
  return layoutHeight - sheetTopY + clearance;
}

/** MapLegend bottom offset when parking sheet hidden (idle chrome). */
export function legendBottomWithoutSheet(
  tabBarOffset: number,
  clearance = MAP_LEGEND_SHEET_CLEARANCE,
): number {
  return tabBarOffset + clearance;
}

/**
 * Anchors ScopeStrip to the parking sheet top (gorhom translateY pattern).
 * MapLegend uses legendAnchorStyle (bottom-pinned, web mobile parity).
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

  const legendAnchorStyle = useAnimatedStyle(() => {
    'worklet';
    const clearance = MAP_LEGEND_SHEET_CLEARANCE;
    const bottom = sheetActive
      ? layoutHeight.value - animatedPosition.value + clearance
      : tabBarOffset + clearance;
    return { bottom };
  }, [sheetActive, tabBarOffset]);

  return useMemo(
    () => ({
      animatedPosition,
      layoutHeight,
      anchorStyle,
      legendAnchorStyle,
      tabBarOffset,
      onMapLayout,
    }),
    [animatedPosition, layoutHeight, anchorStyle, legendAnchorStyle, tabBarOffset, onMapLayout],
  );
}
