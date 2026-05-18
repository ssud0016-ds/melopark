import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';
import type { MapState } from '@rnmapbox/maps';

import { colors } from '../../design-system';
import { haptics } from '../../design-system/haptics';
import type { Landmark } from '../../data/landmarks';
import type { AltPin } from '../../hooks/useDestination';
import type { PressureBounds } from '../../services/apiPressure';
import {
  BAY_CLUSTER_PROPERTIES,
  clusterCircleColorExpression,
  clusterCircleRadiusExpression,
  clusterTextFieldExpression,
} from '../../utils/clusterBadgeColors';
import { mapStateToPressureBounds, visibleBoundsPairToPressureBounds } from '../../utils/mapBounds';
import { getStatusFillColor, type BayStatus } from '../../utils/pressureSegmentStyle';
import {
  boundsFromLatLngs,
  circlePolygon,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
  SEARCH_RADIUS_M,
} from '../../utils/mapGeo';
import { mapBasemapStyleUrl } from '../../utils/mapStyle';
import type { Bay } from '../../services/apiBays';

export type FlyToOptions = {
  zoom?: number;
  durationMs?: number;
};

export type FitBoundsOptions = {
  paddingPx?: number;
  maxZoom?: number;
  durationMs?: number;
};

export type ParkingMapRef = {
  flyTo: (lat: number, lng: number, opts?: FlyToOptions) => void;
  fitBounds: (points: { lat: number; lng: number }[], opts?: FitBoundsOptions) => void;
  refreshBounds: () => void;
};

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
  /** When true, use Mapbox Navigation Night basemap. */
  mapDark?: boolean;
  accessibilityBayIds?: string[];
  onMapEmptyClick?: () => void;
  onBoundsChange?: (bounds: PressureBounds) => void;
  children?: ReactNode;
};

function bayStatusForColor(type: Bay['type']): BayStatus {
  if (type === 'trap') return 'caution';
  if (type === 'occupied') return 'occupied';
  if (type === 'available') return 'available';
  return 'unknown';
}

function statusColor(type: Bay['type'], cb: boolean): string {
  return getStatusFillColor(bayStatusForColor(type), cb);
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

export const ParkingMap = forwardRef<ParkingMapRef, Props>(function ParkingMap(
  {
    bays,
    selectedBayId,
    onSelectBay,
    initialCenter = DEFAULT_MAP_CENTER,
    initialZoom = DEFAULT_MAP_ZOOM,
    destination = null,
    altPin = null,
    dimRadiusM,
    colorBlindMode = false,
    mapDark = false,
    accessibilityBayIds,
    onMapEmptyClick,
    onBoundsChange,
    children,
  },
  ref,
) {
  const shape = useMemo(
    () => baysToGeoJson(bays, colorBlindMode, accessibilityBayIds),
    [bays, colorBlindMode, accessibilityBayIds],
  );
  const styleURL = useMemo(() => mapBasemapStyleUrl(mapDark), [mapDark]);
  const clusterCircleColor = useMemo(
    () => clusterCircleColorExpression(colorBlindMode, mapDark),
    [colorBlindMode, mapDark],
  );
  const cameraRef = useRef<Camera>(null);
  const mapViewRef = useRef<MapView>(null);
  const zoomRef = useRef(initialZoom);

  const reportVisibleBounds = useCallback(async () => {
    if (!onBoundsChange) return;
    const map = mapViewRef.current;
    if (!map) return;
    try {
      const pair = await map.getVisibleBounds();
      onBoundsChange(visibleBoundsPairToPressureBounds(pair));
    } catch {
      /* native map not ready */
    }
  }, [onBoundsChange]);

  const reportBoundsFromState = useCallback(
    (state: MapState) => {
      const z = state?.properties?.zoom;
      if (typeof z === 'number') zoomRef.current = z;
      if (!onBoundsChange) return;
      const b = state?.properties?.bounds;
      if (b?.ne && b?.sw) {
        onBoundsChange(mapStateToPressureBounds(b));
        return;
      }
      void reportVisibleBounds();
    },
    [onBoundsChange, reportVisibleBounds],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo(lat: number, lng: number, opts?: FlyToOptions) {
        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: opts?.zoom ?? DESTINATION_MAP_ZOOM,
          animationDuration: opts?.durationMs ?? 600,
        });
      },
      fitBounds(points, opts) {
        const bounds = boundsFromLatLngs(points);
        if (!bounds || !cameraRef.current) return;
        const pad = opts?.paddingPx ?? 80;
        const duration = opts?.durationMs ?? 800;
        cameraRef.current.fitBounds(bounds.ne, bounds.sw, [pad, pad], duration);
      },
      refreshBounds: () => {
        void reportVisibleBounds();
      },
    }),
    [reportVisibleBounds],
  );

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
      ref={mapViewRef}
      style={{ flex: 1 }}
      styleURL={styleURL}
      projection="mercator"
      attributionEnabled
      logoEnabled
      compassEnabled={false}
      scaleBarEnabled={false}
      onPress={() => onMapEmptyClick?.()}
      onMapIdle={reportBoundsFromState}
      onDidFinishLoadingMap={() => {
        void reportVisibleBounds();
      }}
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

      <ShapeSource
        id="melopark-bays-src"
        shape={shape}
        cluster
        clusterRadius={50}
        clusterMaxZoomLevel={18}
        clusterProperties={BAY_CLUSTER_PROPERTIES}
        onPress={(e) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties as { bayId?: string; cluster?: boolean } | undefined;
          if (props?.cluster) {
            const geom = f.geometry;
            if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
              const [lng, lat] = geom.coordinates as [number, number];
              const nextZoom = Math.min(19, zoomRef.current + 2);
              haptics.light();
              cameraRef.current?.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: nextZoom,
                animationDuration: 400,
              });
            }
            return;
          }
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
            circleColor: clusterCircleColor,
            circleRadius: clusterCircleRadiusExpression,
            circleStrokeWidth: 2,
            circleStrokeColor: colors.surface,
          }}
        />
        <SymbolLayer
          id="melopark-bay-cluster-count"
          filter={['has', 'point_count']}
          style={{
            textField: clusterTextFieldExpression,
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

      {children}

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
              circleColor: altPin.source === 'alternative' ? '#047857' : colors.statusGood,
              circleRadius: altPin.source === 'alternative' ? 18 : 9,
              circleStrokeColor: colors.surface,
              circleStrokeWidth: 3,
            }}
          />
          {altPin.source === 'alternative' ? (
            <SymbolLayer
              id="melopark-alt-pin-diamond"
              style={{
                textField: '◆',
                textSize: 15,
                textColor: '#ffffff',
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          ) : null}
        </ShapeSource>
      ) : null}
    </MapView>
  );
});
