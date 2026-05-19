import type { LaunchMapsArgs } from '../components/maps/launchMaps';
import type { MapsProvider } from '../hooks/useMapsProvider';

type LatLng = { lat: number; lng: number };

type BayLike = {
  lat: number;
  lng: number;
  name?: string | null;
  id?: number | string;
};

export function buildMapsLaunchArgs(
  provider: MapsProvider,
  mode: 'drive' | 'walk',
  bay: BayLike,
  walkEnd: LatLng | null | undefined,
  onFallback?: () => void,
): LaunchMapsArgs {
  const label = bay.name ?? (bay.id != null ? `Bay ${bay.id}` : undefined);
  if (mode === 'walk' && walkEnd) {
    return {
      provider,
      mode: 'walk',
      origin: { lat: bay.lat, lng: bay.lng },
      destination: { lat: walkEnd.lat, lng: walkEnd.lng },
      label,
      onFallback,
    };
  }
  return {
    provider,
    mode: 'drive',
    destination: { lat: bay.lat, lng: bay.lng },
    label,
    onFallback,
  };
}
