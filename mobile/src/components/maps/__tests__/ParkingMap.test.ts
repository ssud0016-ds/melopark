import type React from 'react';

jest.mock('@rnmapbox/maps', () => ({
  __esModule: true,
  default: { StyleURL: { Street: 'street' } },
  Camera: () => null,
  CircleLayer: () => null,
  MapView: ({ children }: { children?: React.ReactNode }) => children,
  ShapeSource: ({ children }: { children?: React.ReactNode }) => children,
  SymbolLayer: () => null,
}));

import { colorBlindColors, colors } from '../../../design-system';
import { baysToGeoJson, clusterBadgeColors } from '../ParkingMap';
import type { Bay } from '../../../services/apiBays';

const bay = (id: string, type: Bay['type']): Bay => ({
  id,
  name: id,
  lat: -37.81,
  lng: 144.96,
  type,
  spots: 1,
  free: type === 'available' ? 1 : 0,
  bayType: 'Metered',
  durationMins: 60,
  hasRules: true,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
});

function featureColor(shape: GeoJSON.FeatureCollection, id: string) {
  return shape.features.find((feature) => feature.id === id)?.properties?.color;
}

describe('ParkingMap color-blind palette', () => {
  test('uses the default status palette when color-blind mode is off', () => {
    const shape = baysToGeoJson(
      [bay('available', 'available'), bay('trap', 'trap'), bay('occupied', 'occupied')],
      [],
      {},
      false,
    );

    expect(featureColor(shape, 'available')).toBe(colors.statusGood);
    expect(featureColor(shape, 'trap')).toBe(colors.statusCaution);
    expect(featureColor(shape, 'occupied')).toBe(colors.statusAvoid);
  });

  test('uses the alternate palette when color-blind mode is on', () => {
    const shape = baysToGeoJson(
      [bay('available', 'available'), bay('trap', 'trap'), bay('occupied', 'occupied')],
      [],
      {},
      true,
    );

    expect(featureColor(shape, 'available')).toBe(colorBlindColors.statusGood);
    expect(featureColor(shape, 'trap')).toBe(colorBlindColors.statusCaution);
    expect(featureColor(shape, 'occupied')).toBe(colorBlindColors.statusAvoid);
  });

  test('uses alternate colors for planning verdict overrides', () => {
    const shape = baysToGeoJson(
      [bay('yes', 'occupied'), bay('no', 'available'), bay('unknown', 'available')],
      [],
      { yes: 'yes', no: 'no', unknown: 'unknown' },
      true,
    );

    expect(featureColor(shape, 'yes')).toBe(colorBlindColors.statusGood);
    expect(featureColor(shape, 'no')).toBe(colorBlindColors.statusAvoid);
    expect(featureColor(shape, 'unknown')).toBe(colorBlindColors.statusUnknown);
  });

  test('switches cluster badge color for color-blind mode', () => {
    expect(clusterBadgeColors(false).background).toBe(colors.brand);
    expect(clusterBadgeColors(true).background).toBe(colorBlindColors.statusGood);
  });
});
