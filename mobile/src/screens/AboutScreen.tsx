import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamily } from '../design-system';
import { LogoMark } from '../components/common/LogoMark';

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16, alignItems: 'center' }}>
        <LogoMark size={96} />
        <Text style={{ fontFamily: fontFamily.sansExtraBold, fontSize: 32, color: colors.brand }}>
          MelOPark
        </Text>
        <Text style={{ fontSize: 14, color: colors.surfaceDarkTertiary, textAlign: 'center' }}>
          Find a parking bay near your destination in Melbourne CBD.
        </Text>
        <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary, textAlign: 'center', marginTop: 24 }}>
          Version 1.0 · Data: City of Melbourne open data + VicRoads.
        </Text>
      </ScrollView>
    </View>
  );
}
