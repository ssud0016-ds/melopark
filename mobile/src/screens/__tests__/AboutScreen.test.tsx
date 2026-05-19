import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import { AboutScreen } from '../AboutScreen';

const mockNavigate = jest.fn();

jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: jest.fn(() => ({
    loop: false,
    muted: true,
    play: jest.fn(),
    pause: jest.fn(),
  })),
}));

jest.mock('@react-navigation/elements', () => ({
  useHeaderHeight: () => 56,
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

jest.mock('../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    sheet: '#ffffff',
    chrome: '#f4f6ff',
    chromeMuted: '#f4f6ff',
    border: 'rgba(226,232,240,0.6)',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    tabActive: '#35338c',
    tabInactive: '#9ca3af',
    statusGoodBg: '#f0fdf4',
    statusCautionBg: '#fffbeb',
    statusAvoidBg: '#fef2f2',
    liveChipBg: '#f0fdf4',
    liveChipText: '#15803d',
    handle: '#374151',
    brand: '#35338c',
    brandOnBrand: '#ffffff',
  }),
}));

function renderAbout() {
  return render(
    <NavigationContainer>
      <AboutScreen />
    </NavigationContainer>,
  );
}

describe('AboutScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders hero badge and headline', async () => {
    renderAbout();
    expect(await screen.findByText('Smarter parking - Cleaner city - Reducing emissions')).toBeTruthy();
    expect(screen.getByText('Intelligent')).toBeTruthy();
    expect(screen.getByText(/Intelligent Parking Platform/)).toBeTruthy();
  });

  it('renders pain points and friction cards', async () => {
    renderAbout();
    expect(await screen.findByText('Parking in Melbourne is painful')).toBeTruthy();
    expect(screen.getByText('30 Minutes +')).toBeTruthy();
    expect(screen.getByText('$350 +')).toBeTruthy();
    expect(screen.getByText('30 %')).toBeTruthy();
    expect(screen.getByText('Confusing Signs')).toBeTruthy();
    expect(screen.getByText('Hidden Rule Traps')).toBeTruthy();
  });

  it('renders four fix cards', async () => {
    renderAbout();
    expect(await screen.findByText('MeloPark fixes this')).toBeTruthy();
    expect(screen.getByText('Live availability')).toBeTruthy();
    expect(screen.getByText('Clear rules')).toBeTruthy();
    expect(screen.getByText('Trap alerts')).toBeTruthy();
    expect(screen.getByText('Search & go')).toBeTruthy();
  });

  it('navigates to map from Find parking now', async () => {
    renderAbout();
    fireEvent.press(await screen.findByLabelText('Find parking now'));
    expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'MapTab' });
  });

  it('navigates to Terms from footer', async () => {
    renderAbout();
    fireEvent.press(await screen.findByText('Terms'));
    expect(mockNavigate).toHaveBeenCalledWith('Terms');
  });
});
