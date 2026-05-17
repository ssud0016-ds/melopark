import {
  MAP_SPIKE_BOUNDS,
  MAP_SPIKE_POLYLINE_COUNT,
  MAP_SPIKE_POLYLINE_NODES,
  MAP_SPIKE_POLYLINE_SPAN,
} from './mapSpikeConfig';

export type MockPolylineStatus = 'good' | 'caution' | 'avoid';

export type MockPolyline = {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  status: MockPolylineStatus;
};

const statuses: MockPolylineStatus[] = ['good', 'caution', 'avoid'];

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

export function createMockPolylines(count = MAP_SPIKE_POLYLINE_COUNT): MockPolyline[] {
  const random = createSeededRandom(20260516);

  return Array.from({ length: count }, (_, index) => {
    const originLat = lerp(MAP_SPIKE_BOUNDS.minLatitude, MAP_SPIKE_BOUNDS.maxLatitude, random());
    const originLon = lerp(MAP_SPIKE_BOUNDS.minLongitude, MAP_SPIKE_BOUNDS.maxLongitude, random());

    // Random-walk a short street-segment approximation.
    const coordinates = Array.from({ length: MAP_SPIKE_POLYLINE_NODES }, (_, node) => {
      const t = node / (MAP_SPIKE_POLYLINE_NODES - 1);
      const jitterLat = (random() - 0.5) * MAP_SPIKE_POLYLINE_SPAN;
      const jitterLon = (random() - 0.5) * MAP_SPIKE_POLYLINE_SPAN;
      return {
        latitude: originLat + jitterLat * t,
        longitude: originLon + jitterLon * t,
      };
    });

    return {
      id: `mock-segment-${index + 1}`,
      coordinates,
      status: statuses[index % statuses.length],
    };
  });
}

export const MOCK_POLYLINES = createMockPolylines();
