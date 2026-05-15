import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../design-system';
import {
  AUTO_STAGE_DURATION_MS,
  AUTO_STAGE_RUN,
  CLUSTER_RADIUS,
  MAP_SPIKE_MARKER_COUNT,
  MELBOURNE_CBD_REGION,
  PAN_TARGET_REGION,
} from './mapSpikeConfig';
import { MarkerDot } from './MarkerDot';
import { MOCK_MARKERS } from './mockMarkers';

type SpikeStage = 'map-only' | 'raw-markers' | 'clustered-markers';

const stages: SpikeStage[] = ['map-only', 'raw-markers', 'clustered-markers'];

const stageLabels: Record<SpikeStage, string> = {
  'map-only': 'Map only',
  'raw-markers': 'Raw markers',
  'clustered-markers': 'Clustered',
};

const INITIAL_STAGE: SpikeStage = 'map-only';
const CURRENT_SPIKE_SESSION = Date.now();

type StageState = {
  session: number;
  stage: SpikeStage;
};

function StageButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-3 ${
        active ? 'bg-brand' : 'bg-surface-tertiary'
      }`}
      onPress={onPress}
    >
      <Text className={`font-sans text-xs font-semibold ${active ? 'text-white' : 'text-brand'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MapSpikeScreen() {
  const [stageState, setStageState] = useState<StageState>({
    session: CURRENT_SPIKE_SESSION,
    stage: INITIAL_STAGE,
  });
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const stage = stageState.session === CURRENT_SPIKE_SESSION ? stageState.stage : INITIAL_STAGE;
  const visibleMarkers = stage === INITIAL_STAGE ? [] : MOCK_MARKERS;
  const mapKey = stage;

  const markers = useMemo(
    () =>
      visibleMarkers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
          onPress={() => setSelectedMarkerId(marker.id)}
          tracksViewChanges={false}
        >
          <MarkerDot status={marker.status} />
        </Marker>
      )),
    [visibleMarkers],
  );

  useEffect(() => {
    setSelectedMarkerId(null);
    setStageState({
      session: CURRENT_SPIKE_SESSION,
      stage: INITIAL_STAGE,
    });
  }, []);

  useEffect(() => {
    const startedAt = Date.now();
    console.log(
      `[MapSpike] stage=${stage} markerCount=${visibleMarkers.length} render scheduled`,
    );

    const frame = requestAnimationFrame(() => {
      console.log(`[MapSpike] stage=${stage} JS settled in ${Date.now() - startedAt}ms`);
    });

    return () => cancelAnimationFrame(frame);
  }, [stage, visibleMarkers.length]);

  useEffect(() => {
    if (!AUTO_STAGE_RUN) {
      return;
    }

    const currentIndex = stages.indexOf(stage);
    if (currentIndex === stages.length - 1) {
      return;
    }

    const timeout = setTimeout(() => {
      const nextStage = stages[currentIndex + 1];
      console.log(`[MapSpike] auto advancing ${stage} -> ${nextStage}`);
      setSelectedMarkerId(null);
      setStageState({
        session: CURRENT_SPIKE_SESSION,
        stage: nextStage,
      });
    }, AUTO_STAGE_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [stage]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      mapRef.current?.animateToRegion(PAN_TARGET_REGION, 1200);
      console.log(`[MapSpike] stage=${stage} camera animation requested`);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [stage]);

  const onMapReady = () => {
    console.log(`[MapSpike] stage=${stage} map ready`);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-brand" edges={['top', 'right', 'left']}>
        <StatusBar style="light" backgroundColor={colors.brand} />

        <View className="gap-3 bg-brand px-4 pb-3 pt-2">
          <Text className="font-sans text-xs font-medium uppercase text-accent">
            Phase 2 map spike
          </Text>
          <Text className="font-sans text-xl font-bold text-white">
            react-native-maps viability
          </Text>
          <Text className="font-sans text-xs text-brand-100">
            Local mock data only. No MapPage, ParkingMap, Leaflet, vectorgrid, or backend APIs.
          </Text>
          <View className="flex-row gap-2">
            {stages.map((item) => (
              <StageButton
                key={item}
                active={stage === item}
                label={stageLabels[item]}
                onPress={() => {
                  requestAnimationFrame(() => {
                    setSelectedMarkerId(null);
                    setStageState({
                      session: CURRENT_SPIKE_SESSION,
                      stage: item,
                    });
                  });
                }}
              />
            ))}
          </View>
        </View>

        <View className="flex-1 bg-surface">
          {stage === 'clustered-markers' ? (
            <ClusteredMapView
              key={mapKey}
              ref={mapRef}
              className="flex-1"
              clusterColor={colors.brand}
              initialRegion={MELBOURNE_CBD_REGION}
              onMapReady={onMapReady}
              provider={PROVIDER_GOOGLE}
              radius={CLUSTER_RADIUS}
            >
              {markers}
            </ClusteredMapView>
          ) : (
            <MapView
              key={mapKey}
              ref={mapRef}
              className="flex-1"
              initialRegion={MELBOURNE_CBD_REGION}
              onMapReady={onMapReady}
              provider={PROVIDER_GOOGLE}
            >
              {markers}
            </MapView>
          )}
        </View>

        <View className="gap-1 bg-white px-4 py-3">
          <Text className="font-sans text-xs font-semibold text-brand">
            Stage: {stageLabels[stage]} | Markers: {visibleMarkers.length}/
            {MAP_SPIKE_MARKER_COUNT}
          </Text>
          <Text className="font-sans text-xs text-gray-600">
            Selected: {selectedMarkerId ?? 'none'}
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
