import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, haptics } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useMapsProvider } from '../../hooks/useMapsProvider';
import type { Bay } from '../../services/apiBays';
import type { Landmark } from '../../data/landmarks';
import { launchMaps } from '../maps/launchMaps';
import { buildMapsLaunchArgs } from '../../utils/mapsLaunchArgs';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  bay: Bay | null;
  destination: Landmark | null;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COORDS_ERROR =
  'Location for this bay is unavailable. Navigation cannot be opened.';

const FALLBACK_NOTICE =
  "Couldn't open the chosen maps app. Opened Google Maps web instead.";

function isValidLatLng(v: { lat?: number; lng?: number } | null | undefined): boolean {
  if (!v) return false;
  return (
    typeof v.lat === 'number' &&
    typeof v.lng === 'number' &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng)
  );
}

export function BayDetailNavActions({ bay, destination }: Props) {
  const theme = useThemeColors();
  const { provider } = useMapsProvider();
  const navigation = useNavigation<Nav>();
  const [notice, setNotice] = useState<string | null>(null);
  const [coordsError, setCoordsError] = useState<string | null>(null);

  const validBay = bay != null && isValidLatLng(bay);
  const canWalk = isValidLatLng(destination);

  const onFallback = () => setNotice(FALLBACK_NOTICE);

  const runLaunch = async (chosen: NonNullable<typeof provider>, mode: 'drive' | 'walk') => {
    if (!bay || !validBay) return;
    haptics.medium();
    const walkEnd =
      mode === 'walk' && canWalk ? { lat: destination!.lat, lng: destination!.lng } : null;
    const args = buildMapsLaunchArgs(chosen, mode, bay, walkEnd, onFallback);
    const ok = await launchMaps(args);
    if (!ok) setNotice(FALLBACK_NOTICE);
  };

  const start = async (mode: 'drive' | 'walk') => {
    setNotice(null);
    if (!validBay || !bay) {
      setCoordsError(COORDS_ERROR);
      return;
    }
    setCoordsError(null);
    if (!provider) {
      navigation.navigate('MapsProviderChooser', {
        pendingMode: mode,
        bayLat: bay.lat,
        bayLng: bay.lng,
        bayLabel: bay.name ?? `Bay ${bay.id}`,
        ...(mode === 'walk' && canWalk
          ? { destLat: destination!.lat, destLng: destination!.lng }
          : {}),
      });
      return;
    }
    await runLaunch(provider, mode);
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}>
      {coordsError ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.statusAvoidBg,
            backgroundColor: theme.statusAvoidBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '500', color: colors.statusAvoid }}>{coordsError}</Text>
        </View>
      ) : null}

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
          disabled={!validBay}
          style={{
            minHeight: 48,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            opacity: validBay ? 1 : 0.5,
          }}
        >
          <Text style={{ color: colors.brand, fontSize: 14, fontWeight: '600' }}>Walk to destination</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 13, color: theme.textSecondary }}>
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
            borderColor: theme.statusCautionBg,
            backgroundColor: theme.statusCautionBg,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary }}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}
