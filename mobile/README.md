# MelOPark Mobile

Expo React Native Android app for MelOPark.

## Commands

```sh
npm run android
npm run typecheck
npm test -- --runInBand
```

## Production Map

The Phase 2 map implementation is closed: the production mobile map provider is
`@rnmapbox/maps`.

- `mobile/src/components/maps/ParkingMap.tsx` renders bay points and clusters with Mapbox `ShapeSource` layers.
- `mobile/src/components/maps/BusyNowLayer.tsx` renders BusyNow MVT vector tiles with Mapbox `VectorSource`.
- The old `react-native-maps` spike is archived under `mobile/src/spikes/map/` for historical notes only. It is not registered in navigation and is not user-accessible.

Required environment:

- `MAPBOX_PUBLIC_TOKEN` for runtime map tiles.
- `MAPBOX_DOWNLOAD_TOKEN` for native Mapbox SDK dependency resolution during prebuild/build.
