import type { Region } from 'react-native-maps';

export const MAP_SPIKE_MARKER_COUNT = 3000;

export const MELBOURNE_CBD_REGION: Region = {
  latitude: -37.8136,
  longitude: 144.9631,
  latitudeDelta: 0.11,
  longitudeDelta: 0.11,
};

export const MAP_SPIKE_BOUNDS = {
  minLatitude: -37.875,
  maxLatitude: -37.755,
  minLongitude: 144.89,
  maxLongitude: 145.04,
} as const;

export const CLUSTER_RADIUS = 40;

export const AUTO_STAGE_RUN = false;

export const AUTO_STAGE_DURATION_MS = 12000;

export const PAN_TARGET_REGION: Region = {
  latitude: -37.828,
  longitude: 144.985,
  latitudeDelta: 0.055,
  longitudeDelta: 0.055,
};
