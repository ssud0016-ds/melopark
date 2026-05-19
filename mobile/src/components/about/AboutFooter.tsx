import { Image, Linking, Pressable, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { fontFamily } from '../../design-system';
import type { RootStackParamList } from '../../navigation/types';

const GITHUB_REPO_URL = 'https://github.com/ssud0016-ds/melopark';
const FOOTER_BG = '#0a1628';
const logoDark = require('../../../assets/logo/mobile-dark.png');

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  navigation: Nav;
  onGoMap: () => void;
  onScrollToTop: () => void;
};

function FooterLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        marginBottom: 8,
        fontSize: 11,
        fontFamily: fontFamily.sansMedium,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
      }}
    >
      {children}
    </Text>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ paddingVertical: 2 }}>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</Text>
    </Pressable>
  );
}

export function AboutFooter({ navigation, onGoMap, onScrollToTop }: Props) {
  const year = new Date().getFullYear();

  const openUrl = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <View
      style={{
        backgroundColor: FOOTER_BG,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 32,
      }}
      accessibilityRole="summary"
    >
      <Image
        source={logoDark}
        style={{ width: 160, height: 48, marginBottom: 20 }}
        resizeMode="contain"
        accessibilityLabel="MelOPark - Smarter Parking, Cleaner City"
      />

      <View style={{ gap: 20 }}>
        <View>
          <FooterLabel>Product</FooterLabel>
          <FooterLink label="Live map" onPress={onGoMap} />
          <FooterLink label="About" onPress={onScrollToTop} />
          <FooterLink label="Data sources" onPress={() => openUrl('https://data.melbourne.vic.gov.au/')} />
        </View>

        <View>
          <FooterLabel>Resources</FooterLabel>
          <FooterLink label="GitHub" onPress={() => openUrl(GITHUB_REPO_URL)} />
          <FooterLink
            label="Accessibility"
            onPress={() => openUrl('https://www.w3.org/WAI/fundamentals/accessibility-intro/')}
          />
          <FooterLink label="Contact" onPress={() => openUrl('mailto:contact@melopark.app')} />
        </View>

        <View>
          <FooterLabel>Legal</FooterLabel>
          <FooterLink label="Privacy" onPress={onScrollToTop} />
          <FooterLink label="Terms" onPress={() => navigation.navigate('Terms')} />
          <FooterLink label="Attribution" onPress={() => navigation.navigate('Attribution')} />
        </View>
      </View>

      <View
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.1)',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.4)' }}>
          © {year} MeloPark · Melbourne, Australia
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.4)' }}>
          Parking data © City of Melbourne, CC BY 4.0
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          <Pressable onPress={() => openUrl('https://data.melbourne.vic.gov.au/')}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecorationLine: 'underline' }}>
              City of Melbourne
            </Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>,</Text>
          <Pressable onPress={() => openUrl('https://creativecommons.org/licenses/by/4.0/')}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecorationLine: 'underline' }}>
              CC BY 4.0
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
