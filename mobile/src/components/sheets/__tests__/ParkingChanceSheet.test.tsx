import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ParkingChanceSheet, type QuietStreet } from '../ParkingChanceSheet';

jest.mock('../../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() }),
}));

const safeAreaMetrics = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderSheet(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={safeAreaMetrics}>{ui}</SafeAreaProvider>);
}

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef(({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
    }));
    return <View testID="bottom-sheet">{children}</View>;
  });
  BottomSheet.displayName = 'BottomSheet';
  const BottomSheetScrollView = ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
  return { __esModule: true, default: BottomSheet, BottomSheetScrollView };
});

const quietStreet: QuietStreet = {
  id: '1',
  name: 'Lygon St',
  fullStreetName: 'Lygon St',
  freeBays: 7,
  totalBays: 9,
  hasLiveBays: true,
  status: 'good',
  coverage: 'Live bays',
  midLat: -37.81,
  midLng: 144.96,
};

const quietStreetNoCoords: QuietStreet = {
  ...quietStreet,
  id: '2',
  name: 'No Coords St',
  midLat: undefined,
  midLng: undefined,
};

describe('ParkingChanceSheet quiet street chips', () => {
  test('calls onStreetClick when chip has mid coords', () => {
    const onStreetClick = jest.fn();
    renderSheet(
      <ParkingChanceSheet
        destination={null}
        altPin={null}
        quietStreets={[quietStreet]}
        busyNowStatus="ready"
        sheetTitle="Parking chance nearby"
        sheetSubtitle="Quiet streets around current map view"
        onStreetClick={onStreetClick}
        onClearSelectedSuggestion={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByLabelText(/Lygon St/));
    expect(onStreetClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', midLat: -37.81, midLng: 144.96 }),
    );
  });

  test('does not call onStreetClick when mid coords missing', () => {
    const onStreetClick = jest.fn();
    renderSheet(
      <ParkingChanceSheet
        destination={null}
        altPin={null}
        quietStreets={[quietStreetNoCoords]}
        busyNowStatus="ready"
        sheetTitle="Parking chance nearby"
        sheetSubtitle="Quiet streets around current map view"
        onStreetClick={onStreetClick}
        onClearSelectedSuggestion={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByLabelText(/No Coords St/));
    expect(onStreetClick).not.toHaveBeenCalled();
  });
});

describe('ParkingChanceSheet data sources', () => {
  const manifest = {
    tile_url_template: '/api/pressure/tiles/{z}/{x}/{y}.mvt',
    generated_at: new Date().toISOString(),
    events: { active_count: 1 },
  };

  test('shows data sources footer when manifest provided', () => {
    renderSheet(
      <ParkingChanceSheet
        destination={null}
        altPin={null}
        quietStreets={[]}
        busyNowStatus="ready"
        sheetTitle="Parking chance nearby"
        sheetSubtitle="Quiet streets around current map view"
        onClearSelectedSuggestion={jest.fn()}
        manifest={manifest}
      />,
    );
    fireEvent.press(screen.getByLabelText('Data sources'));
    expect(screen.getByText(/SCATS/i)).toBeTruthy();
  });
});
