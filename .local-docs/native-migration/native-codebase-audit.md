# Native Codebase Audit — Phase 0.1

> **Round of revision — Android-only scope (2026-05-12):** Audit findings
> unchanged — web→native portability is platform-agnostic. Dependency
> catalogue trimmed: iOS-only native equivalents (Apple Maps SDK, iOS
> safe-area APIs, etc.) removed; Android-only equivalents retained and
> tightened.

> **Audit scope:** Android-only deployment. Components and hooks classify
> identically for any target; the native-equivalent column lists Android
> targets only.

> Scope: classify every component in `frontend/src/components/` and every
> hook in `frontend/src/hooks/` by **portability** to a native frontend.
> Catalogue every web-specific dependency. Estimate per-framework code reuse.
> Backend is **out of scope** and stays as-is (FastAPI on DigitalOcean).
>
> **No implementation in this iteration.** This is a classification doc that
> feeds `docs/native-framework-decision.md`.

---

## Classification rubric

| Tier | Meaning |
|---|---|
| **Portable** | Pure logic, framework-neutral, or React patterns with no DOM/web API dependency. Lift the file with import path edits at most. |
| **Adapt** | Component pattern survives, but Tailwind classes, web-only DOM (`div`/`button`), web events, or web-only refs must be swapped for native primitives (`<View>`/`<Pressable>` in RN, `Container`/`GestureDetector` in Flutter). Logic and structure preserved. |
| **Replace** | Web-only behavior at the core. Library swap, full rewrite, or different design pattern required. Includes anything depending on Leaflet, `window.open`, `localStorage`, web bottom-sheet gesture math, CSS `env(safe-area-inset-*)`, fixed-position chrome, or DOM-keyboard interactions. |

Code reuse estimate is the share of the **file's lines** (or its semantic
content for tests) that survive untouched into the native codebase. For
"Adapt" rows the estimate is post-rewrite of the view layer — i.e. the
**logic** that can be lifted.

---

## Components — classification

