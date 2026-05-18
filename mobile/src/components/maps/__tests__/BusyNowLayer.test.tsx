import type React from 'react';
import { render } from '@testing-library/react-native';

import { colorBlindColors, colors } from '../../../design-system';
import { BusyNowLayer, busyNowLineColorExpression } from '../BusyNowLayer';

const mockLineLayer = jest.fn();

jest.mock('@rnmapbox/maps', () => ({
  VectorSource: ({ children }: { children?: React.ReactNode }) => children,
  LineLayer: (props: unknown) => {
    mockLineLayer(props);
    return null;
  },
}));

jest.mock('../../../services/api', () => ({
  apiBase: () => 'https://api.example.test',
}));

const manifest = {
  tile_url_template: '/api/pressure/tiles/{z}/{x}/{y}.mvt',
  data_version: 'v1',
  minute_bucket: 'bucket',
};

describe('BusyNowLayer color-blind palette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses normal pressure colors by default', () => {
    expect(busyNowLineColorExpression(false)).toEqual(
      expect.arrayContaining([colors.statusGood, colors.statusCaution, colors.statusAvoid]),
    );
  });

  test('uses color-blind pressure colors when enabled', () => {
    expect(busyNowLineColorExpression(true)).toEqual(
      expect.arrayContaining([
        colorBlindColors.statusGood,
        colorBlindColors.statusCaution,
        colorBlindColors.statusAvoid,
      ]),
    );
  });

  test('adds a dashed high-pressure cue in color-blind mode', () => {
    render(<BusyNowLayer manifest={manifest} colorBlindMode />);

    expect(mockLineLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'busynow-line-high-critical-cue',
        style: expect.objectContaining({ lineDasharray: [2, 2] }),
      }),
    );
  });

  test('does not add the dashed cue in normal mode', () => {
    render(<BusyNowLayer manifest={manifest} />);

    expect(mockLineLayer).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'busynow-line-high-critical-cue' }),
    );
  });
});
