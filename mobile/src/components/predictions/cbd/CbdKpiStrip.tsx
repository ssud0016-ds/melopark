import { Text, View } from 'react-native';

import {
  PREDICTIONS_KPI_GLASS,
  PREDICTIONS_TEAL,
  predictionsKpiLabel,
  predictionsKpiSub,
} from '../predictionsTheme';

type KpiItem = {
  label: string;
  value: string;
  sub: string;
  color: string;
  small?: boolean;
};

type Props = {
  items: KpiItem[];
  variant?: 'default' | 'header';
};

const KPI_ICONS = ['✓', '◷', '❧', 'P'] as const;

export function CbdKpiStrip({ items, variant = 'header' }: Props) {
  const header = variant === 'header';

  if (!header) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((s, i) => (
        <View
          key={`kpi-${i}`}
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: PREDICTIONS_KPI_GLASS.backgroundColor,
            borderWidth: 1,
            borderColor: PREDICTIONS_KPI_GLASS.borderColor,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: s.color }}>{KPI_ICONS[i] ?? '•'}</Text>
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 0.4,
                color: predictionsKpiLabel(),
                textTransform: 'uppercase',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </View>
          <Text
            style={{
              fontSize: s.small ? 13 : 18,
              fontWeight: '700',
              color: s.color,
            }}
            numberOfLines={1}
          >
            {s.value}
          </Text>
          <Text style={{ fontSize: 10, marginTop: 2, color: predictionsKpiSub() }} numberOfLines={1}>
            {s.sub}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function buildKpiItems(input: {
  cbdFree: number;
  cbdTierLabel: string;
  peakLabel: string;
  peakPct: number;
  bestMain: string;
  bestOccPct: number;
  zoneCount: number;
}): KpiItem[] {
  const freeColor =
    input.cbdFree >= 60 ? PREDICTIONS_TEAL : input.cbdFree >= 40 ? '#BA7517' : '#D85A30';
  return [
    {
      label: 'Available bays',
      value: `${input.cbdFree}%`,
      sub: `${input.cbdTierLabel} pressure`,
      color: freeColor,
    },
    {
      label: `Busiest ${input.peakLabel}`,
      value: `${input.peakPct}%`,
      sub: 'CBD avg occupied',
      color: '#BA7517',
    },
    {
      label: 'Most available',
      value: input.bestMain,
      sub: `${input.bestOccPct}% occupied`,
      color: PREDICTIONS_TEAL,
      small: true,
    },
    {
      label: 'Zones live',
      value: `${input.zoneCount}`,
      sub: 'every 5 min',
      color: '#9d8fef',
    },
  ];
}
