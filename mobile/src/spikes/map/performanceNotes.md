# Map Spike Performance Notes

Scope: isolated `react-native-maps` spike under `mobile/src/spikes/map/`.

No production map code, web map code, Leaflet, vectorgrid, or backend API integration is included.

## Stages

1. Map only
2. Raw markers, 3000 deterministic mock points
3. Clustered markers, same 3000 deterministic mock points

## Observations

Environment:

- Emulator: `Medium_Phone_API_36.1`
- Expo URL opened successfully on port `8083`
- Bundle: Android, 1211 modules, bundled in 13157ms

Stage results:

| Stage | Marker count | Result | JS settled log | Notes |
|---|---:|---|---:|---|
| Map only | 0 | PASS | 18ms | Map reached `map ready`; camera animation requested. |
| Raw markers | 3000 | PASS | 4019ms | Map reached `map ready`; simple custom dot markers rendered; camera animation requested. |
| Clustered markers | 3000 | PASS with concern | 9619ms | Map reached `map ready`; cluster setup was slower than raw markers in this run. |

Initial conclusion:

- `react-native-maps` can boot and render the isolated 3000-marker mock dataset on the Android emulator without crashing.
- Raw marker rendering is viable enough to continue the spike.
- `react-native-map-clustering` did not fail, but its initial JS settle time was worse than raw markers in this run. It should not be assumed to be the default path without more profiling on a physical mid-range Android device.
