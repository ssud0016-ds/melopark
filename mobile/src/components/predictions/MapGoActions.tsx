import { Pressable, Text, View } from 'react-native';

import { colors, haptics } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import { openGoogleMapsDirections } from '../../utils/forecastUtils';

type Props = {
  lat?: number | null;
  lon?: number | null;
  onMap: () => void;
  compact?: boolean;
};

export function MapGoActions({ lat, lon, onMap, compact }: Props) {
  const theme = useThemeColors();
  if (lat == null || lon == null) return null;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open on map"
        onPress={() => {
          haptics.selection();
          onMap();
        }}
        style={{
          minHeight: compact ? 36 : 44,
          paddingHorizontal: compact ? 10 : 14,
          borderRadius: 12,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: compact ? 12 : 14 }}>Map</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open directions in Google Maps"
        onPress={() => {
          haptics.selection();
          openGoogleMapsDirections(lat, lon);
        }}
        style={{
          minHeight: compact ? 36 : 44,
          paddingHorizontal: compact ? 10 : 14,
          borderRadius: 12,
          backgroundColor: '#1a73e8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: compact ? 12 : 14 }}>Go</Text>
      </Pressable>
    </View>
  );
}
