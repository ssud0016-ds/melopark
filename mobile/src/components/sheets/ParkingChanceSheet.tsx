import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataSourcesSection } from './DataSourcesSection';
import { DestinationPressureBlock } from './DestinationPressureBlock';
import {
  colors,
  sheetSnapPoints,
  SNAP_FULL,
  SNAP_HALF,
  SNAP_PEEK,
} from '../../design-system';
import type { Landmark } from '../../data/landmarks';
import type { AltPin } from '../../hooks/useDestination';
import type { BusyNowStatus } from '../../hooks/useBusyNow';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useTabBarLayout } from '../../navigation/tabBarStyle';
import type { PressureManifest } from '../../services/apiPressure';
import type { AlternativesResponse, PressureAlternativeZone } from '../../types/pressureAlternatives';
import { CHANCE_TEXT } from '../../utils/quietStreets';

export type ParkingChanceSheetRef = {
  snapTo: (index: number) => void;
  expand: () => void;
  collapse: () => void;
  getIndex: () => number;
};

export type QuietStreet = {
  id: string;
  name: string;
  /** Raw API street_name for alt pin label (web: seg.street_name). */
  fullStreetName?: string;
  crossStreet?: string | null;
  freeBays: number;
  totalBays: number;
  hasLiveBays: boolean;
  status: 'good' | 'caution' | 'avoid' | 'unknown';
  coverage: string;
  midLat?: number;
  midLng?: number;
  walkM?: number;
};

type Props = {
  destination: Landmark | null;
  altPin: AltPin | null;
  quietStreets: QuietStreet[];
  quietStreetsLoading?: boolean;
  quietStreetsError?: string | null;
  busyNowStatus: BusyNowStatus;
  sheetTitle: string;
  sheetSubtitle: string;
  selectedSegmentId?: string | null;
  onStreetClick?: (street: QuietStreet) => void;
  onClearSelectedSuggestion: () => void;
  onSheetIndexChange?: (i: number) => void;
  destinationAlternatives?: AlternativesResponse | null;
  destinationAlternativesLoading?: boolean;
  destinationAlternativesError?: string | null;
  onRetryDestinationAlternatives?: () => void;
  selectedZoneId?: string | number | null;
  onAlternativePress?: (alt: PressureAlternativeZone) => void;
  colorBlindMode?: boolean;
  /** Tile manifest — drives bottom data sources dropdown (web BusyNowPanel). */
  manifest?: PressureManifest | null;
  /** Drives ScopeStrip / MapLegend anchor while dragging. */
  animatedPosition?: SharedValue<number>;
};

const STATUS_TO_LEVEL: Record<QuietStreet['status'], keyof typeof CHANCE_TEXT> = {
  good: 'low',
  caution: 'medium',
  avoid: 'high',
  unknown: 'unknown',
};

function streetSubtitle(s: QuietStreet): string {
  const level = STATUS_TO_LEVEL[s.status];
  const chance = CHANCE_TEXT[level] ?? 'No live estimate';
  const parts: string[] = [chance];
  if (s.hasLiveBays) {
    parts.push(`${s.freeBays}/${s.totalBays} bays free`);
  }
  if (s.walkM != null) {
    parts.push(`${Math.round(s.walkM)} m away`);
  }
  parts.push(s.coverage);
  return parts.filter(Boolean).join(' · ');
}

