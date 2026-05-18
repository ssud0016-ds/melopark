import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlternativesLineChart } from '../components/charts/AlternativesLineChart';
import { buildKpiItems, CbdKpiStrip } from '../components/predictions/cbd/CbdKpiStrip';
import { CbdDemandOverview } from '../components/predictions/cbd/CbdDemandOverview';
import { EventsNearbySection } from '../components/predictions/EventsNearbySection';
import { MapGoActions } from '../components/predictions/MapGoActions';
import { PredictionsHeader } from '../components/predictions/PredictionsHeader';
import { SelectedZoneBanner } from '../components/predictions/SelectedZoneBanner';
import { ZoneSearch } from '../components/predictions/ZoneSearch';
import { predictionsCardBorder, predictionsPageBg } from '../components/predictions/predictionsTheme';
import { colors, haptics, nativeTabBarHeight } from '../design-system';
import { useCbdForecastDerived } from '../hooks/useCbdForecastDerived';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMapFlyTarget } from '../hooks/useMapFlyTarget';
import { useParkingForecast } from '../hooks/useParkingForecast';
import { useThemeColors } from '../hooks/useThemeColors';
import type { TabParamList } from '../navigation/types';
import type { ForecastWarning, WarningLevel } from '../services/apiForecasts';
import { FORECAST_TIERS, occupancyPct, splitZone } from '../utils/forecastUtils';

type Nav = BottomTabNavigationProp<TabParamList, 'PredictionsTab'>;

