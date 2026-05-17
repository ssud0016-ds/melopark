import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../components/common/Toast';
import { BusyNowLayer } from '../components/maps/BusyNowLayer';
import { launchMaps } from '../components/maps/launchMaps';
import { ParkingMap } from '../components/maps/ParkingMap';
import { OnboardingOverlay } from '../components/onboarding/OnboardingOverlay';
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
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useMapsProvider } from '../hooks/useMapsProvider';
import { useOnboarding } from '../hooks/useOnboarding';
import type { TabParamList } from '../navigation/types';
import type { Bay } from '../services/apiBays';

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
  const { bays, loading, error, availableBayCount } = useBays();
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [busyNowEnabled, setBusyNowEnabled] = useState(true);
  const [baySheetIndex, setBaySheetIndex] = useState(-1);

  const { manifest } = useBusyNow(busyNowEnabled);
  const { needsOnboarding, complete: completeOnboarding } = useOnboarding();
  const { provider } = useMapsProvider();
  const { show: showToast } = useToast();
  const { state: locationState, canAskAgain, request: requestLocation } = useLocationPermission();

  // Plan §Phase 3: request location once on first mount when grant still gettable.
  useEffect(() => {
    if (locationState === 'never-asked' && canAskAgain) {
      requestLocation();
    }
  }, [locationState, canAskAgain, requestLocation]);

  const bayDetailRef = useRef<BayDetailSheetRef>(null);
  const segmentDetailRef = useRef<SegmentDetailSheetRef>(null);

  const onSelectBay = useCallback((bay: Bay) => {
    setSelectedBayId(bay.id);
    bayDetailRef.current?.present(bay.id);
  }, []);

  const onSegmentPress = useCallback((segmentId: string) => {
    segmentDetailRef.current?.present(segmentId);
  }, []);

  // Deep-link params (melopark://map?bayId=… or via SearchScreen jump).
  useEffect(() => {
    const bayId = route.params?.bayId;
    if (bayId) {
      setSelectedBayId(bayId);
      bayDetailRef.current?.present(bayId);
    }
    const segmentId = route.params?.segmentId;
    if (segmentId) segmentDetailRef.current?.present(segmentId);
  }, [route.params?.bayId, route.params?.segmentId]);

  // Plan §7: hide tab bar at SNAP_FULL; restore otherwise.
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: baySheetIndex === SNAP_FULL_INDEX ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE,
    });
  }, [baySheetIndex, navigation]);

  // Plan §7: hardware back collapses sheet first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const idx = bayDetailRef.current?.getIndex() ?? -1;
      if (idx === SNAP_FULL_INDEX) {
        bayDetailRef.current?.snapTo(0);
        return true;
      }
      if (idx === 0) {
        bayDetailRef.current?.dismiss();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <View
        className="absolute left-4 right-4 z-10 gap-1 rounded-2xl bg-surface px-4 py-3 dark:bg-surface-dark-secondary"
        style={{ top: insets.top + 8 }}
      >
        <Text className="font-sans text-xs font-medium uppercase text-brand dark:text-accent">
          Melbourne CBD
        </Text>
        <Text className="font-sans text-sm text-gray-700 dark:text-gray-300">
          {loading && bays.length === 0
            ? 'Loading bays…'
            : error
              ? `Live data unavailable — ${error}`
              : `${availableBayCount} available · ${bays.length} total`}
        </Text>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: busyNowEnabled }}
        onPress={() => setBusyNowEnabled((v) => !v)}
        className="absolute right-4 z-10 min-h-[44px] flex-row items-center justify-center rounded-full bg-surface px-4 dark:bg-surface-dark-secondary"
        style={{ top: insets.top + 80 }}
      >
        <Text className="font-sans text-xs font-semibold text-brand dark:text-accent">
          BusyNow {busyNowEnabled ? 'on' : 'off'}
        </Text>
      </Pressable>

      {loading && bays.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ParkingMap bays={bays} selectedBayId={selectedBayId} onSelectBay={onSelectBay}>
          {busyNowEnabled ? (
            <BusyNowLayer manifest={manifest} onSegmentPress={onSegmentPress} />
          ) : null}
        </ParkingMap>
      )}

      <BayDetailSheet
        ref={bayDetailRef}
        onSheetIndexChange={setBaySheetIndex}
        onNavigateCta={(bayId) => {
          const bay = bays.find((b) => b.id === bayId);
          if (!bay) {
            showToast('Bay coordinates missing', 'warning');
            return;
          }
          launchMaps({ provider, lat: bay.lat, lng: bay.lng, label: bay.name ?? bay.id }).then(
            (ok) => {
              if (!ok) showToast('No navigation app available', 'error');
            },
          );
        }}
      />
      <SegmentDetailSheet ref={segmentDetailRef} />

      {needsOnboarding === true ? <OnboardingOverlay onDone={completeOnboarding} /> : null}
    </View>
  );
}
