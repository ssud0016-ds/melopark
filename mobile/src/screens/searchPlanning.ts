import type { Bay } from '../services/apiBays';

export type DestinationResult = {
  kind: 'destination';
  id: string;
  label: string;
  lat: number;
  lng: number;
  bayCount: number;
};

export type BayResult = { kind: 'bay'; bay: Bay };
export type SearchResult = DestinationResult | BayResult;

const MAX_STREET_RESULTS = 8;
const MAX_BAY_RESULTS = 50;

export function buildSearchResults(bays: Bay[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const byStreet = new Map<string, Bay[]>();
  const bayResults: BayResult[] = [];

  for (const bay of bays) {
    const name = bay.name?.trim();
    const idMatch = bay.id.toLowerCase().includes(q);
    const nameMatch = Boolean(name?.toLowerCase().includes(q));

    if (name && nameMatch) {
      const key = name.toLowerCase();
      const list = byStreet.get(key) ?? [];
      list.push(bay);
      byStreet.set(key, list);
    }

    if ((idMatch || nameMatch) && bayResults.length < MAX_BAY_RESULTS) {
      bayResults.push({ kind: 'bay', bay });
    }
  }

  const destinationResults = Array.from(byStreet.entries())
    .map(([key, streetBays]) => {
      const lat = streetBays.reduce((sum, bay) => sum + bay.lat, 0) / streetBays.length;
      const lng = streetBays.reduce((sum, bay) => sum + bay.lng, 0) / streetBays.length;
      return {
        kind: 'destination' as const,
        id: `street:${key}`,
        label: streetBays[0]?.name ?? key,
        lat,
        lng,
        bayCount: streetBays.length,
      };
    })
    .sort((a, b) => b.bayCount - a.bayCount)
    .slice(0, MAX_STREET_RESULTS);

  return [...destinationResults, ...bayResults];
}

export function nearestBayIds(
  bays: Bay[],
  destination: { lat: number; lng: number } | null,
  limit = 8,
): string[] {
  if (!destination) return [];
  return bays
    .map((bay) => ({
      id: bay.id,
      distance:
        (bay.lat - destination.lat) * (bay.lat - destination.lat) +
        (bay.lng - destination.lng) * (bay.lng - destination.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => item.id);
}
