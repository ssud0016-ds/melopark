import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { colors } from '../../design-system';
import {
  usePulseRing,
  useReducedMotion,
  type PulseRingState,
} from '../../design-system/motion';

type Props = {
  state: PulseRingState;
  size?: number;
  color?: string;
};

export function PulseRing({ state, size = 80, color = colors.accent }: Props) {
  const { opacity, scale } = usePulseRing(state);
  const reducedMotion = useReducedMotion();

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      pointerEvents="none"
    >
      {reducedMotion ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: color,
            opacity: state === 'destination-selected' ? 0.5 : 1,
          }}
        />
      ) : (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 3,
              borderColor: color,
            },
            ringStyle,
          ]}
        />
      )}
      <View
        style={{
          width: size / 3,
          height: size / 3,
          borderRadius: size / 6,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
