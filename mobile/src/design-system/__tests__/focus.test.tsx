import { act, renderHook } from '@testing-library/react-native';

import { useFocusRing } from '../focus';

describe('useFocusRing', () => {
  // §7.11
  test('focused === true after onFocus, false after onBlur', () => {
    const { result } = renderHook(() => useFocusRing());

    expect(result.current.focused).toBe(false);

    act(() => result.current.onFocus());
    expect(result.current.focused).toBe(true);

    act(() => result.current.onBlur());
    expect(result.current.focused).toBe(false);
  });
});
