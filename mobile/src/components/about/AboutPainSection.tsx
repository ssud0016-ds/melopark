import { Text, View } from 'react-native';

import { FRICTION_CARDS, PAIN_POINTS } from '../../content/aboutContent';
import { fontFamily } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';

export function AboutPainSection() {
  const theme = useThemeColors();

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 48, backgroundColor: theme.sheet }}>
      <Text
        style={{
          fontSize: 30,
          fontFamily: fontFamily.sansExtraBold,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: theme.text,
          textAlign: 'center',
        }}
      >
        Parking in Melbourne is painful
      </Text>

      <View style={{ marginTop: 32, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {PAIN_POINTS.map((point) => (
          <View
            key={point.value}
            style={{
              flexGrow: 1,
              flexBasis: '28%',
              minWidth: 140,
              maxWidth: 220,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.chrome,
              padding: 24,
            }}
          >
            <Text
              style={{
                fontSize: 32,
                fontFamily: fontFamily.sansExtraBold,
                fontWeight: '800',
                letterSpacing: -0.5,
                color: theme.text,
              }}
            >
              {point.value}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: theme.textSecondary }}>{point.desc}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {FRICTION_CARDS.map((item) => (
          <View
            key={item.title}
            style={{
              flexGrow: 1,
              flexBasis: '45%',
              minWidth: 160,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.chrome,
              padding: 24,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontFamily: fontFamily.sansBold,
                fontWeight: '700',
                letterSpacing: -0.3,
                color: theme.text,
              }}
            >
              {item.title}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: theme.textSecondary }}>{item.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
