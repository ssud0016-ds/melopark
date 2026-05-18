import { LineLayer, VectorSource } from '@rnmapbox/maps';

import { statusColor } from '../../design-system';
import { apiBase } from '../../services/api';
import type { PressureManifest } from '../../services/apiPressure';

type Props = {
  manifest: PressureManifest | null;
  colorBlindMode?: boolean;
  onSegmentPress?: (segmentId: string, props: Record<string, unknown>) => void;
};

export function busyNowLineColorExpression(colorBlindMode = false) {
  return [
    'match',
    ['get', 'level'],
    'low',
    statusColor('good', colorBlindMode),
    'medium',
    statusColor('caution', colorBlindMode),
    'high',
    statusColor('avoid', colorBlindMode),
    'critical',
    statusColor('avoid', colorBlindMode),
    statusColor('unknown', colorBlindMode),
  ];
}

// Phase 2.E BusyNow vector layer.
// Backend serves MVT tiles at /api/pressure/tiles/{z}/{x}/{y}.mvt; source-layer = "pressure"
// (matches frontend Leaflet config). Mapbox renders MVT natively - no client
// decode, no GeoJSON conversion. Library-swap dividend.
export function BusyNowLayer({ manifest, colorBlindMode = false, onSegmentPress }: Props) {
  if (!manifest) return null;

  const v = encodeURIComponent(manifest.data_version || manifest.minute_bucket || 'now');
  const template = manifest.tile_url_template;
  const absolute = template.startsWith('http') ? template : `${apiBase()}${template}`;
  const tileUrl = `${absolute}?v=${v}`;
  const baseLayer = (
    <LineLayer
      id="busynow-line"
      sourceLayerID="pressure"
      style={{
        lineColor: busyNowLineColorExpression(colorBlindMode) as never,
        lineWidth: ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 3, 19, 6],
        lineCap: 'round',
        lineJoin: 'round',
        lineOpacity: 0.85,
      }}
    />
  );

  return (
    <VectorSource
      id="busynow"
      tileUrlTemplates={[tileUrl]}
      minZoomLevel={13}
      maxZoomLevel={19}
      onPress={(e) => {
        const f = e.features?.[0];
        if (!f || !onSegmentPress) return;
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const segId = String(props.id ?? props.segment_id ?? '');
        if (segId) onSegmentPress(segId, props);
      }}
    >
      {colorBlindMode ? (
        <>
          {baseLayer}
          <LineLayer
            id="busynow-line-high-critical-cue"
            sourceLayerID="pressure"
            filter={['in', ['get', 'level'], ['literal', ['high', 'critical']]] as never}
            style={{
              lineColor: statusColor('avoid', true),
              lineWidth: ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 4, 19, 7],
              lineDasharray: [2, 2],
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.95,
            }}
          />
        </>
      ) : (
        baseLayer
      )}
    </VectorSource>
  );
}
