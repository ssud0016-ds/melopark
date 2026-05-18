import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '../components/common/Screen';
import { colors, haptics } from '../design-system';
import { useColorBlindMode } from '../hooks/useColorBlindMode';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useMapsProvider, type MapsProvider } from '../hooks/useMapsProvider';
import { useOnboarding } from '../hooks/useOnboarding';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ThemeChoice = 'light' | 'dark' | 'system';

const PROVIDER_LABEL: Record<MapsProvider, string> = {
  google: 'Google Maps',
  web: 'Browser fallback',
};

const THEME_LABEL: Record<ThemeChoice, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const navigation = useNavigation<Nav>();
  const { enabled: colorBlindMode, toggle: toggleColorBlindMode } = useColorBlindMode();
  const { reset: resetOnboarding } = useOnboarding();
  const { provider } = useMapsProvider();
  const {
    state: locationState,
    canAskAgain,
    request: requestLocation,
    openSettings,
  } = useLocationPermission();

  const theme = (colorScheme ?? 'system') as ThemeChoice;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleLocationPress = () => {
    haptics.light();
    if (locationState === 'denied' || !canAskAgain) {
      openSettings();
      return;
    }
    requestLocation();
  };

  return (
    <Screen title="Settings" subtitle="App preferences and support information">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Navigation">
          <Row
            label="Map provider"
            value={provider ? PROVIDER_LABEL[provider] : 'Default Android resolver'}
            onPress={() => {
              haptics.light();
              navigation.navigate('MapsProviderChooser');
            }}
          />
        </Section>

        <Section title="Appearance">
          <View className="gap-2">
            <Text className="font-sans text-sm font-medium text-gray-900 dark:text-gray-300">
              Theme
            </Text>
            <View className="flex-row gap-2">
              {(['system', 'light', 'dark'] as ThemeChoice[]).map((choice) => (
                <ThemeButton
                  key={choice}
                  label={THEME_LABEL[choice]}
                  selected={theme === choice}
                  onPress={() => {
                    haptics.selection();
                    setColorScheme(choice);
                  }}
                />
              ))}
            </View>
          </View>
        </Section>

        <Section title="Accessibility">
          <SwitchRow
            label="Color-blind palette"
            value="Adjusts status and street colors"
            checked={colorBlindMode}
            onPress={() => {
              haptics.selection();
              toggleColorBlindMode();
            }}
          />
          <Row
            label="Replay onboarding"
            value="Show map intro again"
            onPress={() => {
              haptics.light();
              resetOnboarding();
              navigation.navigate('Tabs', { screen: 'MapTab' });
            }}
          />
        </Section>

        <Section title="Location">
          <Row
            label="Permission"
            value={locationStatusLabel(locationState, canAskAgain)}
            onPress={handleLocationPress}
          />
          <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">
            Location is used to help orient the map near nearby parking. You can continue using
            MelOPark without granting it.
          </Text>
        </Section>

        <Section title="About">
          <InfoRow label="MelOPark" value={`Version ${version}`} />
          <InfoRow label="Platform" value="Android MVP" />
        </Section>

        <Section title="Attribution">
          <InfoRow label="Parking data" value="City of Melbourne open data" />
          <InfoRow label="Map tiles" value="Mapbox" />
          <InfoRow label="Directions" value="Google Maps links" />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function locationStatusLabel(state: string, canAskAgain: boolean) {
  if (state === 'granted') return 'Granted';
  if (state === 'denied' || !canAskAgain) return 'Denied - open Android settings';
  if (state === 'never-asked') return 'Not granted - tap to request';
  return 'Checking...';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="font-sans text-xs font-semibold uppercase text-brand dark:text-accent">
        {title}
      </Text>
      <View className="gap-2 rounded-lg bg-surface-tertiary p-3 dark:bg-surface-dark-secondary">
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[48px] flex-row items-center justify-between gap-3 rounded-md px-1 py-2"
    >
      <View className="flex-1">
        <Text className="font-sans text-sm font-medium text-gray-900 dark:text-gray-300">
          {label}
        </Text>
        <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{value}</Text>
      </View>
      <Text className="font-sans text-base text-gray-500">&gt;</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-[44px] justify-center rounded-md px-1 py-2">
      <Text className="font-sans text-sm font-medium text-gray-900 dark:text-gray-300">
        {label}
      </Text>
      <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{value}</Text>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  checked,
  onPress,
}: {
  label: string;
  value: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      onPress={onPress}
      className="min-h-[48px] flex-row items-center justify-between gap-3 rounded-md px-1 py-2"
    >
      <View className="flex-1">
        <Text className="font-sans text-sm font-medium text-gray-900 dark:text-gray-300">
          {label}
        </Text>
        <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{value}</Text>
      </View>
      <View
        className="h-6 w-11 justify-center rounded-full px-1"
        style={{ backgroundColor: checked ? colors.brand : colors.surfaceDarkTertiary }}
      >
        <View
          className="h-4 w-4 rounded-full bg-surface"
          style={{ transform: [{ translateX: checked ? 20 : 0 }] }}
        />
      </View>
    </Pressable>
  );
}

function ThemeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-[44px] flex-1 items-center justify-center rounded-md border px-2"
      style={{ borderColor: selected ? colors.brand : 'transparent' }}
    >
      <Text
        className="font-sans text-xs font-semibold"
        style={{ color: selected ? colors.brand : colors.surfaceDarkTertiary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
