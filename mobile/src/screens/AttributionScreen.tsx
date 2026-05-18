import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../design-system';

const ATTRIBUTIONS = [
  { name: 'City of Melbourne open data', license: 'CC BY 4.0', url: 'data.melbourne.vic.gov.au' },
  { name: 'VicRoads — Parking restrictions dataset', license: 'CC BY 4.0', url: 'data.vic.gov.au' },
  { name: 'Mapbox vector tiles', license: 'Mapbox terms', url: 'mapbox.com' },
  { name: 'Inter typeface', license: 'OFL 1.1', url: 'rsms.me/inter' },
];

export function AttributionScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.brand }}>Attribution</Text>
        <Text style={{ fontSize: 13, color: colors.surfaceDarkTertiary, marginBottom: 12 }}>
          MelOPark is built on open data and open-source tooling.
        </Text>
        {ATTRIBUTIONS.map((a) => (
          <View key={a.name} style={{ gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>{a.name}</Text>
            <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>
              {a.license} · {a.url}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
