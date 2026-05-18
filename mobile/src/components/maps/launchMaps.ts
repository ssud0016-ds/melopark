import * as Linking from 'expo-linking';

import type { MapsProvider } from '../../hooks/useMapsProvider';

type LaunchArgs = {
  provider: MapsProvider | null;
  lat: number;
  lng: number;
  label?: string;
  travelMode?: 'driving' | 'walking';
};

// Plan §4.7 Linking-based provider chooser (replaces web iframe trick).
// Falls back to web Google Maps if native handler not installed.
export async function launchMaps({
  provider,
  lat,
  lng,
  label,
  travelMode,
}: LaunchArgs): Promise<boolean> {
  const candidates = providerUrls({ provider, lat, lng, label, travelMode });
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

function providerUrls({ provider, lat, lng, label, travelMode = 'driving' }: LaunchArgs): string[] {
  const enc = (s?: string) => (s ? encodeURIComponent(s) : '');
  const googleMode = travelMode === 'walking' ? '&mode=w' : '';
  const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
    label ? `&destination_place_id=${enc(label)}` : ''
  }&travelmode=${travelMode}`;

  switch (provider) {
    case 'google':
      return [
        `google.navigation:q=${lat},${lng}${googleMode}`,
        `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${enc(label)})` : ''}`,
        web,
      ];
    case 'web':
      return [web];
    default:
      return [`geo:${lat},${lng}?q=${lat},${lng}`, web];
  }
}
