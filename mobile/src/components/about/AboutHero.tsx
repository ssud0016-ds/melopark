import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useVideoPlayer, VideoView } from 'expo-video';

import { ABOUT_BADGE, ABOUT_HERO_SUBCOPY } from '../../content/aboutContent';
import { colors, fontFamily } from '../../design-system';

const heroVideo = require('../../../assets/about/hero-bg-mobile.mp4');

type Props = {
  onFindParking: () => void;
  onLearnMore: () => void;
};

export function AboutHero({ onFindParking, onLearnMore }: Props) {
  const headerHeight = useHeaderHeight();

  const player = useVideoPlayer(heroVideo, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <View style={{ minHeight: 420, overflow: 'hidden' }}>
      <VideoView
        player={player}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      />
      <View
        style={{
          paddingTop: headerHeight + 24,
          paddingHorizontal: 20,
          paddingBottom: 56,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            backgroundColor: 'rgba(255,255,255,0.1)',
            paddingHorizontal: 16,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: fontFamily.sansSemiBold,
              fontWeight: '600',
              letterSpacing: 0.5,
              color: 'rgba(255,255,255,0.9)',
              textAlign: 'center',
            }}
          >
            {ABOUT_BADGE}
          </Text>
        </View>

        <Text
          style={{
            marginTop: 24,
            fontSize: 34,
            fontFamily: fontFamily.sansExtraBold,
            fontWeight: '800',
            lineHeight: 40,
            letterSpacing: -0.5,
            color: '#fff',
            textAlign: 'center',
          }}
        >
          Melbourne&apos;s <Text style={{ color: colors.accent }}>Intelligent</Text> Parking Platform
        </Text>

        <Text
          style={{
            marginTop: 16,
            maxWidth: 340,
            fontSize: 16,
            lineHeight: 24,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
          }}
        >
          {ABOUT_HERO_SUBCOPY}
        </Text>

        <View style={{ marginTop: 32, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find parking now"
            onPress={onFindParking}
            style={{
              borderRadius: 12,
              backgroundColor: colors.accent,
              paddingHorizontal: 28,
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
              Find parking now
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Learn more"
            onPress={onLearnMore}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              backgroundColor: 'transparent',
              paddingHorizontal: 28,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontFamily: fontFamily.sansSemiBold, fontWeight: '600', color: '#fff' }}>
              Learn more
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
