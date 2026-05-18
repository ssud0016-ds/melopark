import { Text, View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

import { colors } from '../../design-system';
import type { ForecastAlternativesResponse, WarningLevel } from '../../services/apiForecasts';

const HEIGHT = 140;
const LEVEL_VALUE: Record<WarningLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

type Props = {
  data: ForecastAlternativesResponse | null;
  width: number;
  emptyMessage?: string;
};

// Plan §15: line chart in PredictionsScreen.
// X = alternative index, Y = pressure level. Sparkline-style.
export function AlternativesLineChart({
  data,
  width,
  emptyMessage = 'Search a zone to see alternatives.',
}: Props) {
  const alts = data?.alternatives ?? [];
  if (!alts.length) {
    return (
      <View
        style={{
          width,
          height: HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceTertiary,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: colors.surfaceDarkTertiary, textAlign: 'center', paddingHorizontal: 12 }}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const padding = 12;
  const innerW = width - padding * 2;
  const innerH = HEIGHT - padding * 2;
  const stepX = alts.length > 1 ? innerW / (alts.length - 1) : 0;

  const points = alts.map((a, i) => {
    const level = a.pressure_level ?? 'low';
    const v = LEVEL_VALUE[level] || 1;
    const y = padding + innerH - ((v - 1) / 3) * innerH;
    const x = padding + i * stepX;
    return { x, y, level };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={HEIGHT}>
      <Polyline points={polylineStr} fill="none" stroke={colors.brand} strokeWidth={2} />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={
            p.level === 'low'
              ? colors.statusGood
              : p.level === 'moderate'
                ? colors.statusCaution
                : colors.statusAvoid
          }
        />
      ))}
    </Svg>
  );
}
