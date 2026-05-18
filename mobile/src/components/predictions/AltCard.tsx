import { Text, View } from 'react-native';

import { colors } from '../../design-system';
import type { ForecastAlternative } from '../../services/apiForecasts';
import { useThemeColors } from '../../hooks/useThemeColors';
import { altOccupancyPct, drive, splitZone } from '../../utils/forecastUtils';
import { LevelBadge } from './LevelBadge';
import { MapGoActions } from './MapGoActions';
import type { WarningLevel } from '../../services/apiForecasts';

type Props = {
  alt: ForecastAlternative;
  rank: number;
  onMap: () => void;
};

export function AltCard({ alt, rank, onMap }: Props) {
  const theme = useThemeColors();
  const lv = (alt.pressure_level ?? alt.warning_level ?? 'low') as WarningLevel;
  const pct = altOccupancyPct(alt);
  const lat = alt.zone_lat;
  const lon = alt.zone_lon;
  const dr = drive(alt.distance_m ?? alt.walk_distance_m);
  const [main, cross] = splitZone(alt.zone ?? 'Parking area');
  const tierColor =
    lv === 'low'
      ? colors.statusGood
      : lv === 'moderate'
        ? colors.statusCaution
        : colors.statusAvoid;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tierColor,
        backgroundColor: theme.chromeMuted,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 8 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: tierColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }} numberOfLines={1}>
            {main}
          </Text>
          {cross ? (
            <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
              {cross}
            </Text>
          ) : null}
        </View>
        <LevelBadge level={lv} small />
      </View>
      <View style={{ marginHorizontal: 14, height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: tierColor }} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
          gap: 8,
        }}
      >
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: tierColor }}>{pct}% occupied</Text>
          {dr ? (
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              {dr.mins} min · {dr.km} km
            </Text>
          ) : null}
        </View>
        <MapGoActions lat={lat} lon={lon} onMap={onMap} compact />
      </View>
    </View>
  );
}

function AltSkel() {
  const theme = useThemeColors();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        gap: 10,
        backgroundColor: theme.chromeMuted,
        opacity: 0.6,
      }}
    >
      <View style={{ height: 12, width: '70%', borderRadius: 4, backgroundColor: theme.border }} />
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border }} />
    </View>
  );
}

export function AltCardSkeletonList() {
  return (
    <View style={{ gap: 10 }}>
      <AltSkel />
      <AltSkel />
      <AltSkel />
    </View>
  );
}
