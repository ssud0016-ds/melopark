import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ONBOARDING_KEY, useOnboarding } from '../useOnboarding';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires onboarding until completion is persisted', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.needsOnboarding).toBe(true));

    await act(async () => {
      await result.current.complete();
    });

    expect(result.current.needsOnboarding).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_KEY, 'true');
  });

  test('reset replays onboarding', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.needsOnboarding).toBe(false));

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.needsOnboarding).toBe(true);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ONBOARDING_KEY);
  });
});