export const ParkingChanceSheet = forwardRef<ParkingChanceSheetRef, Props>((props, ref) => {
  const {
    destination,
    altPin,
    quietStreets,
    quietStreetsLoading = false,
    quietStreetsError = null,
    busyNowStatus,
    sheetTitle,
    sheetSubtitle,
    selectedSegmentId,
    onStreetClick,
    onClearSelectedSuggestion,
    onSheetIndexChange,
    destinationAlternatives = null,
    destinationAlternativesLoading = false,
    destinationAlternativesError = null,
    onRetryDestinationAlternatives,
    selectedZoneId = null,
    onAlternativePress,
    colorBlindMode = false,
    manifest = null,
    animatedPosition,
  } = props;

  const insets = useSafeAreaInsets();
  const tabBar = useTabBarLayout();
  const theme = useThemeColors();
  const sheetRef = useRef<BottomSheet>(null);
  const indexRef = useRef(SNAP_PEEK);
  const inDestMode = !!destination;
  const isReady = busyNowStatus === 'ready';
  const snaps = useMemo(() => [...sheetSnapPoints], []);
  const [snapIndex, setSnapIndex] = useState(SNAP_PEEK);

  // Sheet bottom flush with tab bar top (shared layout with MeloparkTabBar). Full snap covers tab bar.
  const sheetBottomInset = snapIndex === SNAP_FULL ? 0 : tabBar.sheetBottomInset;
  const scrollBottomPadding =
    snapIndex === SNAP_PEEK
      ? 12
      : snapIndex === SNAP_FULL
        ? 24 + tabBar.safeBottom
        : 24 + tabBar.totalHeight;

  useEffect(() => {
    if (destination) {
      setSnapIndex(SNAP_HALF);
      return;
    }
    // Web default: SNAP_PEEK — do not auto-expand to half when manifest loads.
    if (isReady) {
      setSnapIndex(SNAP_PEEK);
    }
  }, [destination, isReady]);

  useImperativeHandle(ref, () => ({
    snapTo: (i) => sheetRef.current?.snapToIndex(i),
    expand: () => sheetRef.current?.expand(),
    collapse: () => sheetRef.current?.collapse(),
    getIndex: () => indexRef.current,
  }));

  if (busyNowStatus === 'idle') {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snaps}
      index={snapIndex}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      bottomInset={sheetBottomInset}
      animatedPosition={animatedPosition}
      backgroundStyle={{
        backgroundColor: theme.sheet,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      handleIndicatorStyle={{ backgroundColor: theme.handle, width: 32, height: 4 }}
      onChange={(i) => {
        indexRef.current = i;
        setSnapIndex(i);
        onSheetIndexChange?.(i);
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
          {sheetTitle}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>{sheetSubtitle}</Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: theme.chromeMuted,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              marginRight: 6,
              backgroundColor: busyNowStatus === 'error' ? colors.statusAvoid : '#10b981',
            }}
          />
          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.text }}>
            {busyNowStatus === 'loading' ? 'loading...' : busyNowStatus === 'error' ? 'error' : 'Live'}
          </Text>
        </View>

        {altPin ? (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.statusGoodBg,
              borderWidth: 1,
              borderColor: theme.liveChipText,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.liveChipText, letterSpacing: 1 }}>
                Your pick
              </Text>
              <Pressable accessibilityRole="button" onPress={onClearSelectedSuggestion} hitSlop={8}>
                <Text style={{ fontSize: 12, color: theme.tabActive, fontWeight: '600' }}>Clear</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 4 }}>
              {altPin.label}
            </Text>
            {altPin.subtitle ? (
              <Text style={{ fontSize: 12, color: theme.liveChipText, fontWeight: '500', marginTop: 2 }}>
                {altPin.subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isReady && busyNowStatus === 'loading' ? (
          <Text style={{ fontSize: 13, color: theme.text, marginBottom: 12 }}>
            Loading parking chance data...
          </Text>
        ) : null}

        {busyNowStatus === 'error' ? (
          <Text style={{ fontSize: 13, color: colors.statusAvoid, marginBottom: 12 }}>
            Could not load pressure data.
          </Text>
        ) : null}

        {inDestMode ? (
          <DestinationPressureBlock
            isReady={isReady}
            data={destinationAlternatives}
            loading={destinationAlternativesLoading}
            error={destinationAlternativesError}
            colorBlindMode={colorBlindMode}
            onRetry={onRetryDestinationAlternatives ?? (() => {})}
            selectedZoneId={selectedZoneId}
            onAlternativePress={onAlternativePress}
          />
        ) : (
          <QuietStreetsBody
            isReady={isReady}
            loading={quietStreetsLoading}
            error={quietStreetsError}
            streets={quietStreets}
            selectedSegmentId={selectedSegmentId}
            onStreetClick={onStreetClick}
          />
        )}

        {manifest ? <DataSourcesSection manifest={manifest} /> : null}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});
ParkingChanceSheet.displayName = 'ParkingChanceSheet';

function QuietStreetsBody({
  isReady,
  loading,
  error,
  streets,
  selectedSegmentId,
  onStreetClick,
}: {
  isReady: boolean;
  loading: boolean;
  error: string | null;
  streets: QuietStreet[];
  selectedSegmentId?: string | null;
  onStreetClick?: (street: QuietStreet) => void;
}) {
  const theme = useThemeColors();

  if (!isReady) {
    return null;
  }

  if (loading) {
    return (
      <Text style={{ fontSize: 13, color: theme.text }}>Loading quiet streets nearby...</Text>
    );
  }

  if (error) {
    return <Text style={{ fontSize: 13, color: colors.statusAvoid }}>{error}</Text>;
  }

  if (streets.length === 0) {
    return (
      <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
        Pick a destination to compare nearby parking streets. Green = good chance, amber = getting busy, red =
        hard to park.
      </Text>
    );
  }

  return (
    <View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: theme.textMuted,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Better parking options
      </Text>
      {streets.map((s, i) => (
        <View key={`street-${s.id}-${i}`} style={{ marginBottom: i < streets.length - 1 ? 8 : 0 }}>
          <QuietStreetChip
            street={s}
            selected={selectedSegmentId != null && String(selectedSegmentId) === String(s.id)}
            featured={i === 0}
            onPress={() => {
              if (s.midLat == null || s.midLng == null) return;
              onStreetClick?.(s);
            }}
          />
        </View>
      ))}
    </View>
  );
}

function QuietStreetChip({
  street,
  selected,
  featured,
  onPress,
}: {
  street: QuietStreet;
  selected: boolean;
  featured: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const subtitle = streetSubtitle(street);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${street.name} — ${CHANCE_TEXT[STATUS_TO_LEVEL[street.status]]}, ${street.coverage}`}
      onPress={() => {
        if (street.midLat == null || street.midLng == null) return;
        onPress();
      }}
      style={{
        minHeight: 48,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: selected ? theme.liveChipText : theme.border,
        backgroundColor: selected ? theme.statusGoodBg : theme.chrome,
      }}
    >
      <Text style={{ fontSize: featured ? 15 : 13, fontWeight: '600', color: theme.text }}>
        {street.name}
      </Text>
      {street.crossStreet ? (
        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{street.crossStreet}</Text>
      ) : null}
      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>{subtitle}</Text>
    </Pressable>
  );
}
