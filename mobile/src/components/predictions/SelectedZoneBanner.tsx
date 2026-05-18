import { Pressable, Text, View } from 'react-native';

import { colors, haptics } from '../../design-system';
import type {
  ForecastAlternativesResponse,
  ForecastTargetZone,
  ForecastWarning,
} from '../../services/apiForecasts';
import { useThemeColors } from '../../hooks/useThemeColors';
import { occupancyPct, splitZone } from '../../utils/forecastUtils';
import { AltCard, AltCardSkeletonList } from './AltCard';
import { LevelBadge } from './LevelBadge';
import { MapGoActions } from './MapGoActions';
import { ZoneSixHourBars } from './ZoneSixHourBars';

type Props = {
  zone: ForecastWarning;
  warnings: ForecastWarning[];
  alternatives: ForecastAlternativesResponse | null;
  alternativesLoading: boolean;
  selectedHour: number;
  onSelectHour: (h: number) => void;
  onClose: () => void;
  onMap: (lat: number, lon: number, label?: string) => void;
};

function normalizeTarget(
  target: ForecastAlternativesResponse['target_zone'],
): ForecastTargetZone | null {
  if (!target || typeof target === 'string') return null;
  return target;
}

export function SelectedZoneBanner({
  zone,
  warnings,
  alternatives,
  alternativesLoading,
  selectedHour,
  onSelectHour,
  onClose,
  onMap,
}: Props) {
  const theme = useThemeColors();
  const [main, cross] = splitZone(zone.zone);
  const pct = occupancyPct(zone);
  const lat = zone.zone_lat;
  const lon = zone.zone_lon;
  const tierColor =
    zone.warning_level === 'low'
      ? colors.statusGood
      : zone.warning_level === 'moderate'
        ? colors.statusCaution
        : colors.statusAvoid;

  const altList = alternatives?.alternatives?.slice(0, 5) ?? [];
  const isLoad = alternativesLoading || alternatives === null;
  const tgt = normalizeTarget(alternatives?.target_zone ?? null);

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderColor: tierColor,
        backgroundColor: theme.chromeMuted,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 4, backgroundColor: tierColor }} />
      <View style={{ padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>{main}</Text>
            {cross ? <Text style={{ fontSize: 12, color: theme.textSecondary }}>{cross}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <LevelBadge level={zone.warning_level} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close zone details"
              onPress={() => {
                haptics.selection();
                onClose();
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.chrome,
              }}
            >
              <Text style={{ fontSize: 16, color: theme.textSecondary }}>×</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: tierColor }}>{pct}%</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }}>of bays occupied now</Text>
          <MapGoActions
            lat={lat}
            lon={lon}
            onMap={() => {
              if (lat != null && lon != null) onMap(lat, lon, zone.zone);
            }}
            compact
          />
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: tierColor }} />
        </View>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        <ZoneSixHourBars
          warnings={warnings}
          zoneName={zone.zone}
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
        />

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.tabActive, letterSpacing: 1 }}>
              NEARBY ALTERNATIVE PARKING
            </Text>
            {isLoad ? (
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>Finding…</Text>
            ) : (
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{altList.length} options</Text>
            )}
          </View>

          {isLoad ? <AltCardSkeletonList /> : null}

          {!isLoad && tgt ? (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.chrome,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.statusGood, letterSpacing: 0.5 }}>
                YOUR DESTINATION
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                {splitZone(tgt.zone ?? '')[0]}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                {Math.round((tgt.predicted_occ ?? 0) * 100)}% occupied
              </Text>
            </View>
          ) : null}

          {!isLoad && altList.length > 0 ? (
            <View style={{ gap: 10 }}>
              {altList.map((a, i) => (
                <AltCard
                  key={`alt-${i}-${a.zone_lat ?? ''}-${a.zone_lon ?? ''}`}
                  alt={a}
                  rank={i + 1}
                  onMap={() => {
                    const aLat = a.zone_lat;
                    const aLon = a.zone_lon;
                    if (aLat != null && aLon != null) onMap(aLat, aLon, a.zone);
                  }}
                />
              ))}
            </View>
          ) : null}

          {!isLoad && altList.length === 0 ? (
            <View
              style={{
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.statusGood,
                backgroundColor: theme.statusGoodBg,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.statusGood }}>Good availability</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>No busier alternatives nearby</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
