import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../design-system';

const TERMS = [
  'MelOPark is provided "as is" without warranty. Live parking data comes from public City of Melbourne sensors and may be stale or incorrect.',
  'You are responsible for obeying posted parking signs. Always verify on-street signage before leaving your vehicle.',
  'We do not store account data. Location requests are used in-session only and never transmitted off-device.',
  'Restriction warnings are best-effort. Clearway, loading zone, and disabled-only bays may not always be detected.',
];

export function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.brand }}>Terms of use</Text>
        {TERMS.map((t, i) => (
          <Text key={i} style={{ fontSize: 13, color: colors.surfaceDark, lineHeight: 20 }}>
            {t}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
