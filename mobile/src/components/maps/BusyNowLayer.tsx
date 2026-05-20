import { useMemo } from 'react';
import { LineLayer, VectorSource } from '@rnmapbox/maps';

import { buildTileUrlTemplate, type PressureManifest } from '../../services/apiPressure';
import {
  buildBusyNowLineLayerStyle,
  BUSYNOW_HIGH_LEVEL_FILTER,
  COLOR_BLIND_HIGH_LINE_DASH,
} from '../../utils/busyNowLayerExpressions';
import { SEARCH_RADIUS_M } from '../../utils/mapGeo';

type Props = {
  manifest: PressureManifest;
  /** Remount vector tiles when basemap style changes (avoids stale source after styleURL swap). */
  mapStyleKey?: string;
  colorBlindMode?: boolean;
  destination?: { lat: number; lng: number } | null;
  dimRadiusM?: number;
  onSegmentPress?: (segmentId: string, props: Record<string, unknown>) => void;
};

// Phase 2.E BusyNow polyline layer — MVT source-layer "pressure" (web parity).
export function BusyNowLayer({
  manifest,
  mapStyleKey = 'default',
  colorBlindMode = false,
  destination = null,
  dimRadiusM = SEARCH_RADIUS_M,
  onSegmentPress,
}: Props) {
  const tileUrl = buildTileUrlTemplate(manifest);
  const lineStyle = useMemo(
    () =>
      buildBusyNowLineLayerStyle({
        colorBlindMode,
        destination,
        dimRadiusM,
      }),
    [colorBlindMode, destination, dimRadiusM],
  );

  if (!tileUrl) return null;

  return (
    <VectorSource
      key={`busynow-${mapStyleKey}`}
      id="melopark-busynow-src"
      tileUrlTemplates={[tileUrl]}
      minZoomLevel={manifest.min_zoom ?? 13}
      maxZoomLevel={manifest.max_zoom ?? 19}
      onPress={(e) => {
        const f = e.features?.[0];
        if (!f || !onSegmentPress) return;
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const segId = String(props.id ?? props.segment_id ?? '');
        if (segId) onSegmentPress(segId, props);
      }}
    >
      <LineLayer
        id="melopark-busynow-line"
        sourceLayerID="pressure"
        belowLayerID="melopark-bay-clusters"
        style={lineStyle}
      />
      <LineLayer
        id="melopark-busynow-line-high-cb"
        sourceLayerID="pressure"
        belowLayerID="melopark-bay-clusters"
        filter={
          colorBlindMode
            ? BUSYNOW_HIGH_LEVEL_FILTER
            : (['==', ['get', 'level'], '__never__'] as typeof BUSYNOW_HIGH_LEVEL_FILTER)
        }
        style={
          colorBlindMode
            ? { ...lineStyle, lineDasharray: COLOR_BLIND_HIGH_LINE_DASH }
            : { lineOpacity: 0, lineWidth: 0 }
        }
      />
    </VectorSource>
  );
}