| File | LOC | Tier | Native equivalent / notes |
|---|---:|---|---|
| `common/LogoMark.jsx` | 38 | Adapt | Re-implement as `<Image source={…}>` or vector (SVG → `react-native-svg`). Asset already exists as PNG; vector preferred. |
| `layout/BottomSheet.jsx` | 160 | **Replace** | Custom drag/snap math built on DOM events + transforms. Replace with `@gorhom/bottom-sheet` (RN) or `DraggableScrollableSheet` (Flutter). Snap heights (15dvh / 50dvh / 75dvh) translate directly to library snap points. |
| `layout/TopBar.jsx` | 191 | Replace | Web-only chrome. Round 3+4 already deprecated this on mobile; native uses `Stack.Navigator` header on tablet/desktop only. |
| `layout/SiteFooter.jsx` | 124 | Replace | Web-only marketing footer. Out of MVP — native app has no equivalent surface. |
| `nav/BottomTabBar.jsx` | 86 | Replace | Re-implement with `@react-navigation/bottom-tabs` (RN) or `BottomNavigationBar` (Flutter). Same two tabs, same SVG icons. The 56px + safe-area-inset math is built into the library. |
| `search/ChromeSearchBar.jsx` | 337 | Replace | Position-fixed top bar, keyboard handling, autocomplete dropdown, DOM focus. Rebuild on `react-native-paper` `Searchbar` or custom `TextInput` + `KeyboardAvoidingView`. Logic for suggestion fetching is portable. |
| `search/SearchBar.jsx` | 238 | Replace | Same constraints as `ChromeSearchBar`. The fetch/abort/debounce logic is reusable. |
| `map/MapPage.jsx` | **1422** | Adapt | Orchestrator. Most state coordination is portable; remove Leaflet bindings, swap web sheet for native sheet, swap web search bar for native, swap `window.open` for `Linking`. Heavy refactor — but the **shape** of state survives. |
| `map/ParkingMap.jsx` | 755 | **Replace** | Leaflet-specific: `react-leaflet`, vector grid layer, DOM markers, viewport CSS. Rewrite on `react-native-maps` (Google/Apple provider) or `mapbox/maps-flutter`. Marker clustering needs replacement library (e.g. `react-native-map-clustering` or supercluster + custom). |
| `map/OnboardingOverlay.jsx` | 203 | Adapt | Overlay logic + step state portable. CSS blur, fixed positioning, `animate-pulse-ring` Tailwind class → `expo-blur` + `Animated`/`Reanimated`, or Flutter `BackdropFilter` + `AnimationController`. Must respect `useReducedMotion` equivalent (`AccessibilityInfo.isReduceMotionEnabled`). |
| `map/ParkingAlertBanner.jsx` | 226 | Adapt | Banner is structural; logic portable. View layer swap only. |
| `map/ParkingForecastPanel.jsx` | 252 | Adapt | Panel structure + computed display logic portable; view swap. |
| `bay/BayDetailSheet.jsx` | (large) | Adapt | Body content + verdict/limit/translator/nav-actions composition is structural. Sheet container becomes a `BottomSheetView`. Focus trap (`listFocusable`) becomes platform-native accessibility focus. |
| `bay/BayDetailNavActions.jsx` | — | Adapt | Component structure portable. `window.open` and hidden-iframe deep-link trick → `Linking.openURL` + `canOpenURL`. Native gives a real "did it open" signal — the heuristic 300 ms timeout from Epic 7 becomes obsolete (acknowledged tightening). |
| `bay/HeroVerdict.jsx`, `ParkingVerdictPanel.jsx`, `VerdictCard.jsx`, `BayCard.jsx`, `BayList.jsx`, `BayStatusAndLimits.jsx`, `ConstraintChips.jsx`, `ProofRows.jsx`, `TimelineStrip.jsx`, `ParkingSignTranslator.jsx` | — | Adapt | Read-only / display components. Tailwind → native styling layer. **Structure 100% portable.** |
| `bay/*.test.jsx` | — | Replace | RTL/jsdom tests are web-only. Rewrite under `@testing-library/react-native` or Flutter's widget test framework. Assertion intent (what is rendered) carries over. |
| `busyNow/BusyNowPanel.jsx`, `EventBadge.jsx` | — | Adapt | Display logic portable; view swap. |
| `busyNow/BusyNowVectorLayer.jsx` (208) + `loadVectorGrid.js` + `segmentPopupDom.js` | — | **Replace** | `leaflet.vectorgrid` is Leaflet-only. Vector segments must move to native map layer (`react-native-maps-tile-overlay`, `MapboxGL.VectorSource`, or custom rendering). Highest-risk replacement after the base map. |
| `busyNow/BusyNowTrendMarkers.jsx` | — | Adapt | Marker placement logic portable; rendering primitive swaps. |
| `busyNow/SegmentPopup.jsx` (134) + `segmentPopupDom.js` | — | Replace | DOM-rendered popup tied to Leaflet markers. Re-author as a callout/marker tap → bottom sheet on native. |
| `predictions/PredictionsPage.jsx` (1070) | — | Adapt | Charts + lists. Tailwind → native styling. SVG/Canvas charts → `victory-native` or `fl_chart`. Data hooks portable. Heavy work, low risk. |
| `feedback/FilterChips.jsx` (174) | — | Adapt | Chip layout + selection state portable. Tailwind classes → styled components. |
| `feedback/TrapToast.jsx` (50) | — | Adapt | Toast → platform toast (`react-native-toast-message`) or in-app banner; logic portable. |
| `help/HelpModal.jsx` (255) | — | Adapt | Modal → native modal (`Modal` component on RN; `showModalBottomSheet` on Flutter). Content portable. |
| `home/HomePage.jsx` (223), `AboutPage.jsx` (166) | — | Adapt | Static informational pages. Direct view-layer port. Likely **out of MVP** (handled inside Settings sheet → About). |
| `legal/AttributionPage.jsx`, `legal/TermsPage.jsx` | — | Adapt | Static text screens. Trivial port. Could also be hosted webpages opened in `WebView`. |
| `maps/MapsProviderChooser.jsx` (229) | — | Adapt | Modal pattern lifts; `Linking.canOpenURL` replaces the iframe scheme-detection trick. Logic improves on native. |
| `maps/launchMaps.js` | — | **Replace** | `window.open` + hidden iframe timeout heuristic — native equivalent is `Linking.openURL` + `canOpenURL`. Drops the heuristic; tightens behavior. |
| `settings/SettingsSheet.jsx` (245) | — | Adapt | Sheet container → native bottom sheet; rows are structural. |
| `settings/MapsProviderSettingRow.jsx` (68) | — | Adapt | Trivial row. View swap. |
| `nav/BottomTabBar.jsx` | 86 | Replace | (Listed above for completeness.) |
| `SiteGate.jsx` | — | Adapt or drop | If purpose is an age/region gate, port as a native modal on first launch. May be out of MVP. |
| `predictions/PredictionsPage.jsx` | 1070 | Adapt | (see above) |

