import { MAP_SPIKE_BOUNDS, MAP_SPIKE_MARKER_COUNT } from './mapSpikeConfig';

export type MockMarkerStatus = 'good' | 'caution' | 'avoid' | 'unknown';

export type MockMarker = {
  id: string;
  latitude: number;
  longitude: number;
  status: MockMarkerStatus;
};

const statuses: MockMarkerStatus[] = ['good', 'caution', 'avoid', 'unknown'];

function createSeededRandom(seed: number) {
  let value = seed;

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function lerp(min: number, max: number, ratio: number) {
  return min + (max - min) * ratio;
}

export function createMockMarkers(count = MAP_SPIKE_MARKER_COUNT): MockMarker[] {
  const random = createSeededRandom(20260515);

  return Array.from({ length: count }, (_, index) => ({
    id: `mock-bay-${index + 1}`,
    latitude: lerp(MAP_SPIKE_BOUNDS.minLatitude, MAP_SPIKE_BOUNDS.maxLatitude, random()),
    longitude: lerp(MAP_SPIKE_BOUNDS.minLongitude, MAP_SPIKE_BOUNDS.maxLongitude, random()),
    status: statuses[index % statuses.length],
  }));
}

export const MOCK_MARKERS = createMockMarkers();
