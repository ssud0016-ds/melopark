import type { ParkingMapRef } from '../components/maps/ParkingMap';
import {
  QUIET_STREET_FLY_MS,
  QUIET_STREET_MAP_ZOOM,
  type LatLng,
} from './mapGeo';

/** Web MapPage handleAlternativeClick camera framing. */
export function frameMapToAlternative(
  mapRef: Pick<ParkingMapRef, 'fitBounds' | 'flyTo'> | null | undefined,
  destination: LatLng | null | undefined,
  alt: LatLng,
): void {
  if (!mapRef) return;
  if (destination) {
    mapRef.fitBounds([destination, alt], {
      paddingPx: 80,
      maxZoom: QUIET_STREET_MAP_ZOOM,
      durationMs: QUIET_STREET_FLY_MS,
    });
    return;
  }
  mapRef.flyTo(alt.lat, alt.lng, {
    zoom: QUIET_STREET_MAP_ZOOM,
    durationMs: QUIET_STREET_FLY_MS,
  });
}