**Aggregate over all source components:** ~14% Replace by LOC (Leaflet, web sheet, search-bar chrome, tab bar, footer, top bar, vector layer, segment popup DOM, web launchMaps), ~78% Adapt (view-layer swap with logic preserved), ~8% Portable (icons + pure-display).

---

## Hooks — classification

| File | LOC | Tier | Notes |
|---|---:|---|---|
| `useAccessibility.js` | 26 | **Portable** | Reads/writes `localStorage` accessibility flag. Replace storage backend with `AsyncStorage`/`MMKV` (RN) or `SharedPreferences`/`shared_preferences` (Flutter). Otherwise lift verbatim. |
| `useBays.js` | 59 | **Portable** | `fetch`/state machine for `/api/parking`. Standard fetch survives. |
| `useBusyNow.js` | 74 | **Portable** | Fetch + state. Lift verbatim. |
| `useBusyNow.test.js` | 53 | Replace | jsdom test → native test framework. |
| `useClock.js` | 17 | **Portable** | `setInterval` ticker. Verbatim. |
| `useDarkMode.js` | 59 | Adapt | `localStorage` + `matchMedia('(prefers-color-scheme: dark)')`. Replace with platform preference (`useColorScheme` in RN; `MediaQuery.platformBrightnessOf` in Flutter) and `AsyncStorage` for override. |
| `useDebouncedPlannerParams.js` | 27 | **Portable** | Pure debounce on state. Verbatim. |
| `useDebouncedValue.js` | 12 | **Portable** | Verbatim. |
| `useMapState.js` | 268 | **Portable** | Map state machine (destination, planner mode, bbox). No Leaflet dependency in the hook itself — viewport state is data, not DOM. Verbatim. |
| `useMapState.test.js` | 44 | Replace | Test runner swap. |
| `useMapsProvider.js` | 66 | Adapt | `localStorage` → `AsyncStorage`. Logic identical. |
| `useMapsProvider.test.js` | 61 | Replace | Test runner swap. |
| `useParkingForecast.js` | 71 | **Portable** | Fetch + memo. Verbatim. |
| `useQuietestSegments.js` | 57 | **Portable** | Pure derived state. Verbatim. |
| `useQuietestSegments.test.js` | 114 | Replace | Test runner swap. |
| `useReducedMotion.js` | 17 | Adapt | `matchMedia('(prefers-reduced-motion)')` → `AccessibilityInfo.isReduceMotionEnabled` (RN) / `MediaQuery.disableAnimationsOf` (Flutter). One-line behavior swap; same API surface. |
| `useRouteAnimation.js` | 195 | **Replace** | Built on web `requestAnimationFrame` + DOM. Re-author on `Animated`/`Reanimated` (RN) or `AnimationController` (Flutter). |

