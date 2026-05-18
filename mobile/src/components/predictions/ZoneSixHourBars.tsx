import { Pressable, Text, View } from 'react-native';

import { colors } from '../../design-system';
import { haptics } from '../../design-system';
import type { ForecastWarning, WarningLevel } from '../../services/apiForecasts';
import { useThemeColors } from '../../hooks/useThemeColors';
import { FORECAST_HOUR_LABELS, zoneChartForZone } from '../../utils/forecastUtils';
import { LevelBadge } from './LevelBadge';

const LEVEL_COLOR: Record<WarningLevel, string> = {
  low: colors.statusGood,
  moderate: colors.statusCaution,
  high: colors.statusAvoid,
  critical: colors.statusAvoid,
};

const BAR_MAX = 72;

type Props = {
  warnings: ForecastWarning[];
  zoneName: string;
  selectedHour: number;
  onSelectHour: (h: number) => void;
};

export function ZoneSixHourBars({ warnings, zoneName, selectedHour, onSelectHour }: Props) {
  const theme = useThemeColors();
  const chart = zoneChartForZone(warnings, zoneName);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.tabActive, letterSpacing: 1 }}>
        6-HOUR FORECAST
      </Text>
      {chart.map((d, i) => {
        const pct = Math.round(d.occ * 100);
        const barH = Math.max(8, (pct / 100) * BAR_MAX);
        const c = LEVEL_COLOR[d.level] ?? colors.statusUnknown;
        const selected = i === selectedHour;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              onSelectHour(i);
            }}
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 44 }}
          >
            <Text
              style={{
                width: 36,
                fontSize: 11,
                fontWeight: '700',
                textAlign: 'right',
                color: selected ? c : theme.textSecondary,
              }}
            >
              {FORECAST_HOUR_LABELS[i]}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View
                style={{
                  height: BAR_MAX,
                  justifyContent: 'flex-end',
                  flex: 1,
                  backgroundColor: theme.border,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: barH,
                    backgroundColor: selected ? c : `${c}aa`,
                    borderRadius: 8,
                    minWidth: 40,
                    justifyContent: 'center',
                    paddingHorizontal: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{pct}%</Text>
                </View>
              </View>
              <LevelBadge level={d.level} small />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
