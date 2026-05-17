import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';

import { colors } from '../../design-system';
import { haptics } from '../../design-system/haptics';
import type { Landmark } from '../../data/landmarks';
import type { AltPin } from '../../hooks/useDestination';
import {
  circlePolygon,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
  SEARCH_RADIUS_M,
} from '../../utils/mapGeo';
import type { Bay } from '../../services/apiBays';

type Props = {
  bays: Bay[];
  selectedBayId?: string | null;
  onSelectBay: (bay: Bay) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  destination?: Landmark | null;
  altPin?: AltPin | null;
  dimRadiusM?: number;
  colorBlindMode?: boolean;
  accessibilityBayIds?: string[];
  onMapEmptyClick?: () => void;
  children?: ReactNode;
};

function statusColor(type: Bay['type'], cb: boolean): string {
  if (cb) {
    if (type === 'available') return '#2563eb';
    if (type === 'trap') return '#d97706';
    if (type === 'occupied') return '#7c2d12';
    return colors.statusUnknown;
  }
  if (type === 'available') return colors.statusGood;
  if (type === 'trap') return colors.statusCaution;
  if (type === 'occupied') return colors.statusAvoid;
  return colors.statusUnknown;
}

function baysToGeoJson(bays: Bay[], cb: boolean, accessibleIds?: string[]): GeoJSON.FeatureCollection {
  const allow = accessibleIds && accessibleIds.length > 0 ? new Set(accessibleIds) : null;
  return {
    type: 'FeatureCollection',
    features: bays
      .filter((b) => (allow ? allow.has(b.id) : true))
      .map((b) => ({
        type: 'Feature',
        id: b.id,
        properties: {
          bayId: b.id,
          type: b.type,
          color: statusColor(b.type, cb),
        },
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      })),
  };
}

function destinationGeoJson(d: Landmark): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'destination' },
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      },
    ],
  };
}

function altPinGeoJson(a: AltPin): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'alt' },
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      },
    ],
  };
}

export function ParkingMap({
  bays,
  selectedBayId,
  onSelectBay,
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_MAP_ZOOM,
  destination = null,
  altPin = null,
  dimRadiusM,
  colorBlindMode = false,
  accessibilityBayIds,
  onMapEmptyClick,
  children,
}: Props) {
  const shape = useMemo(
    () => baysToGeoJson(bays, colorBlindMode, accessibilityBayIds),
    [bays, colorBlindMode, accessibilityBayIds],
  );
  const cameraRef = useRef<Camera>(null);

  const radiusM = dimRadiusM ?? SEARCH_RADIUS_M;
  const ALT_RADIUS_M = 140;
  const destRadiusShape = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!destination) return null;
    return { type: 'FeatureCollection', features: [circlePolygon(destination.lng, destination.lat, radiusM)] };
  }, [destination, radiusM]);
  const altRadiusShape = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!altPin) return null;
    return { type: 'FeatureCollection', features: [circlePolygon(altPin.lng, altPin.lat, ALT_RADIUS_M)] };
  }, [altPin]);
  const altConnectorShape = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!destination || !altPin) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [destination.lng, destination.lat],
              [altPin.lng, altPin.lat],
            ],
          },
        },
      ],
    };
  }, [destination, altPin]);

  useEffect(() => {
    if (destination && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [destination.lng, destination.lat],
        zoomLevel: DESTINATION_MAP_ZOOM,
        animationDuration: 600,
      });
    }
  }, [destination]);

  return (
    <MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Street}
      attributionEnabled
      logoEnabled
      compassEnabled={false}
      scaleBarEnabled={false}
      onPress={() => onMapEmptyClick?.()}
    >
      <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: initialZoom }} />

      {destRadiusShape ? (
        <ShapeSource id="melopark-dest-radius-src" shape={destRadiusShape}>
          <FillLayer id="melopark-dest-radius-fill" style={{ fillColor: colors.brand, fillOpacity: 0.07 }} />
          <LineLayer
            id="melopark-dest-radius-line"
            style={{
              lineColor: colors.brand,
              lineOpacity: 0.75,
              lineWidth: 2,
              lineDasharray: [4, 3],
            }}
          />
        </ShapeSource>
      ) : null}

      {altConnectorShape ? (
        <ShapeSource id="melopark-alt-connector-src" shape={altConnectorShape}>
          <LineLayer
            id="melopark-alt-connector-line"
            style={{
              lineColor: '#047857',
              lineOpacity: 0.55,
              lineWidth: 2,
              lineDasharray: [3, 4],
              lineCap: 'round',
            }}
          />
        </ShapeSource>
      ) : null}

      {altRadiusShape ? (
        <ShapeSource id="melopark-alt-radius-src" shape={altRadiusShape}>
          <FillLayer id="melopark-alt-radius-fill" style={{ fillColor: '#10b981', fillOpacity: 0.07 }} />
          <LineLayer
            id="melopark-alt-radius-line"
            style={{
              lineColor: '#047857',
              lineOpacity: 0.35,
              lineWidth: 1.5,
              lineDasharray: [5, 6],
            }}
          />
        </ShapeSource>
      ) : null}

      {children}

      <ShapeSource
        id="melopark-bays-src"
        shape={shape}
        cluster
        clusterRadius={50}
        clusterMaxZoomLevel={16}
        onPress={(e) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties as { bayId?: string; cluster?: boolean } | undefined;
          if (props?.cluster) return;
          const bayId = props?.bayId;
          const bay = bays.find((b) => b.id === bayId);
          if (bay) {
            haptics.light();
            onSelectBay(bay);
          }
        }}
      >
        <CircleLayer
          id="melopark-bay-clusters"
          filter={['has', 'point_count']}
          style={{
            circleColor: colorBlindMode ? '#2563eb' : colors.statusGood,
            circleRadius: ['step', ['get', 'point_count'], 18, 25, 22, 75, 26],
            circleStrokeWidth: 2,
            circleStrokeColor: colors.surface,
          }}
        />
        <SymbolLayer
          id="melopark-bay-cluster-count"
          filter={['has', 'point_count']}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textSize: 14,
            textColor: colors.surface,
            textFont: ['Open Sans Bold'],
            textIgnorePlacement: true,
            textAllowOverlap: true,
          }}
        />
        <CircleLayer
          id="melopark-bay-dots"
          filter={['!', ['has', 'point_count']]}
          style={{
            circleColor: ['get', 'color'],
            circleRadius: ['case', ['==', ['get', 'bayId'], selectedBayId ?? ''], 8, 5],
            circleStrokeWidth: ['case', ['==', ['get', 'bayId'], selectedBayId ?? ''], 2, 1],
            circleStrokeColor: [
              'case',
              ['==', ['get', 'bayId'], selectedBayId ?? ''],
              colors.brand,
              colors.surface,
            ],
          }}
        />
      </ShapeSource>

      {destination ? (
        <ShapeSource id="melopark-destination-src" shape={destinationGeoJson(destination)}>
          <CircleLayer
            id="melopark-destination-pin"
            style={{
              circleColor: colors.brand,
              circleRadius: 10,
              circleStrokeColor: colors.surface,
              circleStrokeWidth: 3,
            }}
          />
        </ShapeSource>
      ) : null}

      {altPin ? (
        <ShapeSource id="melopark-alt-pin-src" shape={altPinGeoJson(altPin)}>
          <CircleLayer
            id="melopark-alt-pin-circle"
            style={{
              circleColor: colors.statusGood,
              circleRadius: 9,
              circleStrokeColor: colors.surface,
              circleStrokeWidth: 3,
            }}
          />
        </ShapeSource>
      ) : null}

    </MapView>
  );
}