**Aggregate over hooks:** ~9 of 17 fully portable verbatim; 4 Adapt (storage / media-query swap, same shape); `useRouteAnimation` is the only true rewrite. Hooks layer is the strongest portability win.

---

## Web-specific dependencies in `frontend/package.json` (Android targets only)

| Package | Web role | Android native equivalent — React Native / Expo | Android native equivalent — Flutter |
|---|---|---|---|
| `leaflet` | Map renderer | `react-native-maps` (Google provider) **or** `@rnmapbox/maps` (Mapbox) | `google_maps_flutter` **or** `mapbox_maps_flutter` |
| `react-leaflet` | React bindings for Leaflet | (subsumed into `react-native-maps`) | (subsumed) |
| `leaflet.vectorgrid` | Vector tiles for BusyNow segments | `react-native-maps` tile overlay + custom fetch, **or** `@rnmapbox/maps` vector source | Mapbox vector source (only viable option for parity) |
| `react-window` | Virtualized list (PredictionsPage) | `FlatList` (built in — automatic windowing) | `ListView.builder` (built in) |
| `tailwindcss` + `tailwind-merge` | Utility CSS | `NativeWind` (Tailwind on RN) or `Restyle` / `tamagui` | Built-in `ThemeData` + custom widget |
| `clsx` | className composition | Same (still useful with NativeWind), or drop | Drop |
| `react` / `react-dom` | Runtime | `react` + `react-native` | (Dart; full replacement) |
| `vite` / `@vitejs/plugin-react` | Build | `metro` (RN default), `eas build` (Expo) — Android target only | `flutter build apk`/`appbundle` |
| `vitest` / `@testing-library/react` | Tests | `jest` + `@testing-library/react-native` | `flutter_test` |

**Web-only browser APIs used inside source (not in package.json):**

- `window.open(url, '_blank', 'noopener')` — `frontend/src/components/predictions/PredictionsPage.jsx:369–372`, `frontend/src/components/maps/launchMaps.js`. Android native: `Linking.openURL` (RN) / `url_launcher` (Flutter) → Android Intent.
- `document.hidden` heuristic for native-scheme launch detection (`launchMaps.js`). Android native: `Linking.canOpenURL` returns true/false reliably for installed packages; drop the heuristic.
- `localStorage` — `useAccessibility.js`, `useDarkMode.js`, `useMapsProvider.js`. Android native: `@react-native-async-storage/async-storage` or `react-native-mmkv` (RN/Expo); `shared_preferences` (Flutter).
- `matchMedia('(prefers-color-scheme: dark)')` and `'(prefers-reduced-motion)'` — `useDarkMode.js`, `useReducedMotion.js`. Android native: `Appearance.getColorScheme` + `AccessibilityInfo.isReduceMotionEnabled` (RN); `MediaQuery.platformBrightnessOf` + `disableAnimationsOf` (Flutter).
- `env(safe-area-inset-top/bottom)` CSS — search bar, tab bar, scope strip. Android native: `react-native-safe-area-context` (handles Android display cutout API + gesture-nav bar inset).
- `position: fixed` + `z-index` overlays — search bar (z-1000), settings sheet (z-570), tab bar (z-490). Android native: bottom-sheet library handles stacking; tab bar is a `BottomTabNavigator` slot.
- DOM `focus`/`blur` + `tabIndex` focus traps (`BayDetailSheet`). Android native: TalkBack focus order via `accessibilityViewIsModal` + `importantForAccessibility` flags.
- `requestAnimationFrame` + CSS transforms in `useRouteAnimation`. Android native: `Animated` / `Reanimated` worklets (RN), or `AnimationController` (Flutter).
- `iframe` deep-link heuristic in `launchMaps.js`. Android native: drop; `Linking.canOpenURL('comgooglemaps://')` is the supported check. Also: Android Intents with `Intent.ACTION_VIEW` + `google.navigation:` URI route directly to Google Maps without a heuristic.

