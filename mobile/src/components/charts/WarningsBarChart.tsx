import { Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '../../design-system';
import type { CbdHourPoint } from '../../utils/forecastUtils';
import { FORECAST_HOUR_LABELS, FORECAST_TIERS } from '../../utils/forecastUtils';

const HEIGHT = 180;
const BAR_GAP = 6;

type Props = {
  /** Web cbdChart — 7 hourly CBD averages, not raw zone rows. */
  chart: CbdHourPoint[];
  width: number;
};

export function WarningsBarChart({ chart, width }: Props) {
  if (!chart.length) {
    return <Empty width={width} />;
  }

  const barWidth = Math.max(12, (width - BAR_GAP * (chart.length + 1)) / chart.length);
  const maxOcc = Math.max(0.2, ...chart.map((d) => d.occ));

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        {chart.map((d, i) => {
          const pct = Math.round(d.occ * 100);
          const h = Math.max(8, (d.occ / maxOcc) * (HEIGHT - 30));
          const fill = FORECAST_TIERS[d.level]?.color ?? colors.statusUnknown;
          return (
            <Rect
              key={`cbd-hour-${d.h}`}
              x={BAR_GAP + i * (barWidth + BAR_GAP)}
              y={HEIGHT - 20 - h}
              width={barWidth}
              height={h}
              rx={4}
              fill={fill}
            />
          );
        })}
        {chart.map((d, i) => (
          <SvgText
            key={`cbd-label-${d.h}`}
            x={BAR_GAP + i * (barWidth + BAR_GAP) + barWidth / 2}
            y={HEIGHT - 4}
            fontSize={9}
            fill={colors.surfaceDarkTertiary}
            textAnchor="middle"
          >
            {FORECAST_HOUR_LABELS[i] ?? `+${d.h}h`}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
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
      <Text style={{ color: colors.surfaceDarkTertiary }}>No forecast data.</Text>
    </View>
  );
}
