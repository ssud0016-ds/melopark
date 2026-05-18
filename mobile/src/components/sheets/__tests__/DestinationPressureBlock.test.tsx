import { fireEvent, render, screen } from '@testing-library/react-native';

import { DestinationPressureBlock } from '../DestinationPressureBlock';

const highTargetWithAlts = {
  target_zone: {
    label: 'Target Zone',
    level: 'high',
    pressure: 0.8,
    free_bays: 1,
    total_bays: 10,
  },
  alternatives: [
    {
      zone_id: 123,
      label: 'Queensberry St',
      level: 'low',
      pressure: 0.2,
      free_bays: 8,
      walk_distance_m: 320,
      centroid_lat: -37.81,
      centroid_lon: 144.96,
    },
    {
      zone_id: 124,
      label: 'Albert St',
      level: 'low',
      pressure: 0.15,
      free_bays: 9,
      walk_distance_m: 450,
      centroid_lat: -37.812,
      centroid_lon: 144.961,
    },
    {
      zone_id: 125,
      label: 'Busy Alt',
      level: 'high',
      pressure: 0.9,
      free_bays: 1,
      walk_distance_m: 100,
    },
  ],
};

describe('DestinationPressureBlock', () => {
  test('shows Getting busy label, metadata, and pressure bar for medium target_zone', () => {
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error={null}
        data={{
          target_zone: {
            label: 'Test Zone',
            level: 'medium',
            pressure: 0.55,
            free_bays: 3,
            total_bays: 9,
          },
          alternatives: [],
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Getting busy')).toBeTruthy();
    expect(screen.getByText(/Destination: Test Zone · Getting busy · 3\/9 bays free/)).toBeTruthy();
    expect(screen.getByLabelText('55% pressure')).toBeTruthy();
  });

  test('shows Hard to park for high level', () => {
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error={null}
        data={{
          target_zone: {
            label: 'Busy St',
            level: 'high',
            pressure: 0.9,
            free_bays: 1,
            total_bays: 10,
          },
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Hard to park')).toBeTruthy();
    expect(screen.getByLabelText('90% pressure')).toBeTruthy();
  });

  test('shows okay message when not busy', () => {
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error={null}
        data={{
          target_zone: {
            label: 'Quiet St',
            level: 'low',
            pressure: 0.2,
            free_bays: 8,
            total_bays: 10,
          },
          alternatives: [
            {
              zone_id: 1,
              label: 'Other St',
              level: 'low',
              pressure: 0.1,
              free_bays: 9,
              walk_distance_m: 200,
            },
          ],
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Good chance')).toBeTruthy();
    expect(screen.getByText(/Destination area looks okay/)).toBeTruthy();
    expect(screen.queryByText(/Better nearby options/)).toBeNull();
  });

  test('shows better alternatives when destination is busy', () => {
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error={null}
        data={highTargetWithAlts}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText(/Better nearby options/)).toBeTruthy();
    expect(screen.getByText('Queensberry St')).toBeTruthy();
    expect(screen.getByText('Albert St')).toBeTruthy();
    expect(screen.getByText(/320 m away/)).toBeTruthy();
    expect(screen.queryByText('Busy Alt')).toBeNull();
  });

  test('shows empty message when busy but no qualifying alternatives', () => {
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error={null}
        data={{
          target_zone: {
            label: 'Target Zone',
            level: 'high',
            pressure: 0.8,
            free_bays: 1,
            total_bays: 10,
          },
          alternatives: [
            {
              zone_id: 1,
              label: 'Worse',
              level: 'high',
              pressure: 0.9,
              free_bays: 0,
              walk_distance_m: 100,
            },
          ],
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText(/No better parking options within 800 m/)).toBeTruthy();
  });

  test('pressing alternative calls onAlternativePress', () => {
    const onAlternativePress = jest.fn();
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error={null}
        data={highTargetWithAlts}
        onRetry={jest.fn()}
        onAlternativePress={onAlternativePress}
      />,
    );

    fireEvent.press(screen.getByLabelText(/Queensberry St — Good chance/));
    expect(onAlternativePress).toHaveBeenCalledWith(
      expect.objectContaining({ zone_id: 123, label: 'Queensberry St' }),
    );
  });

  test('retry calls onRetry', () => {
    const onRetry = jest.fn();
    render(
      <DestinationPressureBlock
        isReady
        loading={false}
        error="Network error"
        data={null}
        onRetry={onRetry}
      />,
    );

    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
