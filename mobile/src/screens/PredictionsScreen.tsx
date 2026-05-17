import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlternativesLineChart } from '../components/charts/AlternativesLineChart';
import { WarningsBarChart } from '../components/charts/WarningsBarChart';
import { colors, haptics } from '../design-system';
import { useParkingForecast } from '../hooks/useParkingForecast';
import type { ForecastWarning, WarningLevel } from '../services/apiForecasts';

const LEVEL_COLOR: Record<WarningLevel, string> = {
  low: colors.statusGood,
  moderate: colors.statusCaution,
  high: colors.statusAvoid,
  critical: colors.statusAvoid,
};

export function PredictionsScreen() {
  const insets = useSafeAreaInsets();
  const [chartWidth, setChartWidth] = useState(0);
  const { warnings, zoneWarnings, alternatives, loading, error, refresh, worstLevel } =
    useParkingForecast({ enabled: true });

  const summary = useMemo(() => {
    if (worstLevel === 'low') return 'Calm — most zones available.';
    if (worstLevel === 'moderate') return 'Some pressure expected soon.';
    return 'High demand expected — plan ahead.';
  }, [worstLevel]);

  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <View className="gap-1 px-6 pb-3 pt-4">
        <Text className="font-sans text-2xl font-bold text-brand dark:text-accent">
          Predictions
        </Text>
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-300">{summary}</Text>
      </View>

      <FlatList
        ListHeaderComponent={
          <View className="gap-4 px-6 pb-4">
            {error ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.statusAvoidBg,
                }}
              >
                <Text style={{ color: colors.statusAvoid }}>Forecast unavailable: {error}</Text>
              </View>
            ) : null}

            <View
              className="gap-2 rounded-2xl bg-surface-tertiary p-4 dark:bg-surface-dark-secondary"
              onLayout={onChartLayout}
            >
              <Text className="font-sans text-xs font-medium uppercase text-brand dark:text-accent">
                Next 12 hours
              </Text>
              {loading && !warnings.length ? (
                <ActivityIndicator color={colors.brand} />
              ) : chartWidth > 0 ? (
                <WarningsBarChart warnings={warnings} width={chartWidth - 32} />
              ) : null}
            </View>

            <View className="gap-2 rounded-2xl bg-surface-tertiary p-4 dark:bg-surface-dark-secondary">
              <Text className="font-sans text-xs font-medium uppercase text-brand dark:text-accent">
                Alternative zones
              </Text>
              {chartWidth > 0 ? (
                <AlternativesLineChart data={alternatives} width={chartWidth - 32} />
              ) : null}
            </View>

            <Text className="mt-2 font-sans text-xs font-medium uppercase text-brand dark:text-accent">
              Busiest zones
            </Text>
          </View>
        }
        data={zoneWarnings}
        keyExtractor={(w) => `${w.zone}-${w.hours_from_now}`}
        renderItem={({ item }) => <BusiestRow w={item} />}
        ItemSeparatorComponent={() => (
          <View className="mx-6 h-px bg-surface-tertiary dark:bg-surface-dark-secondary" />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          loading ? null : (
            <View className="px-6 py-4">
              <Text className="font-sans text-sm text-gray-500">No zone warnings right now.</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={() => {
          haptics.selection();
          refresh();
        }}
      />
    </View>
  );
}

function BusiestRow({ w }: { w: ForecastWarning }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => haptics.selection()}
      className="min-h-[44px] flex-row items-center gap-3 px-6 py-3"
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
        <Text className="font-sans text-sm font-semibold text-gray-900 dark:text-gray-300">
          {w.zone}
        </Text>
        <Text className="font-sans text-xs text-gray-500">
          {w.warning_level} · +{w.hours_from_now}h
        </Text>
      </View>
    </Pressable>
  );
}
