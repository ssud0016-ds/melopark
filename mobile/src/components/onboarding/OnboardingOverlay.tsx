import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamily, haptics, nativeTabBarHeight, zIndex } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  getStatusFillColor,
  PRESSURE_UNKNOWN_COLOR,
} from '../../utils/pressureSegmentStyle';
import type { Landmark } from '../../data/landmarks';

type Step = 'hero' | 'destination' | 'legend';

type Props = {
  hasPressureData: boolean;
  destination: Landmark | null;
  onActiveChange?: (active: boolean) => void;
  onDone: (destination: Landmark | null) => void;
};

export function OnboardingOverlay({ hasPressureData, destination, onActiveChange, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const [step, setStep] = useState<Step>('hero');

  const advance = () => {
    haptics.light();
    if (step === 'hero') {
      setStep('destination');
      onActiveChange?.(true);
      return;
    }
    if (step === 'destination') {
      if (hasPressureData) {
        setStep('legend');
        onActiveChange?.(false);
        return;
      }
      onActiveChange?.(false);
      onDone(destination);
      return;
    }
    onDone(destination);
  };

  const skip = () => {
    haptics.selection();
    onActiveChange?.(false);
    onDone(null);
  };

  if (step === 'hero') {
    return (
      <View
        accessibilityViewIsModal
        accessibilityRole="alert"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.brand900,
          zIndex: zIndex.onboarding,
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 28,
          gap: 24,
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>Welcome to</Text>
        <Text style={{ fontFamily: fontFamily.sansExtraBold, fontSize: 44, color: colors.surface }}>
          MelO
          <Text style={{ color: colors.accent }}>Park</Text>
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 }}>
          This app helps you find nearby parking bays, check availability, and view parking rules before you park.
        </Text>
        <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '700' }}>
          Stop Circling — Start Parking.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={advance}
          style={{
            marginTop: 16,
            minHeight: 52,
            borderRadius: 999,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.brandDark, fontWeight: '800', fontSize: 16 }}>Let's get started</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'destination') {
    return (
      <View
        accessibilityViewIsModal
        accessibilityRole="alert"
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: zIndex.onboarding,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 14, 60, 0.55)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 24,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + nativeTabBarHeight + 28,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: theme.sheet,
            gap: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          <Text style={{ fontFamily: fontFamily.sansExtraBold, fontSize: 28, color: theme.tabActive }}>
            Where are you going?
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
            Search for your destination above to find free nearby parking bays.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={skip}
              style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Skip, just show map</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!destination}
              onPress={advance}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 999,
                backgroundColor: destination ? colors.brand : theme.chromeMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: destination ? theme.brandOnBrand : theme.textMuted,
                  fontWeight: '700',
                }}
              >
                {hasPressureData ? 'Next →' : 'Continue →'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // legend
  return (
    <View
      accessibilityViewIsModal
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 14, 60, 0.96)',
        zIndex: zIndex.onboarding,
        paddingTop: insets.top + 60,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 28,
        gap: 16,
      }}
    >
      <Text style={{ fontFamily: fontFamily.sansExtraBold, fontSize: 28, color: colors.surface }}>
        What you'll see on the map
      </Text>
      <View style={{ gap: 10, marginTop: 8 }}>
        <LegendRow color={getStatusFillColor('available', false)} label="Good chance — bays likely free" />
        <LegendRow color={getStatusFillColor('caution', false)} label="Getting busy — some pressure" />
        <LegendRow color={getStatusFillColor('occupied', false)} label="Hard to park now" />
        <LegendRow color={PRESSURE_UNKNOWN_COLOR} label="No live data" />
      </View>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginTop: 8 }}>
        Streets are colored by live demand. Tap a street to see how busy it is right now.
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={skip}
          style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>Skip</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={advance}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 999,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.brandDark, fontWeight: '800' }}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ fontSize: 14, color: colors.surface }}>{label}</Text>
    </View>
  );
}
