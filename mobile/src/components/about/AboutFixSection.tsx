import { Pressable, Text, View } from 'react-native';

import { FIX_CARDS } from '../../content/aboutContent';
import { fontFamily } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import { AboutFeatureIcon } from './AboutFeatureIcon';

type Props = {
  onCardPress: () => void;
};

export function AboutFixSection({ onCardPress }: Props) {
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
        MeloPark fixes this
      </Text>

      <View
        style={{
          marginTop: 32,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
        }}
      >
        {FIX_CARDS.map((card) => (
          <Pressable
            key={card.title}
            accessibilityRole="button"
            accessibilityLabel={card.title}
            onPress={onCardPress}
            style={{
              flexBasis: '46%',
              minWidth: 150,
              maxWidth: 200,
              flexGrow: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.chromeMuted,
              padding: 20,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.sheet,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AboutFeatureIcon type={card.icon} color={theme.tabActive} />
            </View>
            <Text
              style={{
                marginTop: 16,
                fontSize: 16,
                fontFamily: fontFamily.sansBold,
                fontWeight: '700',
                color: theme.text,
                textAlign: 'center',
              }}
            >
              {card.title}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 18,
                color: theme.textSecondary,
                textAlign: 'center',
              }}
            >
              {card.desc}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
