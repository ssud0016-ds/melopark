import { Pressable, Text, View } from 'react-native';

import { colors } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { PressureAlternativeZone } from '../../types/pressureAlternatives';
import {
  alternativeRowAccessibilityLabel,
  displayAlternativeLabel,
  formatAlternativeRowMeta,
  splitStreetName,
  targetZoneBarColor,
} from '../../utils/destinationPressure';

type Props = {
  alt: PressureAlternativeZone;
  selected?: boolean;
  colorBlindMode?: boolean;
  onPress?: (alt: PressureAlternativeZone) => void;
};

/** Web BusyNowPanel AlternativeRow */
export function AlternativeRow({ alt, selected = false, colorBlindMode = false, onPress }: Props) {
  const theme = useThemeColors();
  const label = displayAlternativeLabel(alt.label, alt.zone_id);
  const { main, cross } = splitStreetName(label);
  const dotColor = targetZoneBarColor(alt.level, colorBlindMode);
  const meta = formatAlternativeRowMeta(alt);
  const distance =
    alt.walk_distance_m != null ? `${alt.walk_distance_m} m away` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={alternativeRowAccessibilityLabel(alt)}
      onPress={() => onPress?.(alt)}
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: selected ? theme.liveChipText : theme.border,
        backgroundColor: selected ? theme.statusGoodBg : theme.chrome,
        marginBottom: 6,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotColor,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{ fontSize: 12, fontWeight: '600', color: theme.text, flexShrink: 1 }}
            numberOfLines={1}
          >
            {main}
          </Text>
          {selected ? (
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: colors.surface,
                backgroundColor: colors.statusGood,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 999,
                overflow: 'hidden',
                textTransform: 'uppercase',
              }}
            >
              Selected
            </Text>
          ) : null}
        </View>
        {cross ? (
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {cross}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
            {meta}
          </Text>
          {distance ? (
            <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, flexShrink: 0 }}>
              {distance}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
