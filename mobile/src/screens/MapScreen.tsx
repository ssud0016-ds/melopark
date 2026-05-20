import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../components/common/Toast';
import { BusyNowLayer } from '../components/maps/BusyNowLayer';
import { ParkingMap, type ParkingMapRef } from '../components/maps/ParkingMap';
import { MapLegend } from '../components/map/MapLegend';
import { isMapZoomHintVisible, MapZoomHintPill } from '../components/map/MapZoomHint';
import { OnboardingOverlay } from '../components/onboarding/OnboardingOverlay';
import { SearchBar } from '../components/chrome/SearchBar';
import { ScopeStrip } from '../components/chrome/ScopeStrip';
import { ParkingChanceSheet, type ParkingChanceSheetRef } from '../components/sheets/ParkingChanceSheet';
import { FilterSheet, type FilterSheetRef } from '../components/sheets/FilterSheet';
import { SettingsSheet, type SettingsSheetRef } from '../components/sheets/SettingsSheet';
import { HelpModal, type HelpModalRef } from '../components/help/HelpModal';
import {
  BayDetailSheet,
  SNAP_FULL_INDEX,
  type BayDetailSheetRef,
} from '../components/sheets/BayDetailSheet';
import {
  SegmentDetailSheet,
  type SegmentDetailSheetRef,
} from '../components/sheets/SegmentDetailSheet';
import { colors, SNAP_HALF, zIndex } from '../design-system';
import { getTabBarStyle } from '../navigation/tabBarStyle';
import { useAccessibility } from '../hooks/useAccessibility';
import { useMapChromeAnchor, MAP_ZOOM_HINT_GAP } from '../hooks/useMapChromeAnchor';
import { useAccessibilityBays } from '../hooks/useAccessibilityBays';
import { useBays } from '../hooks/useBays';
import { useBusyNow } from '../hooks/useBusyNow';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDestination } from '../hooks/useDestination';
import { useMapFlyTarget } from '../hooks/useMapFlyTarget';
import { useFilters } from '../hooks/useFilters';
import { useOnboarding } from '../hooks/useOnboarding';
import { useDestinationAlternatives } from '../hooks/useDestinationAlternatives';
import { useDarkMode } from '../hooks/useDarkMode';
import { useThemeColors } from '../hooks/useThemeColors';
import { useQuietestSegments } from '../hooks/useQuietestSegments';
import type { TabParamList } from '../navigation/types';
import type { PressureBounds } from '../services/apiPressure';
import { fetchEvaluateBulk, type Bay } from '../services/apiBays';
import { useDebouncedPlannerParams } from '../hooks/useDebouncedPlannerParams';
import { boundsToKey, cullBaysToBounds, isSignificantBoundsChange } from '../utils/mapBounds';
import { verdictMapFingerprint } from '../utils/verdictMapFingerprint';
import { buildQuietStreetSelection, mapSegmentsToQuietStreets } from '../utils/quietStreets';
import { frameMapToAlternative } from '../utils/alternativeNavigation';
import {
  buildAlternativePinSubtitle,
  displayAlternativeLabel,
} from '../utils/destinationPressure';
import type { PressureAlternativeZone } from '../types/pressureAlternatives';
import { DESTINATION_MAP_ZOOM, DEFAULT_MAP_ZOOM, QUIET_STREET_FLY_MS, SEARCH_RADIUS_M } from '../utils/mapGeo';
import {
  formatProximityDetailLabel,
  proximityFreeCounts,
} from '../utils/proximityBays';

type Nav = BottomTabNavigationProp<TabParamList, 'MapTab'>;

const TAB_BAR_HIDDEN = { display: 'none' as const };

