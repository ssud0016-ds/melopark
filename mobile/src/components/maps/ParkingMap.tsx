import { type ReactNode, useMemo } from 'react';
import Mapbox, {
  Camera,
  CircleLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';

import { colors } from '../../design-system';
import { haptics } from '../../design-system/haptics';
import type { Bay } from '../../services/apiBays';

type Props = {
  bays: Bay[];
  selectedBayId?: string | null;
  onSelectBay: (bay: Bay) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  children?: ReactNode;
};

const DEFAULT_CENTER: [number, number] = [144.9631, -37.8136];
const DEFAULT_ZOOM = 13;

function baysToGeoJson(bays: Bay[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: bays.map((b) => ({
      type: 'Feature',
      id: b.id,
      properties: {
        bayId: b.id,
        type: b.type,
        color:
          b.type === 'available'
            ? colors.statusGood
            : b.type === 'trap'
              ? colors.statusCaution
              : b.type === 'occupied'
                ? colors.statusAvoid
                : colors.statusUnknown,
      },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    })),
  };
}

export function ParkingMap({
  bays,
  selectedBayId,
  onSelectBay,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  children,
}: Props) {
  const shape = useMemo(() => baysToGeoJson(bays), [bays]);

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
            circleColor: colors.brand,
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
            textColor: colors.surface,
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
    </MapView>
  );
}
