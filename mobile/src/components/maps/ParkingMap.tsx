import { type ReactNode, useMemo } from 'react';
import Mapbox, {
  Camera,
  CircleLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';

import { colorBlindColors, colors, statusColor } from '../../design-system';
import { haptics } from '../../design-system/haptics';
import type { Bay } from '../../services/apiBays';

type Props = {
  bays: Bay[];
  selectedBayId?: string | null;
  highlightedBayIds?: string[];
  planningVerdicts?: Record<string, 'yes' | 'no' | 'unknown'>;
  colorBlindMode?: boolean;
  destination?: { lat: number; lng: number; label?: string } | null;
  onSelectBay: (bay: Bay) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  children?: ReactNode;
};

const DEFAULT_CENTER: [number, number] = [144.9631, -37.8136];
const DEFAULT_ZOOM = 13;

function bayStatusColor(
  bay: Bay,
  planningVerdicts: Record<string, 'yes' | 'no' | 'unknown'>,
  colorBlindMode: boolean,
) {
  const verdict = planningVerdicts[bay.id];
  if (verdict === 'yes') return statusColor('good', colorBlindMode);
  if (verdict === 'no') return statusColor('avoid', colorBlindMode);
  if (verdict === 'unknown') return statusColor('unknown', colorBlindMode);
  if (bay.type === 'available') return statusColor('good', colorBlindMode);
  if (bay.type === 'trap') return statusColor('caution', colorBlindMode);
  if (bay.type === 'occupied') return statusColor('avoid', colorBlindMode);
  return statusColor('unknown', colorBlindMode);
}

export function clusterBadgeColors(colorBlindMode: boolean) {
  return {
    background: colorBlindMode ? colorBlindColors.statusGood : colors.brand,
    text: colors.surface,
  };
}

export function baysToGeoJson(
  bays: Bay[],
  highlightedBayIds: string[],
  planningVerdicts: Record<string, 'yes' | 'no' | 'unknown'>,
  colorBlindMode = false,
): GeoJSON.FeatureCollection {
  const highlighted = new Set(highlightedBayIds);
  return {
    type: 'FeatureCollection',
    features: bays.map((b) => ({
      type: 'Feature',
      id: b.id,
      properties: {
        bayId: b.id,
        type: b.type,
        highlighted: highlighted.has(b.id),
        planningVerdict: planningVerdicts[b.id] ?? '',
        color: bayStatusColor(b, planningVerdicts, colorBlindMode),
      },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    })),
  };
}

export function ParkingMap({
  bays,
  selectedBayId,
  highlightedBayIds = [],
  planningVerdicts = {},
  colorBlindMode = false,
  destination = null,
  onSelectBay,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  children,
}: Props) {
  const shape = useMemo(
    () => baysToGeoJson(bays, highlightedBayIds, planningVerdicts, colorBlindMode),
    [bays, highlightedBayIds, planningVerdicts, colorBlindMode],
  );
  const clusterColors = clusterBadgeColors(colorBlindMode);
  const destinationShape = useMemo<GeoJSON.FeatureCollection | null>(
    () =>
      destination
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { label: destination.label ?? 'Destination' },
                geometry: { type: 'Point', coordinates: [destination.lng, destination.lat] },
              },
            ],
          }
        : null,
    [destination],
  );

  return (
    <MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Street}
      attributionEnabled
      logoEnabled
      compassEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera
        defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: initialZoom }}
      />

      {/* BusyNow vector layer (rendered below bay markers so dots stay tappable). */}
      {children}

      {destinationShape ? (
        <ShapeSource id="planning-destination" shape={destinationShape}>
          <CircleLayer
            id="planning-destination-dot"
            style={{
              circleColor: colors.brand,
              circleRadius: 9,
              circleStrokeWidth: 3,
              circleStrokeColor: colors.surface,
            }}
          />
          <SymbolLayer
            id="planning-destination-label"
            style={{
              textField: 'Destination',
              textSize: 11,
              textColor: colors.brand,
              textOffset: [0, 1.4],
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </ShapeSource>
      ) : null}

      <ShapeSource
        id="bays"
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
          id="bay-clusters"
          filter={['has', 'point_count']}
          style={{
            circleColor: clusterColors.background,
            circleRadius: ['step', ['get', 'point_count'], 14, 25, 18, 75, 22],
            circleStrokeWidth: 2,
            circleStrokeColor: colors.surface,
          }}
        />
        <SymbolLayer
          id="bay-cluster-count"
          filter={['has', 'point_count']}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textSize: 12,
            textColor: clusterColors.text,
            textFont: ['Open Sans Bold'],
            textIgnorePlacement: true,
            textAllowOverlap: true,
          }}
        />
        <CircleLayer
          id="bay-dots"
          filter={['!', ['has', 'point_count']]}
          style={{
            circleColor: ['get', 'color'],
            circleRadius: [
              'case',
              ['==', ['get', 'bayId'], selectedBayId ?? ''],
              8,
              ['==', ['get', 'highlighted'], true],
              7,
              5,
            ],
            circleStrokeWidth: [
              'case',
              ['==', ['get', 'bayId'], selectedBayId ?? ''],
              2,
              ['==', ['get', 'highlighted'], true],
              2,
              1,
            ],
            circleStrokeColor: [
              'case',
              ['==', ['get', 'bayId'], selectedBayId ?? ''],
              colors.brand,
              ['==', ['get', 'highlighted'], true],
              colors.brand,
              colors.surface,
            ],
          }}
        />
      </ShapeSource>
    </MapView>
  );
}
