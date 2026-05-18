import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Stub: spike served its purpose (Phase 2.A day-1 + day-2 verdict logged in
// docs/native-component-map.md §6.1). Library subsequently swapped to
// @rnmapbox/maps for MVT vector segment support. Keeping the route reachable
// from Settings (dev) so the dev menu link doesn't break.
export function MapSpikeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 items-center justify-center bg-surface px-6 dark:bg-surface-dark"
      style={{ paddingTop: insets.top }}
    >
      <Text className="text-center font-sans text-lg font-bold text-brand dark:text-accent">
        Map spike archived
      </Text>
      <Text className="mt-2 text-center font-sans text-sm text-gray-600 dark:text-gray-300">
        Phase 2.A complete. Production map uses @rnmapbox/maps. See Map tab.
      </Text>
    </View>
  );
}
