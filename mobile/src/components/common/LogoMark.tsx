import { Text, View } from 'react-native';

import { colors, fontFamily } from '../../design-system';

type LogoMarkProps = {
  size?: number;
  variant?: 'light' | 'dark';
};

// Brand mark. Plan §3.1 LogoMark.tsx — temporary text mark pending designer SVG (OQ §41).
export function LogoMark({ size = 48, variant = 'light' }: LogoMarkProps) {
  const bg = variant === 'light' ? colors.brand : colors.surface;
  const fg = variant === 'light' ? colors.accent : colors.brand;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="MelOPark"
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: fg,
          fontFamily: fontFamily.sansExtraBold,
          fontSize: size * 0.55,
        }}
      >
        M
      </Text>
    </View>
  );
}
