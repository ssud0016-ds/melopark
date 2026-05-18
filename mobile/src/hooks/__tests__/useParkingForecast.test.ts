import { act, renderHook, waitFor } from '@testing-library/react-native';

import { sortPressureZones, useParkingForecast } from '../useParkingForecast';
import {
  fetchForecastAlternatives,
  fetchForecastPressure,
  fetchForecastWarnings,
  type ForecastAlternativesResponse,
  type ForecastPressureResponse,
  type ForecastWarningsResponse,
  type PressureZone,
} from '../../services/apiForecasts';

jest.mock('../../services/apiForecasts', () => ({
  fetchForecastAlternatives: jest.fn(),
  fetchForecastPressure: jest.fn(),
  fetchForecastWarnings: jest.fn(),
}));

const warningsResponse: ForecastWarningsResponse = {
  generated_at: '2026-05-18T00:00:00.000Z',
  hours_ahead: 12,
  data_source: 'test',
  warnings: [
    { zone: 'CBD', hours_from_now: 1, warning_level: 'high' },
    { zone: 'Docklands', hours_from_now: 2, warning_level: 'moderate' },
  ],
};

const pressureResponse: ForecastPressureResponse = {
  generated_at: '2026-05-18T00:00:00.000Z',
  arrival_at: null,
  data_source: 'test',
  zones: [
    { zone: 'CBD', pressure_level: 'critical' },
    { zone: 'Docklands', pressure_level: 'moderate' },
    { zone: 'Southbank', pressure_level: 'low' },
  ],
};

const alternativesResponse: ForecastAlternativesResponse = {
  target_zone: 'CBD',
  alternatives: [{ zone: 'Southbank', distance_m: 400, pressure_level: 'low' }],
  at: null,
  generated_at: '2026-05-18T00:00:00.000Z',
};

const pressureLocation = { lat: -37.8136, lng: 144.9631 };

function mockSuccessfulForecasts() {
  (fetchForecastWarnings as jest.Mock).mockResolvedValue(warningsResponse);
  (fetchForecastPressure as jest.Mock).mockResolvedValue(pressureResponse);
  (fetchForecastAlternatives as jest.Mock).mockResolvedValue(alternativesResponse);
}

describe('sortPressureZones', () => {
  const zones: PressureZone[] = [
    { zone: 'Southbank', pressure_level: 'low' },
    { zone: 'CBD', pressure_level: 'critical' },
    { zone: 'Docklands', pressure_level: 'moderate' },
  ];

  test('sorts busiest zones first', () => {
    expect(sortPressureZones(zones, 'busy').map((zone) => zone.zone)).toEqual([
      'CBD',
      'Docklands',
      'Southbank',
    ]);
  });

  test('sorts quietest zones first', () => {
    expect(sortPressureZones(zones, 'quiet').map((zone) => zone.zone)).toEqual([
      'Southbank',
      'Docklands',
      'CBD',
    ]);
  });
});

describe('useParkingForecast fetch flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSuccessfulForecasts();
  });

  test('fetches warnings and pressure successfully on mount', async () => {
    const { result } = renderHook(() =>
      useParkingForecast({ enabled: true, hoursAhead: 12, pressureLocation }),
    );

    await waitFor(() => expect(result.current.warnings).toEqual(warningsResponse.warnings));
    expect(result.current.pressure).toEqual(pressureResponse);
    expect(result.current.pressureZones.map((zone) => zone.zone)).toEqual([
      'CBD',
      'Docklands',
      'Southbank',
    ]);
    expect(result.current.busiestZones[0].zone).toBe('CBD');
    expect(result.current.quietestZones[0].zone).toBe('Southbank');
    expect(result.current.error).toBeNull();
    expect(result.current.pressureError).toBeNull();
    expect(fetchForecastWarnings).toHaveBeenCalledWith(12);
    expect(fetchForecastPressure).toHaveBeenCalledWith(-37.8136, 144.9631, null);
  });

  test('warnings error is separated from pressure success', async () => {
    (fetchForecastWarnings as jest.Mock).mockRejectedValue(new Error('warnings down'));

    const { result } = renderHook(() => useParkingForecast({ enabled: true, pressureLocation }));

    await waitFor(() => expect(result.current.error).toBe('warnings down'));
    expect(result.current.pressure).toEqual(pressureResponse);
    expect(result.current.pressureError).toBeNull();
  });

  test('pressure error is separated from warnings success', async () => {
    (fetchForecastPressure as jest.Mock).mockRejectedValue(new Error('pressure down'));

    const { result } = renderHook(() => useParkingForecast({ enabled: true, pressureLocation }));

    await waitFor(() => expect(result.current.pressureError).toBe('pressure down'));
    expect(result.current.warnings).toEqual(warningsResponse.warnings);
    expect(result.current.error).toBeNull();
  });

  test('refresh calls warnings and pressure endpoints again', async () => {
    const { result } = renderHook(() =>
      useParkingForecast({ enabled: true, hoursAhead: 12, pressureLocation }),
    );

    await waitFor(() => expect(fetchForecastWarnings).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(fetchForecastWarnings).toHaveBeenCalledTimes(2));
    expect(fetchForecastPressure).toHaveBeenCalledTimes(2);
  });

  test('loading state transitions while warnings and pressure are in flight', async () => {
    let resolveWarnings!: (value: ForecastWarningsResponse) => void;
    let resolvePressure!: (value: ForecastPressureResponse) => void;
    (fetchForecastWarnings as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveWarnings = resolve;
      }),
    );
    (fetchForecastPressure as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePressure = resolve;
      }),
    );

    const { result } = renderHook(() => useParkingForecast({ enabled: true, pressureLocation }));

    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolveWarnings(warningsResponse);
      resolvePressure(pressureResponse);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test('fetches destination alternatives when destination is provided', async () => {
    const { result } = renderHook(() =>
      useParkingForecast({
        enabled: true,
        destination: { lat: -37.81, lng: 144.96 },
        plannerArrivalIso: '2026-05-18T02:00:00.000Z',
      }),
    );

    await waitFor(() => expect(result.current.alternatives).toEqual(alternativesResponse));
    expect(fetchForecastAlternatives).toHaveBeenCalledWith(
      -37.81,
      144.96,
      '2026-05-18T02:00:00.000Z',
    );
    expect(fetchForecastPressure).toHaveBeenCalledWith(
      -37.81,
      144.96,
      '2026-05-18T02:00:00.000Z',
    );
  });

  test('clears alternatives when destination is absent', async () => {
    const { result } = renderHook(() => useParkingForecast({ enabled: true, pressureLocation }));

    await waitFor(() => expect(result.current.warnings).toEqual(warningsResponse.warnings));
    expect(result.current.alternatives).toBeNull();
    expect(fetchForecastAlternatives).not.toHaveBeenCalled();
  });

  test('skips pressure fetch when no valid coordinates exist', async () => {
    const { result } = renderHook(() => useParkingForecast({ enabled: true }));

    await waitFor(() => expect(result.current.warnings).toEqual(warningsResponse.warnings));
    expect(result.current.pressure).toBeNull();
    expect(result.current.pressureError).toBeNull();
    expect(fetchForecastPressure).not.toHaveBeenCalled();
  });
});
