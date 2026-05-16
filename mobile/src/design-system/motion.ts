import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';

export const motion = {
  fast: 150,
  base: 200,
  slow: 250,
  pulseDot: {
    duration: 2000,
    minOpacity: 0.35,
  },
  pulseRing: {
    duration: 1600,
    radius: 8,
  },
} as const;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

export type PulseRingState = 'load' | 'first-tap' | 'destination-selected';

export function usePulseRing(state: PulseRingState): {
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
} {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(scale);

    if (state === 'destination-selected') {
      opacity.value = withTiming(0, { duration: motion.fast });
      scale.value = 1;
      return;
    }

    if (reduced || state === 'first-tap') {
      opacity.value = withTiming(1, { duration: motion.fast });
      scale.value = 1;
      return;
    }

    opacity.value = withRepeat(withTiming(1, { duration: motion.pulseRing.duration }), -1, true);
    scale.value = withRepeat(withTiming(1.3, { duration: motion.pulseRing.duration }), -1, true);
  }, [state, reduced, opacity, scale]);

  return { opacity, scale };
}
