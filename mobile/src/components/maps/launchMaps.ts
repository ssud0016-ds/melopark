import * as Linking from 'expo-linking';

import type { MapsProvider } from '../../hooks/useMapsProvider';

type LatLng = { lat: number; lng: number };
type Mode = 'drive' | 'walk';

export type LaunchMapsArgs = {
  provider: MapsProvider | null;
  mode?: Mode;
  destination: LatLng;
  origin?: LatLng | null;
  label?: string;
  onFallback?: (info: { provider: MapsProvider | null }) => void;
};

// Plan §4.7 Linking-based provider chooser (replaces web iframe trick).
// Falls back to web Google Maps if native handler not installed.
// Walk mode: origin = bay, destination = searched landmark (matches web).
export async function launchMaps(args: LaunchMapsArgs): Promise<boolean> {
  const candidates = providerUrls(args);
  let triedNative = false;

  for (const url of candidates) {
    const isWeb = url.startsWith('https://');
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        if (isWeb && triedNative && typeof args.onFallback === 'function') {
          args.onFallback({ provider: args.provider });
        }
        return true;
      }
      if (!isWeb) triedNative = true;
    } catch {
      if (!isWeb) triedNative = true;
    }
  }
  return false;
}

function providerUrls({
  provider,
  mode = 'drive',
  destination,
  origin,
  label,
}: LaunchMapsArgs): string[] {
  const { lat, lng } = destination;
  const enc = (s?: string) => (s ? encodeURIComponent(s) : '');
  const travel = mode === 'walk' ? 'walking' : 'driving';
  const originParam =
    mode === 'walk' && origin ? `&origin=${origin.lat},${origin.lng}` : '';
  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${originParam}&travelmode=${travel}${
    label ? `&destination_place_id=${enc(label)}` : ''
  }`;

  switch (provider) {
    case 'google':
      if (mode === 'walk') {
        const gmaps = `comgooglemaps://?daddr=${lat},${lng}${
          origin ? `&saddr=${origin.lat},${origin.lng}` : ''
        }&directionsmode=walking`;
        return [gmaps, web];
      }
      return [
        `google.navigation:q=${lat},${lng}`,
        `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${enc(label)})` : ''}`,
        web,
      ];
    case 'waze':
      return [`waze://?ll=${lat},${lng}&navigate=yes`, web];
    case 'web':
      return [web];
    default:
      return [`geo:${lat},${lng}?q=${lat},${lng}`, web];
  }
}
