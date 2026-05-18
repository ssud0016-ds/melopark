import { LineLayer } from '@rnmapbox/maps';
import type { ComponentProps } from 'react';

import {
  getStatusFillColor,
  PRESSURE_UNKNOWN_COLOR,
  PRESSURE_UNKNOWN_COLOR_BLIND,
} from './pressureSegmentStyle';

type LineLayerStyle = NonNullable<ComponentProps<typeof LineLayer>['style']>;
type MapboxExpression = Extract<
  NonNullable<LineLayerStyle['lineColor']>,
  readonly unknown[]
>;

export type BusyNowLineStyleOptions = {
  colorBlindMode?: boolean;
  destination?: { lat: number; lng: number } | null;
  dimRadiusM?: number;
};

const LOW = getStatusFillColor('available', false);
const MEDIUM = getStatusFillColor('caution', false);
const HIGH = getStatusFillColor('occupied', false);
const LOW_CB = getStatusFillColor('available', true);
const MEDIUM_CB = getStatusFillColor('caution', true);
const HIGH_CB = getStatusFillColor('occupied', true);

function totalNum(): MapboxExpression {
  return ['to-number', ['get', 'total'], 0] as MapboxExpression;
}

/** Planar distance (m) from segment midpoint to destination — close to haversine at CBD scale. */
function approxDistanceMeters(destLng: number, destLat: number): MapboxExpression {
  const dLat = ['-', ['get', 'mid_lat'], destLat] as MapboxExpression;
  const dLon = ['-', ['get', 'mid_lon'], destLng] as MapboxExpression;
  const latM = ['*', dLat, 111_320] as MapboxExpression;
  const lonM = ['*', dLon, 85_000] as MapboxExpression;
  return ['sqrt', ['+', ['*', latM, latM], ['*', lonM, lonM]]] as MapboxExpression;
}

function buildLineColorMapboxExpression(colorBlindMode: boolean): MapboxExpression {
  const low = colorBlindMode ? LOW_CB : LOW;
  const medium = colorBlindMode ? MEDIUM_CB : MEDIUM;
  const high = colorBlindMode ? HIGH_CB : HIGH;
  const unknown = colorBlindMode ? PRESSURE_UNKNOWN_COLOR_BLIND : PRESSURE_UNKNOWN_COLOR;
  return [
    'match',
    ['get', 'level'],
    'low',
    low,
    'medium',
    medium,
    'high',
    high,
    'critical',
    high,
    unknown,
  ] as MapboxExpression;
}

function buildLineOpacityMapboxExpression(
  destination: { lat: number; lng: number } | null | undefined,
  dimRadiusM: number,
): MapboxExpression {
  const branches: (MapboxExpression | number)[] = [
    ['==', ['get', 'level'], 'unknown'],
    0.35,
    ['all', ['==', totalNum(), 0], ['!=', ['get', 'level'], 'unknown']],
    0.5,
  ];

  if (
    destination &&
    typeof destination.lat === 'number' &&
    typeof destination.lng === 'number'
  ) {
    branches.push(
      [
        'all',
        ['!=', ['get', 'level'], 'unknown'],
        ['has', 'mid_lat'],
        ['has', 'mid_lon'],
        ['>', approxDistanceMeters(destination.lng, destination.lat), dimRadiusM],
      ] as MapboxExpression,
      0.25,
    );
  }

  branches.push(0.85);
  return ['case', ...branches] as MapboxExpression;
}

function buildLineWidthMapboxExpression(): MapboxExpression {
  const t = totalNum();
  return ['case', ['>=', t, 20], 6, ['>=', t, 10], 4, 3] as MapboxExpression;
}

/** Mapbox does not allow data expressions on line-dasharray — use a filtered overlay layer. */
export const BUSYNOW_HIGH_LEVEL_FILTER = [
  'any',
  ['==', ['get', 'level'], 'high'],
  ['==', ['get', 'level'], 'critical'],
] as MapboxExpression;

/** Web styleSegment dash for high + colorBlind (static, not data-driven). */
export const COLOR_BLIND_HIGH_LINE_DASH: [number, number] = [6, 4];

/** LineLayer style object matching web styleSegment rules. */
export function buildBusyNowLineLayerStyle({
  colorBlindMode = false,
  destination = null,
  dimRadiusM = 400,
}: BusyNowLineStyleOptions = {}): LineLayerStyle {
  return {
    lineColor: buildLineColorMapboxExpression(colorBlindMode),
    lineOpacity: buildLineOpacityMapboxExpression(destination, dimRadiusM),
    lineWidth: buildLineWidthMapboxExpression(),
    lineCap: 'round',
    lineJoin: 'round',
  };
}
