import { render } from '@testing-library/react-native';
import React from 'react';

import { colorBlindColors, colors } from '../../../design-system';
import type { ForecastWarning } from '../../../services/apiForecasts';
import { alternativeLevelColor } from '../AlternativesLineChart';
import { WarningsBarChart, warningChartColor } from '../WarningsBarChart';

describe('chart color-blind palette helpers', () => {
  test('WarningsBarChart maps warning levels through the alternate palette', () => {
    expect(warningChartColor('low', false)).toBe(colors.statusGood);
    expect(warningChartColor('low', true)).toBe(colorBlindColors.statusGood);
    expect(warningChartColor('moderate', true)).toBe(colorBlindColors.statusCaution);
    expect(warningChartColor('high', true)).toBe(colorBlindColors.statusAvoid);
  });

  test('AlternativesLineChart maps pressure levels through the alternate palette', () => {
    expect(alternativeLevelColor('low', true)).toBe(colorBlindColors.statusGood);
    expect(alternativeLevelColor('moderate', true)).toBe(colorBlindColors.statusCaution);
    expect(alternativeLevelColor('critical', true)).toBe(colorBlindColors.statusAvoid);
  });
});

describe('WarningsBarChart keys', () => {
  test('renders duplicate zone and hour warnings without duplicate key warnings', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnings: ForecastWarning[] = [
      {
        zone: 'Kay Street (Canning Street-Rathdowne Street)',
        hours_from_now: 0,
        warning_level: 'high',
      },
      {
        zone: 'Kay Street (Canning Street-Rathdowne Street)',
        hours_from_now: 0,
        warning_level: 'critical',
      },
    ];

    try {
      render(React.createElement(WarningsBarChart, { warnings, width: 320 }));

      expect(
        consoleError.mock.calls.some((call) =>
          call.some(
            (value) =>
              typeof value === 'string' &&
              value.includes('Encountered two children with the same key'),
          ),
        ),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
