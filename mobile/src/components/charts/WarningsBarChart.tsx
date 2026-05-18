import { Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { colors, statusColor } from '../../design-system';
import type { ForecastWarning, WarningLevel } from '../../services/apiForecasts';

const HEIGHT = 180;
const BAR_GAP = 4;
const LEVEL_VALUE: Record<WarningLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};
export function warningChartColor(level: WarningLevel, colorBlindMode = false) {
  if (level === 'low') return statusColor('good', colorBlindMode);
  if (level === 'moderate') return statusColor('caution', colorBlindMode);
  return statusColor('avoid', colorBlindMode);
}

type Props = {
  warnings: ForecastWarning[];
  width: number;
  colorBlindMode?: boolean;
};

// Plan §15: bar chart in PredictionsScreen.
// Bars = next-N hours, height = warning level. Pure SVG, no chart lib.
export function WarningsBarChart({ warnings, width, colorBlindMode = false }: Props) {
  const sorted = [...warnings].sort((a, b) => a.hours_from_now - b.hours_from_now).slice(0, 12);
  if (!sorted.length) {
    return <Empty width={width} />;
  }

  const barWidth = Math.max(8, (width - BAR_GAP * (sorted.length + 1)) / sorted.length);
  const max = 4;

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        {sorted.map((w, i) => {
          const value = LEVEL_VALUE[w.warning_level] || 1;
          const h = (value / max) * (HEIGHT - 30);
          return (
            <Rect
              key={warningBarKey('bar', w, i)}
              x={BAR_GAP + i * (barWidth + BAR_GAP)}
              y={HEIGHT - 20 - h}
              width={barWidth}
              height={h}
              rx={4}
              fill={warningChartColor(w.warning_level, colorBlindMode)}
            />
          );
        })}
        {sorted.map((w, i) => (
          <SvgText
            key={warningBarKey('label', w, i)}
            x={BAR_GAP + i * (barWidth + BAR_GAP) + barWidth / 2}
            y={HEIGHT - 4}
            fontSize={9}
            fill={colors.surfaceDarkTertiary}
            textAnchor="middle"
          >
            +{w.hours_from_now}h
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function warningBarKey(kind: 'bar' | 'label', warning: ForecastWarning, index: number) {
  return `warning-chart-${kind}:${warning.zone}:${warning.warning_level}:${warning.hours_from_now}:${index}`;
}

function Empty({ width }: { width: number }) {
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
      <Text style={{ color: colors.surfaceDarkTertiary }}>No warnings in the next 12 hours.</Text>
    </View>
  );
}
