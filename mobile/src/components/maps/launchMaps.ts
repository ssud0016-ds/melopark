import * as Linking from 'expo-linking';

import type { MapsProvider } from '../../hooks/useMapsProvider';

type LatLng = { lat: number; lng: number };
type Mode = 'drive' | 'walk';

type LaunchArgs = {
  provider: MapsProvider | null;
  lat: number;
  lng: number;
  label?: string;
  mode?: Mode;
  origin?: LatLng | null;
};

// Plan §4.7 Linking-based provider chooser (replaces web iframe trick).
// Falls back to web Google Maps if native handler not installed.
// `mode: 'walk'` switches the deep-link to walking directions; `origin` is
// only used in walk mode (Google Maps walking dir needs both endpoints).
export async function launchMaps(args: LaunchArgs): Promise<boolean> {
  const candidates = providerUrls(args);
  for (const url of candidates) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // try next
    }
  }
  return false;
}

function providerUrls({ provider, lat, lng, label, mode = 'drive', origin }: LaunchArgs): string[] {
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
