import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '../components/common/LogoMark';
import { colors, haptics } from '../design-system';

type PlaceholderScreenProps = {
  onOpenSpike: () => void;
};

// Phase 1 acceptance screen (plan §12.1):
// Demonstrates token resolution, Inter font, dark mode swap, haptics, safe-area edge-to-edge.
export function PlaceholderScreen({ onOpenSpike }: PlaceholderScreenProps) {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor="transparent"
        translucent
      />

      <View className="flex-1 items-center justify-center gap-6 px-6">
        <LogoMark size={80} variant={isDark ? 'dark' : 'light'} />

        <Text className="text-center font-sans text-4xl font-extrabold text-brand dark:text-accent">
          MelOPark
        </Text>

        <Text className="text-center font-sans text-sm text-gray-600 dark:text-gray-300">
          Phase 1: design tokens + asset pipeline
        </Text>

        <View className="w-full gap-2 rounded-2xl bg-surface-tertiary p-4 dark:bg-surface-dark-secondary">
          <Row label="Status good" colorClass="bg-status-good" />
          <Row label="Status caution" colorClass="bg-status-caution" />
          <Row label="Status avoid" colorClass="bg-status-avoid" />
          <Row label="Status unknown" colorClass="bg-status-unknown" />
          <Row label="Brand" colorClass="bg-brand" />
          <Row label="Accent" colorClass="bg-accent" />
        </View>

        <View className="w-full flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.light();
              toggleColorScheme();
            }}
            className="min-h-[44px] flex-1 items-center justify-center rounded-lg bg-brand px-4"
          >
            <Text className="font-sans text-sm font-semibold text-white">
              Toggle theme ({colorScheme ?? 'system'})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.medium();
              onOpenSpike();
            }}
            className="min-h-[44px] flex-1 items-center justify-center rounded-lg border border-brand bg-transparent px-4"
          >
            <Text className="font-sans text-sm font-semibold text-brand dark:text-accent">
              Open map spike
            </Text>
          </Pressable>
        </View>

        <Text className="text-center font-sans text-[11px] font-medium text-gray-500 dark:text-gray-400">
          edge-to-edge top inset: {insets.top}dp · bottom: {insets.bottom}dp
        </Text>
      </View>
    </View>
  );
}

function Row({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-6 w-6 rounded-full ${colorClass}`} />
      <Text className="font-sans text-sm text-gray-900 dark:text-gray-300">{label}</Text>
    </View>
  );
}

// Tells TS this file uses colors even though only referenced via className.
void colors;
