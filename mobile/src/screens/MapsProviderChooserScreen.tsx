import { useNavigation } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '../components/common/Screen';
import { colors, haptics } from '../design-system';
import { useMapsProvider, type MapsProvider } from '../hooks/useMapsProvider';

const OPTIONS: { value: MapsProvider; label: string; description: string }[] = [
  { value: 'google', label: 'Google Maps', description: 'Native Google Maps app' },
  { value: 'waze', label: 'Waze', description: 'Crowd-sourced traffic + navigation' },
  { value: 'web', label: 'Web', description: 'Browser fallback (Google Maps)' },
];

export function MapsProviderChooserScreen() {
  const navigation = useNavigation();
  const { provider, setProvider, clearProvider } = useMapsProvider();

  return (
    <Screen title="Open in…" subtitle="Choose your default navigation app for the Navigate CTA">
      <View className="mt-4 gap-2">
        {OPTIONS.map((opt) => {
          const selected = provider === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.light();
                setProvider(opt.value);
                navigation.goBack();
              }}
              className="rounded-2xl border bg-surface-tertiary px-4 py-3 dark:bg-surface-dark-secondary"
              style={{
                borderColor: selected ? colors.brand : 'transparent',
                borderWidth: selected ? 2 : 0,
              }}
            >
              <Text className="font-sans text-base font-semibold text-gray-900 dark:text-gray-300">
                {opt.label}
              </Text>
              <Text className="font-sans text-xs text-gray-500">{opt.description}</Text>
            </Pressable>
          );
        })}
        {provider ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              clearProvider();
              navigation.goBack();
            }}
            className="mt-2 rounded-2xl border border-surface-tertiary px-4 py-3 dark:border-surface-dark-secondary"
          >
            <Text className="text-center font-sans text-sm text-gray-500">Clear preference</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
