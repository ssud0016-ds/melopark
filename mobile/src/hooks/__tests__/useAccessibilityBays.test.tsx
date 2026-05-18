import { renderHook, waitFor } from '@testing-library/react-native';

import { useAccessibilityBays } from '../useAccessibilityBays';

const mockFetchAccessibilityAll = jest.fn();
jest.mock('../../services/apiBays', () => ({
  fetchAccessibilityAll: (...args: unknown[]) => mockFetchAccessibilityAll(...args),
}));

describe('useAccessibilityBays', () => {
  beforeEach(() => {
    mockFetchAccessibilityAll.mockReset();
    mockFetchAccessibilityAll.mockResolvedValue({
      total_candidates: 2,
      returned: 2,
      bays: [{ bay_id: '101' }, { bay_id: '202' }],
    });
  });

  test('skips fetch when disabled', () => {
    const { result } = renderHook(() => useAccessibilityBays(false));
    expect(mockFetchAccessibilityAll).not.toHaveBeenCalled();
    expect(result.current.accessibleBayIds).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  test('loads gold bay ids when enabled', async () => {
    const { result } = renderHook(() => useAccessibilityBays(true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAccessibilityAll).toHaveBeenCalledWith({
      topN: 200,
      availableOnly: false,
    });
    expect(result.current.accessibleBayIds).toEqual(['101', '202']);
    expect(result.current.accessibleRulesByBayId['101']).toEqual({ bay_id: '101' });
    expect(result.current.error).toBeNull();
  });

  test('surfaces fetch errors', async () => {
    mockFetchAccessibilityAll.mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() => useAccessibilityBays(true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessibleBayIds).toEqual([]);
    expect(result.current.error).toBe('timeout');
  });
});
