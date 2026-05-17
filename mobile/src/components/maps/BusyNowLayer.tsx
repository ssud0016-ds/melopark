import { LineLayer, VectorSource } from '@rnmapbox/maps';

import { colors } from '../../design-system';
import { apiBase } from '../../services/api';
import type { PressureManifest } from '../../services/apiPressure';

type Props = {
  manifest: PressureManifest | null;
  onSegmentPress?: (segmentId: string, props: Record<string, unknown>) => void;
};

// Phase 2.E BusyNow polyline layer.
// Backend serves MVT tiles at /api/pressure/tiles/{z}/{x}/{y}.mvt; source-layer = "pressure"
// (matches frontend Leaflet config). Mapbox renders MVT natively — no client
// decode, no GeoJSON conversion. Library-swap dividend.
export function BusyNowLayer({ manifest, onSegmentPress }: Props) {
  if (!manifest) return null;

  const v = encodeURIComponent(manifest.data_version || manifest.minute_bucket || 'now');
  const template = manifest.tile_url_template;
  const absolute = template.startsWith('http') ? template : `${apiBase()}${template}`;
  const tileUrl = `${absolute}?v=${v}`;

  return (
    <VectorSource
      id="melopark-busynow-src"
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
      <LineLayer
        id="melopark-busynow-line"
        sourceLayerID="pressure"
        style={{
          lineColor: [
            'match',
            ['get', 'level'],
            'low',
            colors.statusGood,
            'medium',
            colors.statusCaution,
            'high',
            colors.statusAvoid,
            'critical',
            colors.statusAvoid,
            colors.statusUnknown,
          ],
          lineWidth: ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 3, 19, 6],
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 0.85,
        }}
      />
    </VectorSource>
  );
}
