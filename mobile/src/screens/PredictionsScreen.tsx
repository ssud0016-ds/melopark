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
import { colors, haptics, statusColor } from '../design-system';
import { useColorBlindMode } from '../hooks/useColorBlindMode';
import { MELBOURNE_CBD_REGION } from '../hooks/useMapViewport';
import { LEVEL_ORDER, useParkingForecast } from '../hooks/useParkingForecast';
import type { ForecastWarning, PressureZone, WarningLevel } from '../services/apiForecasts';

type SectionKey = 'warnings' | 'zones' | 'busiest' | 'quietest' | 'alternatives';

export const PREDICTIONS_FALLBACK_LOCATION = {
  lat: MELBOURNE_CBD_REGION.latitude,
  lng: MELBOURNE_CBD_REGION.longitude,
};

export function warningLevelColor(level: WarningLevel, colorBlindMode = false) {
  if (level === 'low') return statusColor('good', colorBlindMode);
  if (level === 'moderate') return statusColor('caution', colorBlindMode);
  return statusColor('avoid', colorBlindMode);
}

export function PredictionsScreen() {
  const insets = useSafeAreaInsets();
  const { enabled: colorBlindMode } = useColorBlindMode();
  const [chartWidth, setChartWidth] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    warnings: false,
    zones: false,
    busiest: false,
    quietest: true,
    alternatives: true,
  });
  const {
    warnings,
    zoneWarnings,
    pressureZones,
    busiestZones,
    quietestZones,
    alternatives,
    loading,
    warningsLoading,
    pressureLoading,
    error,
    pressureError,
    refresh,
    worstLevel,
    pressure,
    arrivalIso,
  } = useParkingForecast({
    enabled: true,
    hoursAhead: 12,
    pressureLocation: PREDICTIONS_FALLBACK_LOCATION,
  });

  const summary = useMemo(() => {
    if (worstLevel === 'low') return 'Calm - most zones available.';
    if (worstLevel === 'moderate') return 'Some pressure expected soon.';
    return 'High demand expected - plan ahead.';
  }, [worstLevel]);

  const context = pressure?.arrival_at
    ? `Arrival ${formatDateTime(pressure.arrival_at)}`
    : arrivalIso
      ? `Arrival ${formatDateTime(arrivalIso)}`
      : 'Live forecast context';

  const onChartLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);
  const toggle = (key: SectionKey) => {
    haptics.selection();
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <View className="gap-1 px-6 pb-3 pt-4">
        <Text className="font-sans text-2xl font-bold text-brand dark:text-accent">
          Predictions
        </Text>
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-300">{summary}</Text>
        <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{context}</Text>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View className="gap-4 px-6 pb-4">
            <SummaryCards
              worstLevel={worstLevel}
              zoneCount={pressureZones.length}
              warningCount={warnings.length}
              loading={loading}
              colorBlindMode={colorBlindMode}
            />

            <ErrorBanner
              message={error}
              prefix="Warnings unavailable"
              colorBlindMode={colorBlindMode}
            />
            <ErrorBanner
              message={pressureError}
              prefix="Zone pressure unavailable"
              colorBlindMode={colorBlindMode}
            />

            <Section
              title="Warning levels"
              subtitle="Next 12 hours"
              collapsed={collapsed.warnings}
              loading={warningsLoading && !warnings.length}
              onToggle={() => toggle('warnings')}
            >
              <View onLayout={onChartLayout}>
                {chartWidth > 0 ? (
                  <WarningsBarChart
                    warnings={warnings}
                    width={chartWidth - 32}
                    colorBlindMode={colorBlindMode}
                  />
                ) : null}
              </View>
              {zoneWarnings.length ? (
                zoneWarnings.slice(0, 4).map((warning, index) => (
                  <WarningRow
                    key={warningRowKey('warnings', warning, index)}
                    warning={warning}
                    colorBlindMode={colorBlindMode}
                  />
                ))
              ) : (
                <EmptyMessage message="No warning levels returned for the forecast window." />
              )}
            </Section>

            <Section
              title="All zones"
              subtitle={`${pressureZones.length} forecast zones`}
              collapsed={collapsed.zones}
              loading={pressureLoading && !pressureZones.length}
              onToggle={() => toggle('zones')}
            >
              {pressureZones.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {pressureZones.map((zone, index) => (
                    <ZoneChip
                      key={pressureZoneKey('zones', zone, index)}
                      zone={zone}
                      colorBlindMode={colorBlindMode}
                    />
                  ))}
                </View>
              ) : (
                <EmptyMessage message="No all-zone pressure data is available right now." />
              )}
            </Section>

            <Section
              title="Busiest zones"
              subtitle="Highest pressure first"
              collapsed={collapsed.busiest}
              loading={pressureLoading && !busiestZones.length}
              onToggle={() => toggle('busiest')}
            >
              {busiestZones.length ? (
                busiestZones.map((zone, index) => (
                  <ZoneRow
                    key={pressureZoneKey('busiest', zone, index)}
                    zone={zone}
                    colorBlindMode={colorBlindMode}
                  />
                ))
              ) : (
                <EmptyMessage message="No busy zones returned." />
              )}
            </Section>

            <Section
              title="Quietest zones"
              subtitle="Lowest pressure first"
              collapsed={collapsed.quietest}
              loading={pressureLoading && !quietestZones.length}
              onToggle={() => toggle('quietest')}
            >
              {quietestZones.length ? (
                quietestZones.map((zone, index) => (
                  <ZoneRow
                    key={pressureZoneKey('quietest', zone, index)}
                    zone={zone}
                    colorBlindMode={colorBlindMode}
                  />
                ))
              ) : (
                <EmptyMessage message="No quiet zones returned." />
              )}
            </Section>

            <Section
              title="Alternative zones"
              subtitle="Requires a destination"
              collapsed={collapsed.alternatives}
              loading={false}
              onToggle={() => toggle('alternatives')}
            >
              {chartWidth > 0 ? (
                <AlternativesLineChart
                  data={alternatives}
                  width={chartWidth - 32}
                  colorBlindMode={colorBlindMode}
                />
              ) : null}
              <EmptyMessage message="Destination-specific alternatives are shown when a destination is supplied by a planning flow." />
            </Section>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshing={loading}
        onRefresh={() => {
          haptics.selection();
          refresh();
        }}
      />
    </View>
  );
}

