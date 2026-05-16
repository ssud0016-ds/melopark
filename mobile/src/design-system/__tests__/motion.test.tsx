import { renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { motion, useReducedMotion } from '../motion';

describe('motion', () => {
  test('exports stable timing presets', () => {
    expect(motion.fast).toBe(150);
    expect(motion.base).toBe(200);
    expect(motion.slow).toBe(250);
    expect(motion.pulseRing.duration).toBe(1600);
  });

  // §7.9
  test('useReducedMotion returns false when system flag off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      // @ts-expect-error subscribe shape
      .mockReturnValue({ remove: jest.fn() });
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));
  });

  // §7.10
  test('useReducedMotion returns true when system flag on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      // @ts-expect-error subscribe shape
      .mockReturnValue({ remove: jest.fn() });
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });
});
