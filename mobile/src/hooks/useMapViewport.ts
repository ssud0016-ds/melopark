import { useCallback, useMemo, useState } from 'react';
import type { Bay } from '../services/apiBays';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };
export type Destination = { lat: number; lng: number };

export const MELBOURNE_CBD_REGION: Region = {
  latitude: -37.8136,
  longitude: 144.9631,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

// 1.5x viewport pad keeps neighbouring bays mounted so pan doesn't pop.
const PAD = 0.5;

function regionToPaddedBounds(region: Region): Bounds {
  const latPad = region.latitudeDelta * PAD;
  const lngPad = region.longitudeDelta * PAD;
  return {
    minLat: region.latitude - region.latitudeDelta / 2 - latPad,
    maxLat: region.latitude + region.latitudeDelta / 2 + latPad,
    minLng: region.longitude - region.longitudeDelta / 2 - lngPad,
    maxLng: region.longitude + region.longitudeDelta / 2 + lngPad,
  };
}

export function destinationToBounds(destination: Destination, radiusDegrees = 0.006): Bounds {
  return {
    minLat: destination.lat - radiusDegrees,
    maxLat: destination.lat + radiusDegrees,
    minLng: destination.lng - radiusDegrees,
    maxLng: destination.lng + radiusDegrees,
  };
}

export function boundsToBbox(bounds: Bounds) {
  return `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`;
}

// Plan 2.A constraint #2: viewport culling.
// Decoupled from ClusteredMapView's onRegionChangeComplete so the lib's
// internal re-cluster fires correctly. Screen tracks region, culls bays,
// passes filtered array to ParkingMap as a stable prop.
export function useMapViewport(initial: Region = MELBOURNE_CBD_REGION) {
  const [region, setRegion] = useState<Region>(initial);

  const bounds = useMemo(() => regionToPaddedBounds(region), [region]);

  const cullToViewport = useCallback(
    (bays: Bay[]): Bay[] => {
      return bays.filter(
        (b) =>
          b.lat >= bounds.minLat &&
          b.lat <= bounds.maxLat &&
          b.lng >= bounds.minLng &&
          b.lng <= bounds.maxLng,
      );
    },
    [bounds],
  );

  return { region, setRegion, bounds, cullToViewport };
}
