import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { baySearchStatusColor, SearchScreen } from '../SearchScreen';
import { useBays } from '../../hooks/useBays';
import { colorBlindColors, colors } from '../../design-system';
import type { Bay } from '../../services/apiBays';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../hooks/useBays', () => ({
  useBays: jest.fn(),
}));

jest.mock('../../hooks/useColorBlindMode', () => ({
  useColorBlindMode: () => ({ enabled: mockColorBlindMode }),
}));

jest.mock('../../design-system/haptics', () => ({
  haptics: {
    light: jest.fn(),
    selection: jest.fn(),
    medium: jest.fn(),
  },
}));

const bay = (id: string, name: string, lat: number, lng: number): Bay => ({
  id,
  name,
  lat,
  lng,
  type: 'available',
  spots: 1,
  free: 1,
  bayType: 'Metered',
  durationMins: 60,
  hasRules: true,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
});

const bays = [
  bay('1001', 'Queen Street', -37.81, 144.96),
  bay('1002', 'Queen Street', -37.812, 144.962),
  bay('2001', 'King Street', -37.82, 144.95),
];

let mockColorBlindMode = false;

function mockBays(data: Bay[] = bays) {
  (useBays as jest.Mock).mockReturnValue({
    bays: data,
    loading: false,
    error: null,
    availableBayCount: data.length,
  });
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <SearchScreen />
    </SafeAreaProvider>,
  );
}

async function typeSearch(query: string) {
  fireEvent.changeText(screen.getByLabelText('Search bays and destinations'), query);
  act(() => {
    jest.advanceTimersByTime(150);
  });
}

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockColorBlindMode = false;
    mockBays();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('typing a street query shows a destination planning result', async () => {
    renderScreen();

    await typeSearch('queen');

    expect(await screen.findByText('Plan near Queen Street')).toBeTruthy();
    expect(screen.getByText('Destination from 2 nearby bays')).toBeTruthy();
  });

  test('maps bay result dots through the color-blind palette', () => {
    expect(baySearchStatusColor('available', false)).toBe(colors.statusGood);
    expect(baySearchStatusColor('available', true)).toBe(colorBlindColors.statusGood);
    expect(baySearchStatusColor('trap', true)).toBe(colorBlindColors.statusCaution);
    expect(baySearchStatusColor('occupied', true)).toBe(colorBlindColors.statusAvoid);
  });

  test('pressing destination result navigates to MapTab with planning destination params', async () => {
    renderScreen();

    await typeSearch('queen');
    fireEvent.press(await screen.findByText('Plan near Queen Street'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
        screen: 'MapTab',
        params: {
          planningMode: 'destination',
          destinationLat: expect.any(Number),
          destinationLng: expect.any(Number),
          destinationLabel: 'Queen Street',
        },
      }),
    );
  });

  test('searching and selecting a bay result navigates to MapTab with bayId', async () => {
    renderScreen();

    await typeSearch('2001');
    fireEvent.press(await screen.findByText('King Street'));

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', {
      screen: 'MapTab',
      params: { bayId: '2001' },
    });
  });

  test('shows empty state before search and no-result state for unmatched query', async () => {
    renderScreen();

    expect(
      screen.getByText('Type a street name to plan near a destination, or a bay ID to open a bay.'),
    ).toBeTruthy();

    await typeSearch('zzzz');

    expect(await screen.findByText('No bays or streets match "zzzz"')).toBeTruthy();
  });
});
