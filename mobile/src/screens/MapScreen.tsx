import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../components/common/Toast';
import { BusyNowLayer } from '../components/maps/BusyNowLayer';
import { ParkingMap, type ParkingMapRef } from '../components/maps/ParkingMap';
import { MapLegend } from '../components/map/MapLegend';
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
import { colors, nativeTabBarHeight, SNAP_HALF, zIndex } from '../design-system';
import { useMapChromeAnchor } from '../hooks/useMapChromeAnchor';
import { useBays } from '../hooks/useBays';
import { useBusyNow } from '../hooks/useBusyNow';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDestination } from '../hooks/useDestination';
import { useFilters } from '../hooks/useFilters';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useOnboarding } from '../hooks/useOnboarding';
import { useDestinationAlternatives } from '../hooks/useDestinationAlternatives';
import { useDarkMode } from '../hooks/useDarkMode';
import { useQuietestSegments } from '../hooks/useQuietestSegments';
import type { TabParamList } from '../navigation/types';
import type { PressureBounds } from '../services/apiPressure';
import type { Bay } from '../services/apiBays';
import { boundsToKey, isSignificantBoundsChange } from '../utils/mapBounds';
import { buildQuietStreetSelection, mapSegmentsToQuietStreets } from '../utils/quietStreets';
import { frameMapToAlternative } from '../utils/alternativeNavigation';
import {
  buildAlternativePinSubtitle,
  displayAlternativeLabel,
} from '../utils/destinationPressure';
import type { PressureAlternativeZone } from '../types/pressureAlternatives';
import { DEFAULT_CBD_BOUNDS, SEARCH_RADIUS_M } from '../utils/mapGeo';

type Nav = BottomTabNavigationProp<TabParamList, 'MapTab'>;

const TAB_BAR_VISIBLE = {
  position: 'absolute' as const,
  height: nativeTabBarHeight,
  backgroundColor: colors.surface,
  borderTopColor: colors.surfaceTertiary,
  borderTopWidth: 0.5,
  zIndex: zIndex.tabBar,
};
const TAB_BAR_HIDDEN = { display: 'none' as const };

