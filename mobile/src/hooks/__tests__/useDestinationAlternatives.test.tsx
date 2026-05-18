import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Landmark } from '../../data/landmarks';
import { useDestinationAlternatives } from '../useDestinationAlternatives';

const mockFetchAlternatives = jest.fn();
jest.mock('../../services/apiPressure', () => ({
  fetchAlternatives: (...args: unknown[]) => mockFetchAlternatives(...args),
}));

const dest: Landmark = {
  name: 'RMIT',
  sub: '124 La Trobe St',
  lat: -37.81,
  lng: 144.96,
  category: 'school',
};

describe('useDestinationAlternatives', () => {
  beforeEach(() => {
    mockFetchAlternatives.mockReset();
    mockFetchAlternatives.mockResolvedValue({
      target_zone: { label: 'Zone', level: 'medium', pressure: 0.5, free_bays: 2, total_bays: 8 },
      alternatives: [],
    });
  });

  test('fetches when destination and enabled', async () => {
    const { result } = renderHook(() =>
      useDestinationAlternatives({ destination: dest, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAlternatives).toHaveBeenCalledWith(
      expect.objectContaining({ lat: dest.lat, lon: dest.lng }),
    );
    expect(result.current.data?.target_zone?.level).toBe('medium');
  });

  test('clears when destination removed', async () => {
    const { result, rerender } = renderHook(
      ({ destination }: { destination: Landmark | null }) =>
        useDestinationAlternatives({ destination, enabled: true }),
      { initialProps: { destination: dest } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ destination: null });
    await waitFor(() => {
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  test('retry refetches', async () => {
    const { result } = renderHook(() =>
      useDestinationAlternatives({ destination: dest, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAlternatives).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(mockFetchAlternatives).toHaveBeenCalledTimes(2));
  });
});
