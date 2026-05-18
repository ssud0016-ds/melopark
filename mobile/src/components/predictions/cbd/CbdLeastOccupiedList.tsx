import { Pressable, Text, View } from 'react-native';

import { haptics } from '../../../design-system';
import type { ForecastWarning } from '../../../services/apiForecasts';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { PREDICTIONS_TEAL, predictionsSectionLabel } from '../predictionsTheme';
import { FORECAST_TIERS, occupancyPct, splitZone } from '../../../utils/forecastUtils';
import { LevelBadge } from '../LevelBadge';
import { MapGoActions } from '../MapGoActions';

type Props = {
  zones: ForecastWarning[];
  selectedZoneName?: string | null;
  onSelect: (z: ForecastWarning) => void;
  onMap: (lat: number, lon: number, label?: string) => void;
};

export function CbdLeastOccupiedList({ zones, selectedZoneName, onSelect, onMap }: Props) {
  const { dark } = useDarkMode();
  const sectionColor = predictionsSectionLabel(dark);
  const rowBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(238,240,250,0.8)';
  const rowBorder = dark ? '#1e2a3a' : '#d5d8ef';

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: dark ? 'rgba(29,158,117,0.2)' : '#E8F8F2',
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: PREDICTIONS_TEAL }}>now</Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
            color: sectionColor,
            textTransform: 'uppercase',
          }}
        >
          Least occupied
        </Text>
      </View>
      {zones.length === 0 ? (
        <Text style={{ fontSize: 13, color: sectionColor }}>No zone data right now.</Text>
      ) : (
        zones.map((z) => {
          const [main, cross] = splitZone(z.zone);
          const pct = occupancyPct(z);
          const t = FORECAST_TIERS[z.warning_level];
          const selected = selectedZoneName === z.zone;
          return (
            <Pressable
              key={`free-${z.zone}`}
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                onSelect(z);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected ? t.border : rowBorder,
                backgroundColor: selected ? (dark ? t.bgDark : t.bg) : rowBg,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: dark ? '#e2e8f0' : '#1e293b' }}
                  numberOfLines={1}
                >
                  {main}
                </Text>
                {cross ? (
                  <Text style={{ fontSize: 11, color: sectionColor }} numberOfLines={1}>
                    {cross}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 88 }}>
                <View
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: dark ? '#1e2a3a' : '#d5d8ef',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.color }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: t.color, width: 36, textAlign: 'right' }}>
                  {pct}%
                </Text>
              </View>
              {z.zone_lat != null && z.zone_lon != null ? (
                <MapGoActions
                  lat={z.zone_lat}
                  lon={z.zone_lon}
                  onMap={() => onMap(z.zone_lat!, z.zone_lon!, z.zone)}
                  compact
                />
              ) : null}
            </Pressable>
          );
        })
      )}
    </View>
  );
}
