import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useDarkMode } from '../../../hooks/useDarkMode';
import type { WarningLevel } from '../../../services/apiForecasts';
import type { CbdSignal } from '../../../utils/forecastUtils';
import { FORECAST_TIERS } from '../../../utils/forecastUtils';
import { predictionsSectionLabel } from '../predictionsTheme';

type Props = {
  pct: number;
  level: WarningLevel;
  signals: CbdSignal[];
};

export function CbdLiveSignals({ pct, level, signals }: Props) {
  const { dark } = useDarkMode();
  const tier = FORECAST_TIERS[level];
  const sectionColor = predictionsSectionLabel(dark);
  const divider = dark ? '#1e293b' : '#d5d8ef';
  const R = 44;
  const sw = 8;
  const r2 = R - sw;
  const circ = 2 * Math.PI * r2;
  const dash = (pct / 100) * circ;

  return (
    <View style={{ gap: 16 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.6,
          color: sectionColor,
          textTransform: 'uppercase',
        }}
      >
        Live signals
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 90, height: 90 }}>
          <Svg width={90} height={90}>
            <Circle cx={45} cy={45} r={r2} fill="none" stroke={tier.color} strokeWidth={sw} opacity={0.15} />
            <Circle
              cx={45}
              cy={45}
              r={r2}
              fill="none"
              stroke={tier.color}
              strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={circ / 4}
              strokeLinecap="round"
            />
          </Svg>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: dark ? '#fff' : '#0f172a' }}>{pct}%</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: tier.color }}>CBD</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#fff' : '#0f172a' }}>{tier.label}</Text>
          <Text style={{ fontSize: 12, color: sectionColor }}>
            {pct <= 40 ? 'Good to park' : 'Plan ahead'}
          </Text>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: divider, paddingTop: 12, gap: 0 }}>
        {signals.map((s, i) => {
          const t = FORECAST_TIERS[s.level];
          return (
            <View
              key={`signal-${i}-${s.head}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                borderBottomWidth: i < signals.length - 1 ? 1 : 0,
                borderBottomColor: dark ? '#1e293b' : '#e8eaf8',
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dark ? t.bgDark : t.bg,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: dark ? '#e2e8f0' : '#1e293b' }}
                  numberOfLines={1}
                >
                  {s.head}
                </Text>
                <Text style={{ fontSize: 12, color: sectionColor }} numberOfLines={1}>
                  {s.sub}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
