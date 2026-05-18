import { Pressable, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { haptics } from '../../../design-system';
import { useDarkMode } from '../../../hooks/useDarkMode';
import type { CbdHourPoint } from '../../../utils/forecastUtils';
import { FORECAST_HOUR_LABELS, FORECAST_TIERS } from '../../../utils/forecastUtils';
import { PREDICTIONS_BRAND, predictionsSectionLabel } from '../predictionsTheme';
import { describeDonutSegment } from './svgArc';

type Props = {
  chart: CbdHourPoint[];
  selectedHour: number;
  onSelectHour: (h: number) => void;
  width: number;
};

export function CbdDayDonut({ chart, selectedHour, onSelectHour, width }: Props) {
  const { dark } = useDarkMode();
  const sectionColor = predictionsSectionLabel(dark);
  const H = width + 40;
  const cx = width / 2;
  const cy = (H + 10) / 2;
  const R = width * 0.32;
  const thick = R * 0.26;
  const innerR = R - thick;
  const n = chart.length || 7;
  const slice = (2 * Math.PI) / n;
  const gap = 0.06;

  const cur = chart[selectedHour] ?? { occ: 0.19, level: 'low' as const };
  const curTier = FORECAST_TIERS[cur.level];
  const centerText = dark ? '#f1f5f9' : '#0f172a';

  return (
    <View style={{ width, gap: 10 }}>
      <Svg width={width} height={H}>
        {chart.map((d, i) => {
          const tier = FORECAST_TIERS[d.level];
          const isSel = i === selectedHour;
          const start = -Math.PI / 2 + i * slice + gap / 2;
          const end = -Math.PI / 2 + (i + 1) * slice - gap / 2;
          const outer = isSel ? R + 8 : R;
          const dPath = describeDonutSegment(cx, cy, innerR, outer, start, end);
          return (
            <Path
              key={`seg-${i}`}
              d={dPath}
              fill={tier.color}
              opacity={isSel ? 1 : 0.5}
              onPress={() => {
                haptics.selection();
                onSelectHour(i);
              }}
            />
          );
        })}
        <SvgText
          x={cx}
          y={cy - 8}
          fontSize={width * 0.14}
          fontWeight="700"
          fill={centerText}
          textAnchor="middle"
        >
          {Math.round(cur.occ * 100)}%
        </SvgText>
        <SvgText x={cx} y={cy + width * 0.1} fontSize={9} fill={curTier.color} textAnchor="middle">
          {curTier.label}
        </SvgText>
        <SvgText x={cx} y={cy + width * 0.1 + 13} fontSize={8} fill={sectionColor} textAnchor="middle">
          {FORECAST_HOUR_LABELS[selectedHour]}
        </SvgText>
      </Svg>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        {chart.map((d, i) => {
          const tier = FORECAST_TIERS[d.level];
          const isSel = i === selectedHour;
          return (
            <Pressable
              key={`chip-${i}`}
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                onSelectHour(i);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: isSel
                  ? tier.color
                  : dark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(46,42,138,0.1)',
                borderWidth: isSel ? 0 : 1,
                borderColor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(46,42,138,0.18)',
                ...(isSel ? { shadowColor: tier.color, shadowOpacity: 0.35, shadowRadius: 8 } : {}),
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isSel ? '#fff' : dark ? '#c7d2fe' : PREDICTIONS_BRAND,
                }}
              >
                {FORECAST_HOUR_LABELS[i]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        {[
          ['#1D9E75', 'Low'],
          ['#BA7517', 'Moderate'],
          ['#D85A30', 'High'],
        ].map(([c, l]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
            <Text style={{ fontSize: 10, color: sectionColor }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
