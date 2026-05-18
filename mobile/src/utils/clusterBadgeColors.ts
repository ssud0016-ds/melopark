import type { ComponentProps } from 'react';
import { CircleLayer, SymbolLayer } from '@rnmapbox/maps';

import { getStatusFillColor } from './pressureSegmentStyle';

type CircleStyle = NonNullable<ComponentProps<typeof CircleLayer>['style']>;
type SymbolStyle = NonNullable<ComponentProps<typeof SymbolLayer>['style']>;
export type MapboxExpression = Extract<
  NonNullable<CircleStyle['circleColor']>,
  readonly unknown[]
>;

export type ClusterBadgeInput = {
  available: number;
  occupied?: number;
  trap?: number;
  total: number;
  isDark?: boolean;
  colorBlindMode?: boolean;
};

/** Mirrors web ParkingMap.getClusterBadgeColors — ratio-based cluster badge fill. */
export function getClusterBadgeColors({
  available,
  total,
  isDark = false,
  colorBlindMode = false,
}: ClusterBadgeInput): { bg: string; text: string } {
  const a = Number(available) || 0;
  const t = Number(total) || 0;
  const ratio = t > 0 ? a / t : 0;

  if (colorBlindMode) {
    if (t === 0 || ratio === 0) {
      return { bg: getStatusFillColor('occupied', true), text: '#f3f4f6' };
    }
    if (ratio >= 0.4) {
      return { bg: getStatusFillColor('available', true), text: '#f3f4f6' };
    }
    if (ratio >= 0.15) {
      return { bg: getStatusFillColor('caution', true), text: '#512500' };
    }
    return { bg: getStatusFillColor('occupied', true), text: '#f3f4f6' };
  }

  if (t === 0) {
    return {
      bg: isDark ? '#374151' : '#e2e8f0',
      text: isDark ? '#9ca3af' : '#64748b',
    };
  }
  if (ratio >= 0.4) {
    return { bg: '#16a34a', text: '#ffffff' };
  }
  if (ratio >= 0.15) {
    return { bg: '#d97706', text: '#ffffff' };
  }
  return { bg: '#dc2626', text: '#ffffff' };
}

/** Mapbox GL expression for cluster circle fill from sum_available / point_count. */
export function clusterCircleColorExpression(
  colorBlindMode: boolean,
  mapDark: boolean,
): MapboxExpression {
  const ratio = ['/', ['get', 'sum_available'], ['get', 'point_count']] as MapboxExpression;
  const emptyBg = mapDark ? '#374151' : '#e2e8f0';

  if (colorBlindMode) {
    const avail = getStatusFillColor('available', true);
    const caution = getStatusFillColor('caution', true);
    const occupied = getStatusFillColor('occupied', true);
    return [
      'case',
      ['==', ['get', 'point_count'], 0],
      emptyBg,
      ['==', ['get', 'sum_available'], 0],
      occupied,
      ['>=', ratio, 0.4],
      avail,
      ['>=', ratio, 0.15],
      caution,
      occupied,
    ] as MapboxExpression;
  }

  return [
    'case',
    ['==', ['get', 'point_count'], 0],
    emptyBg,
    ['>=', ratio, 0.4],
    '#16a34a',
    ['>=', ratio, 0.15],
    '#d97706',
    '#dc2626',
  ] as MapboxExpression;
}

/** Web: 42px diameter when any free, 34 when zero → Mapbox radius 21 / 17. */
export const clusterCircleRadiusExpression = [
  'case',
  ['==', ['get', 'sum_available'], 0],
  17,
  21,
] as NonNullable<CircleStyle['circleRadius']>;

/** Cluster label = free bay count (not total). */
export const clusterTextFieldExpression = [
  'to-string',
  ['get', 'sum_available'],
] as NonNullable<SymbolStyle['textField']>;

export const BAY_CLUSTER_PROPERTIES = {
  sum_available: ['+', ['case', ['==', ['get', 'type'], 'available'], 1, 0]],
} as const;