function SummaryCards({
  worstLevel,
  zoneCount,
  warningCount,
  loading,
  colorBlindMode,
}: {
  worstLevel: WarningLevel;
  zoneCount: number;
  warningCount: number;
  loading: boolean;
  colorBlindMode: boolean;
}) {
  return (
    <View className="flex-row gap-2">
      <SummaryCard
        label="Current risk"
        value={worstLevel}
        tone={warningLevelColor(worstLevel, colorBlindMode)}
      />
      <SummaryCard label="Zones" value={loading && !zoneCount ? '...' : String(zoneCount)} />
      <SummaryCard label="Warnings" value={loading && !warningCount ? '...' : String(warningCount)} />
    </View>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-1 rounded-lg bg-surface-tertiary p-3 dark:bg-surface-dark-secondary">
      <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <Text
        className="font-sans text-base font-bold capitalize"
        style={{ color: tone ?? colors.surfaceDark }}
      >
        {value}
      </Text>
    </View>
  );
}

function Section({
  title,
  subtitle,
  collapsed,
  loading,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  collapsed: boolean;
  loading: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="rounded-lg bg-surface-tertiary p-4 dark:bg-surface-dark-secondary">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        onPress={onToggle}
        className="min-h-[44px] flex-row items-center justify-between gap-3"
      >
        <View className="flex-1">
          <Text className="font-sans text-xs font-medium uppercase text-brand dark:text-accent">
            {title}
          </Text>
          <Text className="font-sans text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        <Text className="font-sans text-lg text-gray-500">{collapsed ? '+' : '-'}</Text>
      </Pressable>
      {collapsed ? null : <View className="gap-3 pt-3">{children}</View>}
    </View>
  );
}

function WarningRow({
  warning,
  colorBlindMode,
}: {
  warning: ForecastWarning;
  colorBlindMode: boolean;
}) {
  return (
    <View className="min-h-[44px] flex-row items-center gap-3">
      <LevelDot level={warning.warning_level} colorBlindMode={colorBlindMode} />
      <View className="flex-1">
        <Text className="font-sans text-sm font-semibold text-gray-900 dark:text-gray-300">
          {warning.zone}
        </Text>
        <Text className="font-sans text-xs text-gray-500">
          {warning.warning_level} - +{warning.hours_from_now}h
        </Text>
      </View>
    </View>
  );
}

function ZoneRow({ zone, colorBlindMode }: { zone: PressureZone; colorBlindMode: boolean }) {
  return (
    <View className="min-h-[44px] flex-row items-center gap-3">
      <LevelDot level={zone.pressure_level} colorBlindMode={colorBlindMode} />
      <View className="flex-1">
        <Text className="font-sans text-sm font-semibold text-gray-900 dark:text-gray-300">
          {zone.zone}
        </Text>
        <Text className="font-sans text-xs capitalize text-gray-500">{zone.pressure_level}</Text>
      </View>
    </View>
  );
}

function ZoneChip({ zone, colorBlindMode }: { zone: PressureZone; colorBlindMode: boolean }) {
  const color = warningLevelColor(zone.pressure_level, colorBlindMode);
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        className="font-sans text-xs font-semibold"
        style={{ color }}
      >
        {zone.zone}: {zone.pressure_level}
      </Text>
    </View>
  );
}

function LevelDot({ level, colorBlindMode }: { level: WarningLevel; colorBlindMode: boolean }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: warningLevelColor(level, colorBlindMode),
      }}
    />
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">{message}</Text>;
}

function ErrorBanner({
  message,
  prefix,
  colorBlindMode,
}: {
  message: string | null;
  prefix: string;
  colorBlindMode: boolean;
}) {
  if (!message) return null;
  return (
    <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.statusAvoidBg }}>
      <Text style={{ color: statusColor('avoid', colorBlindMode) }}>
        {prefix}: {message}
      </Text>
    </View>
  );
}

function warningRowKey(section: string, warning: ForecastWarning, index: number) {
  return `${section}:${warning.zone}:${warning.warning_level}:${warning.hours_from_now}:${index}`;
}

function pressureZoneKey(section: string, zone: PressureZone, index: number) {
  return `${section}:${zone.zone}:${zone.pressure_level}:${index}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
