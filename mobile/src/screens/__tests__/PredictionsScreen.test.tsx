import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  PREDICTIONS_FALLBACK_LOCATION,
  PredictionsScreen,
  warningLevelColor,
} from '../PredictionsScreen';
import { useParkingForecast } from '../../hooks/useParkingForecast';
import { colorBlindColors, colors } from '../../design-system';
import type { ForecastWarning, PressureZone, WarningLevel } from '../../services/apiForecasts';

jest.mock('../../hooks/useParkingForecast', () => ({
  LEVEL_ORDER: { low: 0, moderate: 1, high: 2, critical: 3 },
  useParkingForecast: jest.fn(),
}));

jest.mock('../../hooks/useColorBlindMode', () => ({
  useColorBlindMode: () => ({ enabled: mockColorBlindMode }),
}));

jest.mock('../../components/charts/WarningsBarChart', () => ({
  WarningsBarChart: () => {
    const { Text } = require('react-native');
    return <Text>Warnings chart</Text>;
  },
}));

jest.mock('../../components/charts/AlternativesLineChart', () => ({
  AlternativesLineChart: () => {
    const { Text } = require('react-native');
    return <Text>Alternatives chart</Text>;
  },
}));

jest.mock('../../design-system/haptics', () => ({
  haptics: {
    selection: jest.fn(),
    light: jest.fn(),
    medium: jest.fn(),
  },
}));

const warnings: ForecastWarning[] = [
  { zone: 'CBD', hours_from_now: 1, warning_level: 'high' },
  { zone: 'Docklands', hours_from_now: 2, warning_level: 'moderate' },
];

const pressureZones: PressureZone[] = [
  { zone: 'CBD', pressure_level: 'critical' },
  { zone: 'Docklands', pressure_level: 'moderate' },
  { zone: 'Southbank', pressure_level: 'low' },
];

let mockColorBlindMode = false;

function mockForecast(overrides: Partial<ReturnType<typeof useParkingForecast>> = {}) {
  (useParkingForecast as jest.Mock).mockReturnValue({
    warnings,
    zoneWarnings: warnings,
    pressure: {
      generated_at: '2026-05-18T00:00:00.000Z',
      arrival_at: null,
      data_source: 'test',
      zones: pressureZones,
    },
    pressureZones,
    busiestZones: [pressureZones[0], pressureZones[1]],
    quietestZones: [pressureZones[2]],
    worstLevel: 'high' as WarningLevel,
    alternatives: null,
    loading: false,
    warningsLoading: false,
    pressureLoading: false,
    error: null,
    pressureError: null,
    arrivalIso: null,
    refresh: jest.fn(),
    ...overrides,
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
      <PredictionsScreen />
    </SafeAreaProvider>,
  );
}

describe('PredictionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColorBlindMode = false;
    mockForecast();
  });

  test('maps warning levels through the color-blind palette', () => {
    expect(warningLevelColor('low', false)).toBe(colors.statusGood);
    expect(warningLevelColor('low', true)).toBe(colorBlindColors.statusGood);
    expect(warningLevelColor('moderate', true)).toBe(colorBlindColors.statusCaution);
    expect(warningLevelColor('critical', true)).toBe(colorBlindColors.statusAvoid);
  });

  test('shows loading summary state while forecast data is loading', () => {
    mockForecast({
      warnings: [],
      zoneWarnings: [],
      pressureZones: [],
      busiestZones: [],
      quietestZones: [],
      loading: true,
      warningsLoading: true,
      pressureLoading: true,
      worstLevel: 'low',
    });

    renderScreen();

    expect(screen.getByText('Current risk')).toBeTruthy();
    expect(screen.getAllByText('...').length).toBeGreaterThanOrEqual(2);
  });

  test('renders summary cards and warning section data', () => {
    renderScreen();

    expect(useParkingForecast).toHaveBeenCalledWith({
      enabled: true,
      hoursAhead: 12,
      pressureLocation: PREDICTIONS_FALLBACK_LOCATION,
    });
    expect(screen.getByText('Predictions')).toBeTruthy();
    expect(screen.getByText('High demand expected - plan ahead.')).toBeTruthy();
    expect(screen.getByText('Current risk')).toBeTruthy();
    expect(screen.getByText('Zones')).toBeTruthy();
    expect(screen.getByText('Warnings')).toBeTruthy();
    expect(screen.getByText('Warning levels')).toBeTruthy();
    expect(screen.getAllByText('CBD').length).toBeGreaterThan(0);
    expect(screen.getByText('high - +1h')).toBeTruthy();
  });

  test('renders all zones and busiest sections', () => {
    renderScreen();

    expect(screen.getByText('All zones')).toBeTruthy();
    expect(screen.getByText('CBD: critical')).toBeTruthy();
    expect(screen.getByText('Docklands: moderate')).toBeTruthy();
    expect(screen.getByText('Busiest zones')).toBeTruthy();
  });

  test('quietest section expands and renders quiet zones', () => {
    renderScreen();

    expect(screen.queryByText('Southbank')).toBeNull();
    fireEvent.press(screen.getByText('Quietest zones'));

    expect(screen.getByText('Southbank')).toBeTruthy();
    expect(screen.getByText('low')).toBeTruthy();
  });

  test('collapse and expand toggles section content', () => {
    renderScreen();

    expect(screen.getByText('CBD: critical')).toBeTruthy();
    fireEvent.press(screen.getByText('All zones'));
    expect(screen.queryByText('CBD: critical')).toBeNull();
    fireEvent.press(screen.getByText('All zones'));
    expect(screen.getByText('CBD: critical')).toBeTruthy();
  });

  test('renders empty states when forecast lists are empty', () => {
    mockForecast({
      warnings: [],
      zoneWarnings: [],
      pressureZones: [],
      busiestZones: [],
      quietestZones: [],
      worstLevel: 'low',
    });

    renderScreen();

    expect(screen.getByText('No warning levels returned for the forecast window.')).toBeTruthy();
    expect(screen.getByText('No all-zone pressure data is available right now.')).toBeTruthy();
    expect(screen.getByText('No busy zones returned.')).toBeTruthy();
    fireEvent.press(screen.getByText('Quietest zones'));
    expect(screen.getByText('No quiet zones returned.')).toBeTruthy();
  });

  test('renders warning and pressure error banners', () => {
    mockForecast({
      error: 'warnings failed',
      pressureError: 'pressure failed',
    });

    renderScreen();

    expect(screen.getByText('Warnings unavailable: warnings failed')).toBeTruthy();
    expect(screen.getByText('Zone pressure unavailable: pressure failed')).toBeTruthy();
  });
});
