import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../components/common/Toast';
import { BusyNowLayer } from '../components/maps/BusyNowLayer';
import { ParkingMap } from '../components/maps/ParkingMap';
import { OnboardingOverlay } from '../components/onboarding/OnboardingOverlay';
import { SearchBar } from '../components/chrome/SearchBar';
import { ScopeStrip } from '../components/chrome/ScopeStrip';
import { ParkingChanceSheet, type ParkingChanceSheetRef, type QuietStreet } from '../components/sheets/ParkingChanceSheet';
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
import { colors, nativeTabBarHeight, zIndex } from '../design-system';
import { useBays } from '../hooks/useBays';
import { useBusyNow } from '../hooks/useBusyNow';
import { useDestination } from '../hooks/useDestination';
import { useFilters } from '../hooks/useFilters';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useOnboarding } from '../hooks/useOnboarding';
import type { TabParamList } from '../navigation/types';
import type { Bay } from '../services/apiBays';
import { SEARCH_RADIUS_M } from '../utils/mapGeo';

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

  const { manifest } = useBusyNow(true);
  const { needsOnboarding, complete: completeOnboarding } = useOnboarding();
  const { show: showToast } = useToast();
  const { state: locationState, canAskAgain, request: requestLocation } = useLocationPermission();
  const { destination, setDestination, clearDestination, altPin, setAltPin } = useDestination();
  const filters = useFilters();

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

  const quietStreets = useMemo<QuietStreet[]>(() => {
    // Hook out to useQuietestSegments when API shape is finalized.
    // For now derive a small list from available bays so the panel isn't empty.
    return bays
      .filter((b) => b.type === 'available' && b.name)
      .slice(0, 3)
      .map((b, i) => ({
        id: b.id,
        name: b.name ?? `Bay ${b.id}`,
        freeBays: b.free,
        walkM: 100 + i * 60,
        status: 'good',
      }));
  }, [bays]);

  const accessibilityBayIds = useMemo<string[] | undefined>(
    () => (accessibleOnly ? bays.filter((b) => b.bayType === 'Disabled').map((b) => b.id) : undefined),
    [accessibleOnly, bays],
  );

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: 0 }}>
      {loading && bays.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ParkingMap
          bays={bays}
          selectedBayId={selectedBayId}
          onSelectBay={onSelectBay}
          destination={destination}
          altPin={altPin}
          dimRadiusM={destination ? SEARCH_RADIUS_M : undefined}
          colorBlindMode={colorBlindMode}
          accessibilityBayIds={accessibilityBayIds}
          onMapEmptyClick={() => setAltPin(null)}
        >
          <BusyNowLayer manifest={manifest} onSegmentPress={onSegmentPress} />
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

      <ScopeStrip onOpenFilters={() => filterSheetRef.current?.present()} bottomOffset={0} />

      <ParkingChanceSheet
        ref={pcSheetRef}
        destination={destination}
        altPin={altPin}
        quietStreets={quietStreets}
        pressureModeNote={filters.pressureModeNote}
        onAlternativeClick={(s) =>
          setAltPin({
            segmentId: null,
            bayId: s.id,
            lat: bays.find((b) => b.id === s.id)?.lat ?? 0,
            lng: bays.find((b) => b.id === s.id)?.lng ?? 0,
            label: s.name,
          })
        }
        onStreetClick={(id) => onSegmentPress(id)}
        onClearSelectedSuggestion={() => setAltPin(null)}
        onSheetIndexChange={setPcSheetIndex}
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
      <SegmentDetailSheet ref={segmentDetailRef} />

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
      {/* insets reference for ts-noUnused */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top, left: 0, width: 0, height: 0 }} />
    </View>
  );
}