export function MapScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<TabParamList, 'MapTab'>>();
  const isMapTabFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { bays, loading } = useBays();
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [baySheetIndex, setBaySheetIndex] = useState(-1);
  const [pcSheetIndex, setPcSheetIndex] = useState(0);
  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const {
    accessibleBayIds,
    accessibleRulesByBayId,
    loading: accessibilityLoading,
    error: accessibilityError,
  } = useAccessibilityBays(accessibleOnly);
  const accessibleShownCount = useMemo(() => {
    if (!accessibleOnly || !accessibleBayIds?.length) return 0;
    const allow = new Set(accessibleBayIds);
    return bays.filter((b) => allow.has(b.id)).length;
  }, [accessibleOnly, accessibleBayIds, bays]);
  const [onboardingActive, setOnboardingActive] = useState(false);
  /** Web MapPage: null until map reports bounds (quiet segments / planner wait for first viewport). */
  const [mapBounds, setMapBounds] = useState<PressureBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);

  const { manifest, status: busyNowStatus } = useBusyNow(true);
  const parkingChanceActive =
    busyNowStatus === 'ready' &&
    manifest != null &&
    (manifest.total_segments ?? 0) > 0;
  const parkingSheetVisible = busyNowStatus !== 'idle';
  const { animatedPosition, anchorStyle, onMapLayout } =
    useMapChromeAnchor(parkingSheetVisible);
  const { announce } = useAccessibility();
  const { needsOnboarding, complete: completeOnboarding, reset: resetOnboarding } = useOnboarding();
  const { show: showToast } = useToast();
  const { destination, setDestination, clearDestination, altPin, setAltPin } = useDestination();
  const { consumeFlyTarget } = useMapFlyTarget();
  const { dark: mapDark } = useDarkMode();
  const theme = useThemeColors();
  const filters = useFilters();

  const tabBarVisible = useMemo(
    () => getTabBarStyle(theme, insets.bottom),
    [theme, insets.bottom],
  );

  const debouncedBounds = useDebouncedValue(mapBounds, 300);

  const viewportBays = useMemo(
    () => cullBaysToBounds(bays, debouncedBounds),
    [bays, debouncedBounds],
  );
  const lastReportedBoundsRef = useRef<PressureBounds | null>(null);
  const mapRef = useRef<ParkingMapRef>(null);

  const plannerParams = useMemo(() => {
    if (!filters.plannerArrivalIso || filters.plannerDurationMins == null) return null;
    return { arrivalIso: filters.plannerArrivalIso, durationMins: filters.plannerDurationMins };
  }, [filters.plannerArrivalIso, filters.plannerDurationMins]);

  const debouncedPlanner = useDebouncedPlannerParams(plannerParams, 300);
  const [bulkVerdictById, setBulkVerdictById] = useState<Record<string, string>>({});
  const bulkVerdictFpRef = useRef<string>('');

  useEffect(() => {
    if (!debouncedPlanner || !debouncedBounds) {
      bulkVerdictFpRef.current = '';
      setBulkVerdictById((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;
    const bbox = `${debouncedBounds.south},${debouncedBounds.west},${debouncedBounds.north},${debouncedBounds.east}`;
    fetchEvaluateBulk(bbox, debouncedPlanner).then((rows) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of rows) {
        if (r?.bay_id != null) next[String(r.bay_id)] = r.verdict;
      }
      const fp = verdictMapFingerprint(next);
      if (fp === bulkVerdictFpRef.current) return;
      bulkVerdictFpRef.current = fp;
      setBulkVerdictById(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedPlanner, debouncedBounds]);

  // Navigate from Predictions: fly to selected zone (web MapPage flyTarget).
  useFocusEffect(
    useCallback(() => {
      const target = consumeFlyTarget();
      if (!target) return;
      const t = setTimeout(() => {
        mapRef.current?.flyTo(target.lat, target.lng, {
          zoom: DESTINATION_MAP_ZOOM,
          durationMs: QUIET_STREET_FLY_MS,
        });
      }, 300);
      return () => clearTimeout(t);
    }, [consumeFlyTarget]),
  );

  // Match web: fetch when manifest ready (not only when overlay has segments).
  const quietSegmentsEnabled = busyNowStatus === 'ready' && !destination;
  const {
    segments: quietSegmentsAll,
    loading: quietSegmentsLoading,
    error: quietSegmentsError,
  } = useQuietestSegments({
    bounds: mapBounds,
    enabled: quietSegmentsEnabled,
  });

  const {
    data: destinationAlternatives,
    loading: destinationAlternativesLoading,
    error: destinationAlternativesError,
    retry: retryDestinationAlternatives,
  } = useDestinationAlternatives({
    destination,
    enabled: busyNowStatus === 'ready',
  });

  useEffect(() => {
    if (quietSegmentsEnabled) {
      mapRef.current?.refreshBounds();
    }
  }, [quietSegmentsEnabled]);

  const quietStreets = useMemo(
    () => mapSegmentsToQuietStreets(quietSegmentsAll),
    [quietSegmentsAll],
  );

  const proximityCounts = useMemo(
    () => proximityFreeCounts(bays, destination),
    [bays, destination],
  );

  const parkingChanceSheetTitle = useMemo(() => {
    if (destination) return `Near ${destination.name}`;
    return 'Parking chance nearby';
  }, [destination]);

  const parkingChanceSheetSubtitle = useMemo(() => {
    if (!destination) return 'Quiet streets around current map view';
    const detail = formatProximityDetailLabel(proximityCounts);
    if (!detail) return `${SEARCH_RADIUS_M} m radius · live now`;
    return `${detail} · live now`;
  }, [destination, proximityCounts]);

  const mapZoomHintVisible = isMapZoomHintVisible({
    mapZoom,
    onboardingActive,
    baySheetFull: baySheetIndex === SNAP_FULL_INDEX,
  });

  const proximityAnnouncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!destination) {
      proximityAnnouncedRef.current = null;
      return;
    }
    const key = `${destination.lat},${destination.lng},${proximityCounts.proxFreeBays}`;
    if (proximityAnnouncedRef.current === key) return;
    proximityAnnouncedRef.current = key;
    const detail = formatProximityDetailLabel(proximityCounts);
    if (detail) announce(`${detail} near ${destination.name}`);
  }, [destination, proximityCounts, announce]);

  const selectedSegmentId =
    altPin?.source === 'quiet-street' || altPin?.segmentId != null ? altPin?.segmentId ?? null : null;
  const selectedZoneId =
    altPin?.source === 'alternative' && altPin?.zoneId != null ? altPin.zoneId : null;

  const bayDetailRef = useRef<BayDetailSheetRef>(null);
  const segmentDetailRef = useRef<SegmentDetailSheetRef>(null);
  const pcSheetRef = useRef<ParkingChanceSheetRef>(null);
  const filterSheetRef = useRef<FilterSheetRef>(null);
  const settingsSheetRef = useRef<SettingsSheetRef>(null);
  const helpRef = useRef<HelpModalRef>(null);

  const onSelectBay = useCallback((bay: Bay) => {
    setSelectedBayId(bay.id);
    bayDetailRef.current?.present(bay);
  }, []);

  const onBayTrapDetected = useCallback(
    (msg: string) => {
      showToast(msg, 'warning');
    },
    [showToast],
  );

  const onSegmentPress = useCallback((segmentId: string) => {
    segmentDetailRef.current?.present(segmentId);
  }, []);

  const handleMapBounds = useCallback((b: PressureBounds) => {
    if (!isSignificantBoundsChange(lastReportedBoundsRef.current, b)) return;
    lastReportedBoundsRef.current = b;
    setMapBounds((prev) => (boundsToKey(prev) === boundsToKey(b) ? prev : b));
  }, []);

  const handleMapEmptyClick = useCallback(() => setAltPin(null), [setAltPin]);

  const handleQuietStreetClick = useCallback(
    (street: ReturnType<typeof mapSegmentsToQuietStreets>[number]) => {
      const selection = buildQuietStreetSelection(street);
      if (!selection) return;
      mapRef.current?.flyTo(selection.lat, selection.lng, selection.flyOpts);
      setAltPin({
        segmentId: selection.altPin.segmentId,
        bayId: null,
        source: 'quiet-street',
        lat: selection.altPin.lat,
        lng: selection.altPin.lng,
        label: selection.altPin.label,
        subtitle: selection.altPin.subtitle,
      });
      pcSheetRef.current?.snapTo(SNAP_HALF);
    },
    [setAltPin],
  );

  const handleAlternativeClick = useCallback(
    (alt: PressureAlternativeZone) => {
      const lat = alt.centroid_lat;
      const lng = alt.centroid_lon;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      frameMapToAlternative(
        mapRef.current,
        destination ? { lat: destination.lat, lng: destination.lng } : null,
        { lat, lng },
      );
      const label = displayAlternativeLabel(alt.label, alt.zone_id);
      setAltPin({
        zoneId: alt.zone_id,
        source: 'alternative',
        segmentId: null,
        bayId: null,
        lat,
        lng,
        label,
        subtitle: buildAlternativePinSubtitle(alt),
      });
      pcSheetRef.current?.snapTo(SNAP_HALF);
    },
    [destination, setAltPin],
  );

  const deepLinkBayPresentedRef = useRef<string | null>(null);
  useEffect(() => {
    const bayId = route.params?.bayId;
    if (!bayId) {
      deepLinkBayPresentedRef.current = null;
    } else {
      const found = bays.find((b) => b.id === bayId);
      if (found && deepLinkBayPresentedRef.current !== bayId) {
        deepLinkBayPresentedRef.current = bayId;
        setSelectedBayId(found.id);
        bayDetailRef.current?.present(found);
      }
    }
    const segmentId = route.params?.segmentId;
    if (segmentId) segmentDetailRef.current?.present(segmentId);
  }, [route.params?.bayId, route.params?.segmentId, bays]);

  useEffect(() => {
    const hide =
      needsOnboarding === true || baySheetIndex === SNAP_FULL_INDEX || pcSheetIndex === 2;
    navigation.getParent()?.setOptions({ tabBarStyle: hide ? TAB_BAR_HIDDEN : tabBarVisible });
  }, [needsOnboarding, baySheetIndex, pcSheetIndex, navigation, tabBarVisible]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const idx = bayDetailRef.current?.getIndex() ?? -1;
      if (idx >= 2) {
        bayDetailRef.current?.snapTo(0);
        return true;
      }
      if (idx >= 0) {
        bayDetailRef.current?.dismiss();
        return true;
      }
      if (destination) {
        clearDestination();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [destination, clearDestination]);

  useEffect(() => {
    if (destination) pcSheetRef.current?.snapTo(1);
    else pcSheetRef.current?.snapTo(0);
  }, [destination]);

  useEffect(() => {
    if (destination) setAltPin(null);
  }, [destination, setAltPin]);

  useEffect(() => {
    if (altPin && !destination) pcSheetRef.current?.snapTo(SNAP_HALF);
  }, [altPin, destination]);

  const busyNowLayer = useMemo(
    () =>
      parkingChanceActive && manifest ? (
        <BusyNowLayer
          manifest={manifest}
          mapStyleKey={mapDark ? 'dark' : 'light'}
          colorBlindMode={colorBlindMode}
          destination={destination}
          dimRadiusM={destination ? SEARCH_RADIUS_M : undefined}
          onSegmentPress={onSegmentPress}
        />
      ) : null,
    [parkingChanceActive, manifest, mapDark, colorBlindMode, destination, onSegmentPress],
  );

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: 0 }}
      onLayout={onMapLayout}
    >
      {loading && bays.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : isMapTabFocused ? (
        <ParkingMap
          ref={mapRef}
          bays={viewportBays}
          selectedBayId={selectedBayId}
          onSelectBay={onSelectBay}
          destination={destination}
          altPin={altPin}
          dimRadiusM={destination ? SEARCH_RADIUS_M : undefined}
          colorBlindMode={colorBlindMode}
          mapDark={mapDark}
          accessibilityBayIds={accessibleBayIds}
          plannerMapActive={Boolean(filters.plannerArrivalIso)}
          verdictByBayId={bulkVerdictById}
          onMapEmptyClick={handleMapEmptyClick}
          onBoundsChange={handleMapBounds}
          onZoomChange={setMapZoom}
        >
          {busyNowLayer}
        </ParkingMap>
      ) : (
        <View className="flex-1 bg-surface dark:bg-surface-dark" />
      )}

      <SearchBar
        destination={destination}
        onPick={(l) => setDestination(l)}
        onClear={() => clearDestination()}
        onSettingsOpen={() => settingsSheetRef.current?.present()}
        onboardingActive={onboardingActive}
        variant="map"
      />

      {accessibleOnly && (accessibilityLoading || accessibilityError) ? (
        <View
          pointerEvents="none"
          className="absolute left-3.5 z-[510] rounded-xl border border-surface-tertiary bg-surface/95 px-3 py-2 dark:border-surface-dark-tertiary dark:bg-surface-dark/95"
          style={{ top: insets.top + 120 }}
        >
          {accessibilityLoading ? (
            <Text className="text-12 text-ink-secondary dark:text-ink-dark-secondary">
              Loading accessible bays...
            </Text>
          ) : (
            <Text className="text-12 text-trap">{accessibilityError}</Text>
          )}
        </View>
      ) : null}

      {accessibleOnly && !accessibilityLoading && !accessibilityError ? (
        <View
          pointerEvents="none"
          className="absolute bottom-3.5 left-3.5 z-[500] rounded-xl border border-brand bg-brand px-3 py-1.5 dark:border-brand-300/80 dark:bg-brand-50"
        >
          <Text className="text-12 font-semibold text-white dark:text-brand-900">
            {accessibleShownCount.toLocaleString()} accessible shown
          </Text>
        </View>
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: 14,
            right: 14,
            zIndex: zIndex.mapChrome,
          },
          anchorStyle,
        ]}
      >
        <View pointerEvents="box-none" style={{ position: 'relative', width: '100%' }}>
          {mapZoomHintVisible ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                bottom: '100%',
                marginBottom: MAP_ZOOM_HINT_GAP,
                maxWidth: '72%',
                zIndex: zIndex.mapHint,
              }}
            >
              <MapZoomHintPill />
            </View>
          ) : null}
          <ScopeStrip
            onOpenFilters={() => filterSheetRef.current?.present()}
            proxFreeBays={proximityCounts.proxFreeBays}
            proxFreeSpots={proximityCounts.proxFreeSpots}
          />
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: 14,
            right: 14 + insets.right,
            zIndex: zIndex.mapChrome,
            alignItems: 'flex-end',
          },
          anchorStyle,
        ]}
      >
        <MapLegend colorBlindMode={colorBlindMode} parkingChanceActive={parkingChanceActive} />
      </Animated.View>

      <ParkingChanceSheet
        ref={pcSheetRef}
        animatedPosition={animatedPosition}
        destination={destination}
        altPin={altPin}
        quietStreets={quietStreets}
        quietStreetsLoading={quietSegmentsLoading}
        quietStreetsError={quietSegmentsError}
        busyNowStatus={busyNowStatus}
        sheetTitle={parkingChanceSheetTitle}
        sheetSubtitle={parkingChanceSheetSubtitle}
        selectedSegmentId={selectedSegmentId}
        onStreetClick={handleQuietStreetClick}
        onClearSelectedSuggestion={() => setAltPin(null)}
        onSheetIndexChange={setPcSheetIndex}
        destinationAlternatives={destinationAlternatives}
        destinationAlternativesLoading={destinationAlternativesLoading}
        destinationAlternativesError={destinationAlternativesError}
        onRetryDestinationAlternatives={retryDestinationAlternatives}
        selectedZoneId={selectedZoneId}
        onAlternativePress={handleAlternativeClick}
        colorBlindMode={colorBlindMode}
      />

      <FilterSheet ref={filterSheetRef} />
      <SettingsSheet
        ref={settingsSheetRef}
        colorBlindMode={colorBlindMode}
        onToggleColorBlind={setColorBlindMode}
        accessibleOnly={accessibleOnly}
        onToggleAccessible={setAccessibleOnly}
        onOpenHelp={() => helpRef.current?.present()}
      />
      <HelpModal
        ref={helpRef}
        onReplayOnboarding={() => {
          helpRef.current?.dismiss();
          void resetOnboarding();
        }}
      />

      <BayDetailSheet
        ref={bayDetailRef}
        destination={destination}
        durationFilter={filters.durationFilter}
        customDuration={filters.customDurationMins}
        plannerArrivalIso={filters.plannerArrivalIso}
        plannerDurationMins={filters.plannerDurationMins}
        accessibleRulesByBayId={accessibleRulesByBayId}
        onSheetIndexChange={setBaySheetIndex}
        onTrapDetected={onBayTrapDetected}
      />
      <SegmentDetailSheet
        ref={segmentDetailRef}
        manifest={manifest}
        colorBlindMode={colorBlindMode}
      />

      {needsOnboarding === true ? (
        <OnboardingOverlay
          hasPressureData={!!manifest && (manifest.total_segments ?? 0) > 0}
          destination={destination}
          onActiveChange={setOnboardingActive}
          onDone={(picked) => {
            if (picked) setDestination(picked);
            setOnboardingActive(false);
            completeOnboarding();
          }}
        />
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top, left: 0, width: 0, height: 0 }} />
    </View>
  );
}
