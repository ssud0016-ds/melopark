import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MapsProviderChooserScreen } from '../MapsProviderChooserScreen';
import { useMapsProvider } from '../../hooks/useMapsProvider';

const mockGoBack = jest.fn();
const mockSetProvider = jest.fn();
const mockClearProvider = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../../hooks/useMapsProvider', () => ({
  useMapsProvider: jest.fn(),
}));

jest.mock('../../design-system/haptics', () => ({
  haptics: {
    light: jest.fn(),
    selection: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    medium: jest.fn(),
  },
}));

function mockProvider(provider: 'google' | 'web' | null = null) {
  (useMapsProvider as jest.Mock).mockReturnValue({
    provider,
    setProvider: mockSetProvider,
    clearProvider: mockClearProvider,
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
      <MapsProviderChooserScreen />
    </SafeAreaProvider>,
  );
}

describe('MapsProviderChooserScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider(null);
  });

  test('renders only Google Maps and Browser fallback options', () => {
    renderScreen();

    expect(screen.getByText('Google Maps')).toBeTruthy();
    expect(screen.getByText('Browser fallback')).toBeTruthy();
    expect(screen.queryByText('Waze')).toBeNull();
  });

  test('pressing Google persists google and goes back', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Google Maps'));

    expect(mockSetProvider).toHaveBeenCalledWith('google');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('pressing Browser persists web and goes back', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Browser fallback'));

    expect(mockSetProvider).toHaveBeenCalledWith('web');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('clear preference is hidden when no provider is selected', () => {
    renderScreen();

    expect(screen.queryByText('Clear preference')).toBeNull();
  });

  test('clear preference clears provider and goes back when provider is selected', () => {
    mockProvider('google');
    renderScreen();

    fireEvent.press(screen.getByText('Clear preference'));

    expect(mockClearProvider).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
