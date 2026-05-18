import { useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Text, View } from 'react-native';

import { colors } from '../../../design-system';
import type { ForecastWarning } from '../../../services/apiForecasts';
import { useDarkMode } from '../../../hooks/useDarkMode';
import type { CbdForecastDerived } from '../../../hooks/useCbdForecastDerived';
import {
  predictionsCardBg,
  predictionsCardBorder,
  predictionsSectionLabel,
  PREDICTIONS_BRAND,
} from '../predictionsTheme';
import { LevelBadge } from '../LevelBadge';
import { CbdArcLegend } from './CbdArcLegend';
import { CbdDayDonut } from './CbdDayDonut';
import { CbdLeastOccupiedList } from './CbdLeastOccupiedList';
import { CbdLiveSignals } from './CbdLiveSignals';
import { CbdPressureArc } from './CbdPressureArc';

type Props = {
  derived: CbdForecastDerived;
  loading: boolean;
  selectedHour: number;
  onSelectHour: (h: number) => void;
  selectedZoneName?: string | null;
  onPickZone: (z: ForecastWarning) => void;
  onMap: (lat: number, lon: number, label?: string) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

export function CbdDemandOverview({
  derived,
  loading,
  selectedHour,
  onSelectHour,
  selectedZoneName,
  onPickZone,
  onMap,
  onLayout,
}: Props) {
  const { dark } = useDarkMode();
  const cardBg = predictionsCardBg(dark);
  const cardBd = predictionsCardBorder(dark);
  const sectionColor = predictionsSectionLabel(dark);
  const [chartWidth, setChartWidth] = useState(0);

  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w - 48);
    onLayout?.(e);
  };

  return (
    <View
      onLayout={onCardLayout}
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderColor: cardBd,
        backgroundColor: cardBg,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: cardBd,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#fff' : '#0f172a' }}>
            CBD Demand Overview
          </Text>
          <Text style={{ fontSize: 12, color: sectionColor }}>
            Pressure spectrum · day demand · least occupied streets · live signals
          </Text>
        </View>
        <LevelBadge level={derived.worstLevel} />
      </View>

      {loading ? (
        <View style={{ padding: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : chartWidth > 0 ? (
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, gap: 28 }}>
          <View style={{ gap: 12 }}>
            <SectionLabel color={sectionColor} pulseColor={derived.cbdTier.color} title="Pressure spectrum" />
            <View style={{ alignItems: 'center' }}>
              <CbdPressureArc pct={derived.cbdOcc} level={derived.cbdLv} width={chartWidth} />
            </View>
            <CbdArcLegend />
          </View>

          <View style={{ gap: 12 }}>
            <DayDemandHeader sectionColor={sectionColor} dark={dark} />
            <View style={{ alignItems: 'center' }}>
              <CbdDayDonut
                chart={derived.cbdChart}
                selectedHour={selectedHour}
                onSelectHour={onSelectHour}
                width={chartWidth}
              />
            </View>
          </View>

          <CbdLeastOccupiedList
            zones={derived.topFree}
            selectedZoneName={selectedZoneName}
            onSelect={onPickZone}
            onMap={onMap}
          />

          <CbdLiveSignals pct={derived.cbdOcc} level={derived.cbdLv} signals={derived.signals} />
        </View>
      ) : null}
    </View>
  );
}

function SectionLabel({
  title,
  color,
  pulseColor,
}: {
  title: string;
  color: string;
  pulseColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pulseColor }} />
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color, textTransform: 'uppercase' }}>
        {title}
      </Text>
    </View>
  );
}

function DayDemandHeader({ sectionColor, dark }: { sectionColor: string; dark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <Text style={{ fontSize: 14, color: sectionColor }}>◷</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: sectionColor, textTransform: 'uppercase' }}>
        Day demand
      </Text>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(46,42,138,0.12)',
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(46,42,138,0.2)',
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: dark ? '#c7d2fe' : PREDICTIONS_BRAND,
          }}
        >
          tap segments
        </Text>
      </View>
    </View>
  );
}
