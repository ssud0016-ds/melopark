import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '../components/common/Screen';
import { launchMaps } from '../components/maps/launchMaps';
import { colors, haptics } from '../design-system';
import { useMapsProvider, type MapsProvider } from '../hooks/useMapsProvider';
import type { RootStackParamList } from '../navigation/types';
import { buildMapsLaunchArgs } from '../utils/mapsLaunchArgs';

const OPTIONS: { value: MapsProvider; label: string; description: string }[] = [
  { value: 'google', label: 'Google Maps', description: 'Native Google Maps app' },
  { value: 'waze', label: 'Waze', description: 'Crowd-sourced traffic + navigation' },
  { value: 'web', label: 'Web', description: 'Browser fallback (Google Maps)' },
];

const FALLBACK_NOTICE =
  "Couldn't open the chosen maps app. Opened Google Maps web instead.";

type Route = RouteProp<RootStackParamList, 'MapsProviderChooser'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MapsProviderChooserScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const params = route.params;
  const { provider, setProvider, clearProvider } = useMapsProvider();

  const launchPending = async (chosen: MapsProvider) => {
    if (!params?.pendingMode || params.bayLat == null || params.bayLng == null) return;
    const mode = params.pendingMode;
    const bay = {
      lat: params.bayLat,
      lng: params.bayLng,
      name: params.bayLabel,
    };
    const walkEnd =
      mode === 'walk' && params.destLat != null && params.destLng != null
        ? { lat: params.destLat, lng: params.destLng }
        : null;
    const args = buildMapsLaunchArgs(chosen, mode, bay, walkEnd);
    const ok = await launchMaps(args);
    if (!ok) {
      // Caller may not see this after goBack; navigation still completes.
      console.warn(FALLBACK_NOTICE);
    }
  };

  const selectProvider = async (value: MapsProvider) => {
    haptics.light();
    setProvider(value);
    await launchPending(value);
    navigation.goBack();
  };

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
              onPress={() => selectProvider(opt.value)}
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
