import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsScreen } from '../SettingsScreen';
import { useColorBlindMode } from '../../hooks/useColorBlindMode';

const mockNavigate = jest.fn();
const mockToggleColorBlindMode = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light', setColorScheme: jest.fn() }),
}));

jest.mock('../../hooks/useColorBlindMode', () => ({
  useColorBlindMode: jest.fn(),
}));

jest.mock('../../hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    state: 'granted',
    canAskAgain: false,
    request: jest.fn(),
    openSettings: jest.fn(),
  }),
}));

jest.mock('../../hooks/useMapsProvider', () => ({
  useMapsProvider: () => ({ provider: 'google' }),
}));

jest.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({ reset: jest.fn() }),
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

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <SettingsScreen />
    </SafeAreaProvider>,
  );
}

describe('SettingsScreen color-blind mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useColorBlindMode as jest.Mock).mockReturnValue({
      enabled: false,
      toggle: mockToggleColorBlindMode,
    });
  });

  test('renders a functional color-blind palette switch', () => {
    renderScreen();

    expect(screen.getByText('Color-blind palette')).toBeTruthy();
    expect(screen.queryByText('Not available in this build')).toBeNull();
  });

  test('pressing color-blind palette toggles the persisted preference', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Color-blind palette'));

    expect(mockToggleColorBlindMode).toHaveBeenCalledTimes(1);
  });
});
