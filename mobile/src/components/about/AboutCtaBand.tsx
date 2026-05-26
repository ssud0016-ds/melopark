import { Pressable, Text, View } from 'react-native';

import { colors, fontFamily } from '../../design-system';

type Props = {
  onPress: () => void;
};

export function AboutCtaBand({ onPress }: Props) {
  return (
    <View
      style={{
        backgroundColor: colors.brand,
        paddingHorizontal: 20,
        paddingVertical: 48,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 30,
          fontFamily: fontFamily.sansExtraBold,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: '#fff',
          textAlign: 'center',
        }}
      >
        Park Smart. Never Circle Again.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find Parking Now"
        onPress={onPress}
        style={{
          marginTop: 24,
          borderRadius: 12,
          backgroundColor: colors.accent,
          paddingHorizontal: 32,
          paddingVertical: 10,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: fontFamily.sansBold,
            fontWeight: '700',
            color: colors.brandDark,
          }}
        >
          Find Parking Now
        </Text>
      </Pressable>
    </View>
  );
}
