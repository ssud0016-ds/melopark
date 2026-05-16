import { useCallback, useState } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from './colors';
import { motion } from './motion';

export function useFocusRing(): {
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  ringStyle: ReturnType<typeof useAnimatedStyle>;
} {
  const [focused, setFocused] = useState(false);
  const opacity = useSharedValue(0);

  const onFocus = useCallback(() => {
    setFocused(true);
    opacity.value = withTiming(1, { duration: motion.fast });
  }, [opacity]);

  const onBlur = useCallback(() => {
    setFocused(false);
    opacity.value = withTiming(0, { duration: motion.fast });
  }, [opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    borderColor: colors.brand,
    borderWidth: 2,
    borderRadius: 8,
  }));

  return { focused, onFocus, onBlur, ringStyle };
}
