import { Text, View } from 'react-native';

import { useThemeColors } from '../../hooks/useThemeColors';
import { BAY_INDIVIDUAL_MIN_ZOOM } from '../../utils/mapGeo';

export const MAP_ZOOM_HINT_COPY = 'Zoom in to view individual bays';

type HintVisibilityInput = {
  mapZoom: number;
  onboardingActive: boolean;
  baySheetFull: boolean;
};

export function isMapZoomHintVisible({
  mapZoom,
  onboardingActive,
  baySheetFull,
}: HintVisibilityInput): boolean {
  if (onboardingActive || baySheetFull) return false;
  return mapZoom < BAY_INDIVIDUAL_MIN_ZOOM;
}

/** Pill only — parent positions absolute above ScopeStrip without shifting layout. */
export function MapZoomHintPill() {
  const theme = useThemeColors();

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brand,
        backgroundColor: theme.chrome,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: theme.tabActive,
        }}
        numberOfLines={2}
      >
        {MAP_ZOOM_HINT_COPY}
      </Text>
    </View>
  );
}
