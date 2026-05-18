import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../design-system';

// Plan §4.7 OfflineBanner port — Phase 3 wires capabilities (NetInfo, lifecycle).
// Surfaces here in 2.L for the user-facing banner.
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => sub();
  }, []);

  if (!offline) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 1100,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.statusAvoid,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.surface, fontWeight: '600' }}>
        Offline — showing last-known data.
      </Text>
    </View>
  );
}
