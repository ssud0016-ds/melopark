import { Pressable, Text, View } from 'react-native';

import { colors, haptics } from '../../design-system';
import { useLocationPermission } from '../../hooks/useLocationPermission';

// Plan §Phase 3. Surfaces the deny path so users have a clear path back to
// Settings. Hidden when granted or never-asked-yet (initial prompt isn't a banner).
export function LocationPermissionBanner() {
  const { state, canAskAgain, request, openSettings } = useLocationPermission();

  if (state === 'granted' || state === 'unknown') return null;
  if (state === 'never-asked' && canAskAgain) return null; // first prompt handled inline by caller

  const isPermanent = state === 'denied' && !canAskAgain;

  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: 120,
        left: 16,
        right: 16,
        zIndex: 1100,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.statusCautionBg,
        borderLeftWidth: 4,
        borderLeftColor: colors.statusCaution,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.surfaceDark, fontWeight: '600' }}>
        Location off — “bays near me” unavailable
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptics.light();
          if (isPermanent) openSettings();
          else request();
        }}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: colors.statusCaution,
        }}
      >
        <Text style={{ color: colors.surface, fontWeight: '600' }}>
          {isPermanent ? 'Open Settings' : 'Allow location'}
        </Text>
      </Pressable>
    </View>
  );
}
