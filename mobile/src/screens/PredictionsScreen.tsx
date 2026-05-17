import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlternativesLineChart } from '../components/charts/AlternativesLineChart';
import { WarningsBarChart } from '../components/charts/WarningsBarChart';
import { SearchBar } from '../components/chrome/SearchBar';
import { colors, haptics, nativeSearchBarHeight, nativeTabBarHeight } from '../design-system';
import { useDestination } from '../hooks/useDestination';
import { useParkingForecast } from '../hooks/useParkingForecast';
import type { TabParamList } from '../navigation/types';
import type { ForecastWarning, WarningLevel } from '../services/apiForecasts';

const LEVEL_COLOR: Record<WarningLevel, string> = {
  low: colors.statusGood,
  moderate: colors.statusCaution,
  high: colors.statusAvoid,
  critical: colors.statusAvoid,
};

type Nav = BottomTabNavigationProp<TabParamList, 'PredictionsTab'>;

export function PredictionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { destination, setDestination, clearDestination } = useDestination();
  const [chartWidth, setChartWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showAllBusiest, setShowAllBusiest] = useState(false);
  const { warnings, zoneWarnings, alternatives, loading, error, refresh, worstLevel } = useParkingForecast({
    enabled: true,
  });

  const summary = useMemo(() => {
    if (worstLevel === 'low') return 'Calm — most zones available.';
    if (worstLevel === 'moderate') return 'Some pressure expected soon.';
    return 'High demand expected — plan ahead.';
  }, [worstLevel]);

  const veryBusy = worstLevel === 'critical' || worstLevel === 'high';
  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const visibleBusiest = showAllBusiest ? zoneWarnings : zoneWarnings.slice(0, 3);

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <SearchBar
        destination={destination}
        onPick={(l) => {
          setDestination(l);
          navigation.navigate('MapTab');
        }}
        onClear={clearDestination}
        onSettingsOpen={() => navigation.navigate('MapTab')}
        onNavTrigger={() => navigation.navigate('MapTab')}
        variant="predictions"
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + nativeSearchBarHeight + 24,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + nativeTabBarHeight + 24,
          gap: 16,
        }}
        refreshControl={undefined}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>Parking Predictions</Text>
          <Text style={{ fontSize: 13, color: colors.surfaceDarkTertiary }}>
            Melbourne CBD · 6-hour forecast · {summary}
          </Text>
        </View>

        {error ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.statusAvoidBg }}>
            <Text style={{ color: colors.statusAvoid }}>Forecast unavailable: {error}</Text>
          </View>
        ) : null}

        <View
          onLayout={onChartLayout}
          style={{
            gap: 8,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surfaceTertiary,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, letterSpacing: 1 }}>
              CBD DEMAND
            </Text>
            {veryBusy ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.statusAvoidBg }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.statusAvoid }}>Very busy</Text>
              </View>
            ) : null}
          </View>
          {loading && warnings.length === 0 ? (
            <ActivityIndicator color={colors.brand} />
          ) : chartWidth > 0 ? (
            <WarningsBarChart warnings={warnings} width={chartWidth - 32} />
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            setExpanded((v) => !v);
          }}
          style={{
            minHeight: 44,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceTertiary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.brand, fontWeight: '700' }}>
            {expanded ? 'Hide forecast & zone detail' : 'Show forecast & zone detail'}
          </Text>
        </Pressable>

        {expanded ? (
          <>
            <View
              style={{
                gap: 8,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.surfaceTertiary,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, letterSpacing: 1 }}>
                FORECAST TREND
              </Text>
              {chartWidth > 0 ? <AlternativesLineChart data={alternatives} width={chartWidth - 32} /> : null}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, letterSpacing: 1 }}>
                BUSIEST AREAS NOW
              </Text>
              {visibleBusiest.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.surfaceDarkTertiary }}>No zone warnings right now.</Text>
              ) : (
                visibleBusiest.map((w) => <BusiestRow key={`${w.zone}-${w.hours_from_now}`} w={w} />)
              )}
              {zoneWarnings.length > 3 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllBusiest((v) => !v)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.brand, fontWeight: '600' }}>
                    {showAllBusiest ? 'Show fewer' : `See all ${zoneWarnings.length} busiest →`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            refresh();
          }}
          style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: colors.surfaceDarkTertiary, fontSize: 12 }}>↺ Refresh</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function BusiestRow({ w }: { w: ForecastWarning }) {
  return (
    <View
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: LEVEL_COLOR[w.warning_level] || colors.statusUnknown,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>{w.zone}</Text>
        <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>
          {w.warning_level} · +{w.hours_from_now}h
        </Text>
      </View>
    </View>
  );
}
