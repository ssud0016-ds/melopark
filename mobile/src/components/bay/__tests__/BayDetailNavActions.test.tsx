import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BayDetailNavActions } from '../BayDetailNavActions';
import type { Bay } from '../../../services/apiBays';

const mockLaunchMaps = jest.fn();
const mockSetProvider = jest.fn();

jest.mock('../../maps/launchMaps', () => ({
  launchMaps: (...args: unknown[]) => mockLaunchMaps(...args),
}));

jest.mock('../../../hooks/useMapsProvider', () => ({
  useMapsProvider: jest.fn(),
}));

jest.mock('../../../hooks/useDarkMode', () => ({
  useDarkMode: () => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() }),
}));

const { useMapsProvider } = jest.requireMock('../../../hooks/useMapsProvider') as {
  useMapsProvider: jest.Mock;
};

const bay: Bay = {
  id: '42',
  lat: -37.81,
  lng: 144.96,
  name: 'Test St',
  type: 'available',
  spots: 1,
  free: 1,
  bayType: 'standard',
  durationMins: null,
  hasRules: true,
  allowDetail: true,
  sensorLastUpdated: null,
  source: 'live',
};

describe('BayDetailNavActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLaunchMaps.mockResolvedValue(true);
    useMapsProvider.mockReturnValue({
      provider: null,
      setProvider: mockSetProvider,
      clearProvider: jest.fn(),
    });
  });

  it('shows inline maps chooser when Navigate tapped without saved provider', () => {
    render(<BayDetailNavActions bay={bay} destination={null} />);
    expect(screen.queryByTestId('maps-provider-chooser')).toBeNull();
    fireEvent.press(screen.getByLabelText('Navigate to bay'));
    expect(screen.getByTestId('maps-provider-chooser')).toBeTruthy();
    expect(screen.getByText('Choose your maps app')).toBeTruthy();
  });

  it('launches maps after chooser confirm and can remember provider', async () => {
    render(<BayDetailNavActions bay={bay} destination={null} />);
    fireEvent.press(screen.getByLabelText('Navigate to bay'));
    fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(mockLaunchMaps).toHaveBeenCalled());
    expect(mockSetProvider).toHaveBeenCalledWith('google');
  });

  it('launches directly when provider already saved', async () => {
    useMapsProvider.mockReturnValue({
      provider: 'waze',
      setProvider: mockSetProvider,
      clearProvider: jest.fn(),
    });
    render(<BayDetailNavActions bay={bay} destination={null} />);
    fireEvent.press(screen.getByLabelText('Navigate to bay'));
    expect(screen.queryByTestId('maps-provider-chooser')).toBeNull();
    await waitFor(() => expect(mockLaunchMaps).toHaveBeenCalled());
  });
});
