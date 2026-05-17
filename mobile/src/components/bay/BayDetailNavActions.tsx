import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, haptics } from '../../design-system';
import { useMapsProvider } from '../../hooks/useMapsProvider';
import type { Bay } from '../../services/apiBays';
import type { Landmark } from '../../data/landmarks';
import { launchMaps } from '../maps/launchMaps';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  bay: Bay | null;
  destination: Landmark | null;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

function isValidLatLng(v: { lat?: number; lng?: number } | null | undefined): boolean {
  if (!v) return false;
  return typeof v.lat === 'number' && typeof v.lng === 'number' && Number.isFinite(v.lat) && Number.isFinite(v.lng);
}

export function BayDetailNavActions({ bay, destination }: Props) {
  const { provider } = useMapsProvider();
  const navigation = useNavigation<Nav>();
  const [notice, setNotice] = useState<string | null>(null);

  if (!isValidLatLng(bay)) return null;

  const start = async (mode: 'drive' | 'walk') => {
    setNotice(null);
    if (!provider) {
      navigation.navigate('MapsProviderChooser');
      return;
    }
    haptics.medium();
    const args = {
      provider,
      lat: bay!.lat,
      lng: bay!.lng,
      label: bay!.name ?? `Bay ${bay!.id}`,
      mode,
      origin: mode === 'walk' && isValidLatLng(destination) ? { lat: destination!.lat, lng: destination!.lng } : undefined,
    };
    const ok = await launchMaps(args);
    if (!ok) setNotice("Couldn't open the chosen maps app. Opened Google Maps web instead.");
  };

  const canWalk = isValidLatLng(destination);

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Navigate to bay"
        onPress={() => start('drive')}
        style={{
          minHeight: 48,
          borderRadius: 10,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: colors.surface, fontSize: 14, fontWeight: '600' }}>Navigate to bay</Text>
      </Pressable>

      {canWalk ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Walk to destination"
          onPress={() => start('walk')}
          style={{
            minHeight: 48,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: colors.brand, fontSize: 14, fontWeight: '600' }}>Walk to destination</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 13, color: colors.surfaceDarkTertiary }}>
          Set a destination to enable walking directions.
        </Text>
      )}

      {notice ? (
        <View
          accessibilityRole="alert"
          style={{
            marginTop: 4,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#fcd34d',
            backgroundColor: '#fffbeb',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#92400e' }}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}
