import { useColorScheme } from 'nativewind';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '../components/common/Screen';
import { haptics } from '../design-system';
import { useOnboarding } from '../hooks/useOnboarding';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Phase 2.H replaces with full settings sheet + maps-provider chooser + accessibility wiring.
export function SettingsScreen() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const navigation = useNavigation<Nav>();
  const { reset: resetOnboarding } = useOnboarding();

  return (
    <Screen title="Settings" subtitle="Phase 2.H: provider + accessibility (stub)">
      <View className="mt-4 gap-3">
        <Row
          label={`Theme: ${colorScheme ?? 'system'}`}
          onPress={() => {
            haptics.light();
            toggleColorScheme();
          }}
        />
        <Row
          label="Open in… (maps provider)"
          onPress={() => {
            haptics.light();
            navigation.navigate('MapsProviderChooser');
          }}
        />
        <Row
          label="Replay onboarding"
          onPress={() => {
            haptics.light();
            resetOnboarding();
            navigation.navigate('Tabs', { screen: 'MapTab' });
          }}
        />
        <Row
          label="Map spike (dev)"
          onPress={() => {
            haptics.light();
            navigation.navigate('MapSpike');
          }}
        />
      </View>
    </Screen>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-between rounded-lg bg-surface-tertiary px-4 py-3 dark:bg-surface-dark-secondary"
    >
      <Text className="font-sans text-sm font-medium text-gray-900 dark:text-gray-300">
        {label}
      </Text>
      <Text className="font-sans text-base text-gray-500">›</Text>
    </Pressable>
  );
}
