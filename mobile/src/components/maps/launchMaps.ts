import * as Linking from 'expo-linking';

import type { MapsProvider } from '../../hooks/useMapsProvider';

type LaunchArgs = {
  provider: MapsProvider | null;
  lat: number;
  lng: number;
  label?: string;
};

// Plan §4.7 Linking-based provider chooser (replaces web iframe trick).
// Falls back to web Google Maps if native handler not installed.
export async function launchMaps({ provider, lat, lng, label }: LaunchArgs): Promise<boolean> {
  const candidates = providerUrls({ provider, lat, lng, label });
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

function providerUrls({ provider, lat, lng, label }: LaunchArgs): string[] {
  const enc = (s?: string) => (s ? encodeURIComponent(s) : '');
  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
    label ? `&destination_place_id=${enc(label)}` : ''
  }`;

  switch (provider) {
    case 'google':
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