export function MapScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<TabParamList, 'MapTab'>>();
  const insets = useSafeAreaInsets();
  const { bays, loading } = useBays();
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [baySheetIndex, setBaySheetIndex] = useState(-1);
  const [pcSheetIndex, setPcSheetIndex] = useState(0);
  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [mapBounds, setMapBounds] = useState<PressureBounds | null>(DEFAULT_CBD_BOUNDS);

  const { manifest, status: busyNowStatus } = useBusyNow(true);
  const parkingChanceActive =
    busyNowStatus === 'ready' &&
    manifest != null &&
    (manifest.total_segments ?? 0) > 0;
  const parkingSheetVisible = busyNowStatus !== 'idle';
  const { animatedPosition, anchorStyle, onMapLayout } = useMapChromeAnchor(parkingSheetVisible);
  const { needsOnboarding, complete: completeOnboarding } = useOnboarding();
  const { show: showToast } = useToast();
  const { state: locationState, canAskAgain, request: requestLocation } = useLocationPermission();
  const { destination, setDestination, clearDestination, altPin, setAltPin } = useDestination();
  const { dark: mapDark } = useDarkMode();
  const filters = useFilters();

  const debouncedBounds = useDebouncedValue(mapBounds, 300);
  const lastReportedBoundsRef = useRef<PressureBounds | null>(null);
  const mapRef = useRef<ParkingMapRef>(null);

  // Match web: fetch when manifest ready (not only when overlay has segments).
  const quietSegmentsEnabled = busyNowStatus === 'ready' && !destination;
  const {
    segments: quietSegmentsAll,
    loading: quietSegmentsLoading,
    error: quietSegmentsError,
  } = useQuietestSegments({
    bounds: debouncedBounds,
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

  const parkingChanceSheetTitle = useMemo(() => {
    if (destination) return `Near ${destination.name}`;
    return 'Parking chance nearby';
  }, [destination]);

  const parkingChanceSheetSubtitle = useMemo(() => {
    if (destination) return `${SEARCH_RADIUS_M} m radius · live now`;
    return 'Quiet streets around current map view';
  }, [destination]);

  const selectedSegmentId =
    altPin?.source === 'quiet-street' || altPin?.segmentId != null ? altPin?.segmentId ?? null : null;
  const selectedZoneId =
    altPin?.source === 'alternative' && altPin?.zoneId != null ? altPin.zoneId : null;

  useEffect(() => {
    if (locationState === 'never-asked' && canAskAgain) requestLocation();
  }, [locationState, canAskAgain, requestLocation]);

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

  const onSegmentPress = useCallback((segmentId: string) => {
    segmentDetailRef.current?.present(segmentId);
  }, []);

  const handleMapBounds = useCallback((b: PressureBounds) => {
    if (!isSignificantBoundsChange(lastReportedBoundsRef.current, b)) return;
    lastReportedBoundsRef.current = b;
    setMapBounds((prev) => (boundsToKey(prev) === boundsToKey(b) ? prev : b));
  }, []);

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

  useEffect(() => {
    const bayId = route.params?.bayId;
    if (bayId) {
      const found = bays.find((b) => b.id === bayId);
      if (found) {
        setSelectedBayId(found.id);
        bayDetailRef.current?.present(found);
      }
    }
    const segmentId = route.params?.segmentId;
    if (segmentId) segmentDetailRef.current?.present(segmentId);
  }, [route.params?.bayId, route.params?.segmentId, bays]);

  useEffect(() => {
    const hide = baySheetIndex === SNAP_FULL_INDEX || pcSheetIndex === 2;
    navigation.getParent()?.setOptions({ tabBarStyle: hide ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE });
  }, [baySheetIndex, pcSheetIndex, navigation]);

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

  const accessibilityBayIds = useMemo<string[] | undefined>(
    () => (accessibleOnly ? bays.filter((b) => b.bayType === 'Disabled').map((b) => b.id) : undefined),
    [accessibleOnly, bays],
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
      ) : (
        <ParkingMap
          ref={mapRef}
          bays={bays}
          selectedBayId={selectedBayId}
          onSelectBay={onSelectBay}
          destination={destination}
          altPin={altPin}
          dimRadiusM={destination ? SEARCH_RADIUS_M : undefined}
          colorBlindMode={colorBlindMode}
          mapDark={mapDark}
          accessibilityBayIds={accessibilityBayIds}
          onMapEmptyClick={() => setAltPin(null)}
          onBoundsChange={handleMapBounds}
        >
          {parkingChanceActive && manifest ? (
            <BusyNowLayer
              manifest={manifest}
              mapStyleKey={mapDark ? 'dark' : 'light'}
              colorBlindMode={colorBlindMode}
              destination={destination}
              dimRadiusM={destination ? SEARCH_RADIUS_M : undefined}
              onSegmentPress={onSegmentPress}
            />
          ) : null}
        </ParkingMap>
      )}

      <SearchBar
        destination={destination}
        onPick={(l) => setDestination(l)}
        onClear={() => clearDestination()}
        onSettingsOpen={() => settingsSheetRef.current?.present()}
        onboardingActive={onboardingActive}
        variant="map"
      />

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
        <ScopeStrip onOpenFilters={() => filterSheetRef.current?.present()} />
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
      <HelpModal ref={helpRef} />

      <BayDetailSheet
        ref={bayDetailRef}
        destination={destination}
        durationFilter={filters.durationFilter}
        customDuration={filters.customDurationMins}
        plannerArrivalIso={filters.plannerArrivalIso}
        plannerDurationMins={filters.plannerDurationMins}
        onSheetIndexChange={setBaySheetIndex}
        onTrapDetected={(msg) => showToast(msg, 'warning')}
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
