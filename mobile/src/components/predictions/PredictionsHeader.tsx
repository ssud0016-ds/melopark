import type { ReactNode } from 'react';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { haptics } from '../../design-system';
import { PREDICTIONS_GRADIENT, predictionsHeaderMuted } from './predictionsTheme';

type Props = {
  fetchedLabel: string;
  onRefresh: () => void;
  refreshing?: boolean;
  zoneSearch: ReactNode;
  kpiStrip: ReactNode;
};

export function PredictionsHeader({ fetchedLabel, onRefresh, refreshing, zoneSearch, kpiStrip }: Props) {
  const [h, setH] = useState(280);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) setH(next);
  };

  return (
    <View style={{ marginHorizontal: -20, marginBottom: 4, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h }}>
        <Svg width="100%" height={h} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="predHdr" x1="0%" y1="0%" x2="100%" y2="100%">
              {PREDICTIONS_GRADIENT.colors.map((c, i) => (
                <Stop
                  key={c}
                  offset={`${(PREDICTIONS_GRADIENT.locations[i] ?? 0) * 100}%`}
                  stopColor={c}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#predHdr)" />
        </Svg>
      </View>

      <View onLayout={onLayout} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }}>
              Parking Predictions
            </Text>
            <Text style={{ fontSize: 12, color: predictionsHeaderMuted() }}>
              Melbourne CBD · 6-hour forecast · SCATS traffic data
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' }} />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fetchedLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh forecasts"
              onPress={() => {
                haptics.selection();
                onRefresh();
              }}
              disabled={refreshing}
              style={{
                padding: 6,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.1)',
                opacity: refreshing ? 0.4 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>↺</Text>
            </Pressable>
          </View>
        </View>

        {zoneSearch}
        {kpiStrip}
      </View>
    </View>
  );
}
