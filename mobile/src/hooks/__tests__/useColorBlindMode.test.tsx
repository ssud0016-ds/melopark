import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { COLOR_BLIND_MODE_STORAGE_KEY, useColorBlindMode } from '../useColorBlindMode';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useColorBlindMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('hydrates enabled state from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

    const { result } = renderHook(() => useColorBlindMode());

    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  test('persists color-blind mode changes', async () => {
    const { result } = renderHook(() => useColorBlindMode());

    await act(async () => {
      result.current.setEnabled(true);
    });

    expect(result.current.enabled).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(COLOR_BLIND_MODE_STORAGE_KEY, 'true');
  });

  test('publishes changes to other mounted hook instances', async () => {
    const first = renderHook(() => useColorBlindMode());
    const second = renderHook(() => useColorBlindMode());

    await act(async () => {
      first.result.current.setEnabled(true);
    });

    expect(second.result.current.enabled).toBe(true);
  });
});