export function PredictionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { dark } = useDarkMode();
  const theme = useThemeColors();
  const { setFlyTarget } = useMapFlyTarget();
  const [chartWidth, setChartWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showAllBusiest, setShowAllBusiest] = useState(false);
  const [zoneQuery, setZoneQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<ForecastWarning | null>(null);
  const [selectedHour, setSelectedHour] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const selectedCoords = useMemo(() => {
    if (!selectedZone?.zone_lat || !selectedZone?.zone_lon) return null;
    return { lat: selectedZone.zone_lat, lng: selectedZone.zone_lon };
  }, [selectedZone?.zone_lat, selectedZone?.zone_lon]);

  const {
    warnings,
    alternatives,
    loading,
    alternativesLoading,
    error,
    refresh,
  } = useParkingForecast({
    enabled: true,
    selectedZone: selectedCoords,
  });

  const derived = useCbdForecastDerived(warnings);

  const kpiItems = useMemo(
    () =>
      buildKpiItems({
        cbdFree: derived.cbdFree,
        cbdTierLabel: derived.cbdTier.label,
        peakLabel: derived.peakLabel,
        peakPct: derived.peakPct,
        bestMain: derived.bestMain,
        bestOccPct: derived.best ? occupancyPct(derived.best) : 0,
        zoneCount: derived.zones.length,
      }),
    [derived],
  );

  const fetchedLabel = useMemo(() => {
    if (!fetchedAt) return 'Live';
    return fetchedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }, [fetchedAt]);

  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const visibleBusiest = showAllBusiest ? derived.busiest : derived.busiest.slice(0, 3);

  const openOnMap = useCallback(
    (lat: number, lon: number, label?: string) => {
      setFlyTarget({ lat, lng: lon, label });
      navigation.navigate('MapTab');
    },
    [navigation, setFlyTarget],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setFetchedAt(new Date());
    setRefreshing(false);
  }, [refresh]);

  const pickZone = useCallback((z: ForecastWarning) => {
    setSelectedZone(z);
    setZoneQuery(z.zone);
    setExpanded(true);
  }, []);

  const pageBg = predictionsPageBg(dark);
  const cardBd = predictionsCardBorder(dark);

  useEffect(() => {
    if (warnings.length > 0 && !fetchedAt) setFetchedAt(new Date());
  }, [warnings.length, fetchedAt]);

  return (
    <View className="flex-1" style={{ backgroundColor: pageBg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + nativeTabBarHeight + 24,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        <PredictionsHeader
          fetchedLabel={fetchedLabel}
          onRefresh={onRefresh}
          refreshing={refreshing}
          zoneSearch={
            <ZoneSearch
              variant="header"
              warnings={warnings}
              value={zoneQuery}
              onChangeQuery={setZoneQuery}
              onPick={pickZone}
            />
          }
          kpiStrip={!loading && warnings.length > 0 ? <CbdKpiStrip items={kpiItems} variant="header" /> : null}
        />

        {error ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.statusAvoidBg }}>
            <Text style={{ color: colors.statusAvoid }}>Forecast unavailable: {error}</Text>
          </View>
        ) : null}

        <CbdDemandOverview
          derived={derived}
          loading={loading && warnings.length === 0}
          selectedHour={selectedHour}
          onSelectHour={setSelectedHour}
          selectedZoneName={selectedZone?.zone}
          onPickZone={pickZone}
          onMap={openOnMap}
          onLayout={onChartLayout}
        />

        <EventsNearbySection warnings={warnings} />

        {selectedZone ? (
          <SelectedZoneBanner
            zone={selectedZone}
            warnings={warnings}
            alternatives={alternatives}
            alternativesLoading={alternativesLoading}
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
            onClose={() => {
              setSelectedZone(null);
              setZoneQuery('');
            }}
            onMap={openOnMap}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            setExpanded((v) => !v);
          }}
          style={{
            minHeight: 44,
            borderRadius: 12,
            backgroundColor: dark ? '#0f172a' : colors.surface,
            borderWidth: 1,
            borderColor: cardBd,
          }}
        >
          <Text style={{ color: theme.tabActive, fontWeight: '700', textAlign: 'center', paddingVertical: 12 }}>
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
                backgroundColor: dark ? '#0f172a' : '#F2F4FD',
                borderWidth: 2,
                borderColor: dark ? 'rgba(255,255,255,0.08)' : '#c8ccec',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  color: dark ? '#64748b' : '#94a3b8',
                  textTransform: 'uppercase',
                }}
              >
                Forecast trend
              </Text>
              {chartWidth > 0 ? (
                <AlternativesLineChart
                  data={alternatives}
                  width={chartWidth - 32}
                  emptyMessage={
                    selectedZone
                      ? 'No alternative trend data for this zone.'
                      : 'Search a zone above to see alternatives.'
                  }
                />
              ) : null}
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  color: dark ? '#64748b' : '#94a3b8',
                  textTransform: 'uppercase',
                }}
              >
                Busiest areas now
              </Text>
              {visibleBusiest.length === 0 ? (
                <Text style={{ fontSize: 13, color: dark ? '#64748b' : '#94a3b8' }}>
                  No zone warnings right now.
                </Text>
              ) : (
                visibleBusiest.map((w) => (
                  <BusiestRow
                    key={`busy-${w.zone}`}
                    w={w}
                    dark={dark}
                    onSelect={() => pickZone(w)}
                    onMap={() => {
                      if (w.zone_lat != null && w.zone_lon != null) {
                        openOnMap(w.zone_lat, w.zone_lon, w.zone);
                      }
                    }}
                  />
                ))
              )}
              {derived.busiest.length > 3 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllBusiest((v) => !v)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.tabActive, fontWeight: '600' }}>
                    {showAllBusiest ? 'Show fewer' : `See all ${derived.busiest.length} busiest →`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BusiestRow({
  w,
  dark,
  onSelect,
  onMap,
}: {
  w: ForecastWarning;
  dark: boolean;
  onSelect: () => void;
  onMap: () => void;
}) {
  const [main, cross] = splitZone(w.zone);
  const pct = occupancyPct(w);
  const t = FORECAST_TIERS[w.warning_level];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: dark ? '#1e293b' : '#e8eaf8',
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: dark ? '#e2e8f0' : '#1e293b' }}>{main}</Text>
        {cross ? <Text style={{ fontSize: 12, color: dark ? '#64748b' : '#94a3b8' }}>{cross}</Text> : null}
        <Text style={{ fontSize: 12, color: dark ? '#64748b' : '#94a3b8' }}>
          {w.warning_level} · {pct}% · tap for detail
        </Text>
      </View>
      {w.zone_lat != null && w.zone_lon != null ? (
        <MapGoActions lat={w.zone_lat} lon={w.zone_lon} onMap={onMap} compact />
      ) : null}
    </Pressable>
  );
}
