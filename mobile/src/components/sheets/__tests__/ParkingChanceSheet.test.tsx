import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ParkingChanceSheet, type QuietStreet } from '../ParkingChanceSheet';

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
    render(
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
    render(
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
