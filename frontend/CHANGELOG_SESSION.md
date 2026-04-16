# MeloPark UI Session Changelog

Date: 2026-04-15

This file documents all requested UI/design updates completed in this session.

## 1) Map + Clustering

- Implemented zoom-dependent clustering for bays with `available/total` labels.
- Kept clusters visible until deeper zoom-in levels; switched to per-bay markers when zoomed in.
- Improved cluster grouping to intersection-like scale and corrected count logic for live data.
- Updated cluster colors:
  - all available: green
  - all occupied: red
  - all trap: coral
  - mixed clusters: light blue (day), dark blue (night)
- Tuned cluster text sizing so labels stay inside the circle.

## 2) Filter + Legend

- Simplified filters in map UI to `All bays` + `Available` in requested states.
- Removed emoji from Available filter label.
- Updated behavior so `Available` filter removes non-available (red) bays completely.
- Updated Bay Status legend colors through requested iterations (available/trap/occupied).
- Added/kept `Has rule info` visual indicator in legend.

## 3) Bay Rule Info (Preserved + Integrated)

`hasRules` logic is preserved end-to-end and integrated into current design:

- Data mapping:
  - `frontend/src/services/apiBays.js`
  - `hasRules: !!record.has_restriction_data`
- Map markers:
  - `frontend/src/components/map/ParkingMap.jsx`
  - rule-info bays have distinct ring styling
- Bay list:
  - `frontend/src/components/bay/BayList.jsx`
  - sorts rule-info bays first, and shows rule-aware count text
- Bay cards:
  - `frontend/src/components/bay/BayCard.jsx`
  - shows `Has Rules` chip when applicable
- Bay detail:
  - `frontend/src/components/bay/BayDetailSheet.jsx`
  - includes explicit `Has rule info` / `No rule info` chip and no-data guidance
- Filtering support:
  - `frontend/src/hooks/useMapState.js`
  - includes `hasRules` filter logic

## 4) Header + Navigation

- Reworked header with centered navigation labels (`Live Map`, `About Us`).
- Styled `Live Map` and `About Us` per iterative feedback (fill/no-fill, active-state fill, border removals).
- Made `Live Map` button navigate back to map view.
- Replaced old emoji theme control with a compact switch control and day/night icons.

## 5) Night Mode Styling

- Applied requested dark-mode UI palette updates to controls and overlays, then selectively reverted parts based on follow-up requests.
- Improved sun/moon icon contrast on dark header.
- Updated dark-mode cards/controls (search, zoom, badges, legend, pills) to requested blue tones where applicable.

## 6) Logo Iterations

- Integrated multiple provided logo assets as requested during iterations:
  - `MelOPark Logo.png`
  - `MelOParkLogo2.png`
  - `MelOParkLogo3.png`
  - `MelOParkLogoDark.png`
- Added light/dark logo swap behavior in header.
- Processed logo backgrounds for transparency as requested (including black-background removal attempts for dark logo).
- Preserved requested display size while swapping assets.

## 7) Overlay Collision Fixes

- Prevented map overlay overlap when right-side detail tab opens:
  - shifted top controls and corner cards left based on available width
  - hid `Updated` badge while detail tab is open
- Files:
  - `frontend/src/components/map/MapPage.jsx`

## 8) Session Output Artifacts

- Created this consolidated markdown changelog file:
  - `CHANGELOG_SESSION.md`

## 9) Verification

- Changes were validated with repeated `npm run build` checks.
- Edited files were lint-checked where appropriate.