**Backend gap surfaced by this audit (no backend change planned this iteration):**

- No push-notification token endpoint exists. If Phase 3 of the native plan includes push (e.g. arrival-window reminders, trap-warning alerts) via **FCM (Firebase Cloud Messaging)** on Android, backend needs a `POST /api/devices/register` storing an FCM registration token. **Flagged only — not planned here.**

---

## Code-reuse estimates per candidate framework

Estimates are **dev-effort reuse**, weighted by component LOC × portability tier. They are not promises — they're the planning band a reviewer can challenge.

| Framework | Estimated reuse (logic + tests) | Estimated reuse (UI/view layer) | Net first-cut estimate |
|---|---|---|---|
| **True native** (Swift + Kotlin, two codebases) | ~10–15% (only data shapes, API contracts, business rules transcribed by hand) | 0% | **~10%** |
| **React Native (bare)** | ~65–75% (all `Portable` hooks verbatim; `Adapt` hooks one-line swap; data layer reused) | ~25–40% (component **shape** carries; styling rewritten via NativeWind/Restyle) | **~55–65%** |
| **Expo (managed React Native)** | Same as bare RN | Same as bare RN | **~55–65%**, with **higher tooling reuse** (config-driven, EAS Build, OTA). |
| **Flutter** | ~10–20% (logic shape transcribed to Dart by hand; tests rewritten in `flutter_test`) | 0% (no JSX → Dart widget mapping) | **~10–20%** |

**Caveats:**

- The `Adapt` tier is the largest bucket; reuse here is **structure**, not **lines**. A senior dev rewrites the view layer faster because the layout, state model, and accessibility behavior are already designed and verified — but the LOC of the new file is mostly new.
- Reuse percentages do not include time spent on **native-only** capabilities (Phase 3: haptics, deep-link IN, permissions). That work is additive on every option.
- True-native carries duplicated UI work across iOS and Android. The 10% figure assumes the team does iOS and Android sequentially with shared design and API contracts.
- Flutter's 10–20% reflects that even shared business rules must be re-coded in Dart; no JS reuse.

---

## Highest-risk replacements (carried into framework decision)

1. **Map renderer + ~3000 markers.** Leaflet's vector grid layer is performant on web; native parity requires Mapbox or a heavily tuned `react-native-maps` clustering setup. Performance budget for 3000 markers on mid-tier Android is the single biggest unknown.
2. **BusyNow vector segments.** Tied to Leaflet vector grid. Mapbox is the cleanest equivalent; `react-native-maps` requires custom tile overlay work. Risk: parity may force a Mapbox dependency, which carries pricing and SDK-size impact.
3. **Bottom sheet.** `@gorhom/bottom-sheet` (RN) reaches feature parity (snap points, gestures, animation). Flutter `DraggableScrollableSheet` is leaner; advanced behaviors (e.g. "sheet covers tab bar at SNAP_FULL") need custom Z stacking.
4. **Tab bar interaction with sheet.** Round 4 spec requires sheet to **cover** tab bar at SNAP_FULL. Library-default tab bars don't have a sheet-overlay mode — needs a custom stack-and-hide controller in either framework.
5. **Onboarding pulse-ring + search bar real-control.** Round 3 fidelity ("user learns the real control") requires the search bar to be the same instance during onboarding, with a pulsing focus ring. Doable on both frameworks; needs an `Animated` ring + reduced-motion guard.

---

## Carry-forward into the framework decision

- The hooks layer is largely framework-neutral. **React Native preserves it nearly intact.** Flutter discards it.
- The component layer is mostly `Adapt`, not `Replace`. RN/Expo keep component **shapes** and JSX patterns; Flutter rewrites them in Dart.
- The biggest absolute rewrite is `ParkingMap.jsx` + `BusyNowVectorLayer.jsx` regardless of framework — map work is hard everywhere.
- Backend is untouched. All API contracts and JSON shapes flow through unchanged.
