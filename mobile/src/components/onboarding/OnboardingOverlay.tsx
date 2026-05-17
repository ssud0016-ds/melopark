import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, haptics } from '../../design-system';
import type { PulseRingState } from '../../design-system/motion';
import { PulseRing } from './PulseRing';

type Step = {
  title: string;
  body: string;
  ringState: PulseRingState;
  ringPosition: 'top' | 'center' | 'bottom';
  cta: string;
};

const STEPS: Step[] = [
  {
    title: 'Welcome to MelOPark',
    body: 'Find a parking bay near your destination. Tap a colored dot to see live availability and rules.',
    ringState: 'load',
    ringPosition: 'center',
    cta: 'Got it',
  },
  {
    title: 'BusyNow pressure',
    body: 'Tap the BusyNow pill (top-right) to see which streets are busy right now. Lines color by demand.',
    ringState: 'first-tap',
    ringPosition: 'top',
    cta: 'Next',
  },
  {
    title: 'Search by street',
    body: 'Use the Search tab to find a bay by street name or bay ID. Tap a result to jump straight to it.',
    ringState: 'destination-selected',
    ringPosition: 'bottom',
    cta: 'Start',
  },
];

type Props = {
  onDone: () => void;
};

export function OnboardingOverlay({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const advance = () => {
    haptics.light();
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  };

  const skip = () => {
    haptics.selection();
    onDone();
  };

  const ringVerticalAlign =
    step.ringPosition === 'top'
      ? 'flex-start'
      : step.ringPosition === 'bottom'
        ? 'flex-end'
        : 'center';

  return (
    <View
      accessibilityViewIsModal
      accessibilityRole="alert"
      accessibilityLabel="MelOPark onboarding"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 600,
        backgroundColor: 'rgba(53, 51, 140, 0.85)',
      }}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          justifyContent: ringVerticalAlign,
        }}
      >
        <View style={{ alignItems: 'center', marginVertical: 32 }}>
          <PulseRing state={step.ringState} />
        </View>
      </View>

      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 16,
          padding: 20,
          borderRadius: 24,
          backgroundColor: colors.surface,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '500', color: colors.brand, textTransform: 'uppercase' }}>
          Step {index + 1} of {STEPS.length}
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.surfaceDark }}>{step.title}</Text>
        <Text style={{ fontSize: 14, color: colors.surfaceDarkTertiary, lineHeight: 20 }}>
          {step.body}
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {!isLast ? (
            <Pressable
              accessibilityRole="button"
              onPress={skip}
              style={{
                minHeight: 44,
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.surfaceTertiary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.surfaceDarkTertiary, fontWeight: '600' }}>Skip</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={advance}
            style={{
              minHeight: 44,
              flex: 2,
              borderRadius: 12,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.surface, fontWeight: '600' }}>{step.cta}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
