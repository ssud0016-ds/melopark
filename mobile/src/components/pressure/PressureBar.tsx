import { View } from 'react-native';

import { colors } from '../../design-system';

type Props = {
  pct: number;
  color: string;
};

/** Web BusyNowPanel PressureBar — thin track + fill. */
export function PressureBar({ pct, color }: Props) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${width}% pressure`}
      accessibilityValue={{ min: 0, max: 100, now: width }}
      style={{
        marginTop: 6,
        height: 4,
        width: '100%',
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: colors.surfaceTertiary,
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${width}%`,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
