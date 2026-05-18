import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { MAPS_PROVIDER_STORAGE_KEY, useMapsProvider } from '../useMapsProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useMapsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persists supported provider choices', async () => {
    const { result } = renderHook(() => useMapsProvider());

    await act(async () => {
      result.current.setProvider('google');
    });

    expect(result.current.provider).toBe('google');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(MAPS_PROVIDER_STORAGE_KEY, 'google');
  });

  test('clears unsupported stored provider values such as legacy waze', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('waze');

    renderHook(() => useMapsProvider());

    await waitFor(() => {
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(MAPS_PROVIDER_STORAGE_KEY);
    });
  });
});
