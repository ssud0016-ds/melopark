# Native Component Map — Phase 2

> **Stack:** Expo (managed RN) + NativeWind + Reanimated +
> `@gorhom/bottom-sheet` + `react-navigation` + `react-native-maps`
> (default per OQ-A1; switch to `@rnmapbox/maps` if 3-day spike fails).
> Android-only, minSdk 26.

> **Planning doc only. No code.** Phase 2 deliverable: this component
> map + acceptance criteria + 3-day map-spike plan.

---

## 1. Goal

For every component in `frontend/src/components/` and every hook in
`frontend/src/hooks/`, specify the native target file, the library it
depends on, props-contract deltas, Material-3 adaptations, and a risk
note. Output is the **per-component build plan** Phase 2A–2E developers
execute.

## 2. Scope

**In:**
- 1:1 web→native component map.
- Library choice per component.
- Hook port plan (most are verbatim).
- 3-day map performance spike protocol (`react-native-maps` vs `@rnmapbox/maps` decision gate).
- Phase 2 acceptance + review gate.

**Out:**
- Native-only capabilities (haptics wiring, permission flows, deep linking) — those go in `docs/native-capabilities.md` (Phase 3, not yet written).
- Store submission assets (Phase 4).
- Implementation code.

---

## 3. Project structure

```
mobile/src/
├── components/
│   ├── bay/                 # BayDetailSheet + verdict children
│   ├── busyNow/             # vector layer + panels
│   ├── common/              # LogoMark, Screen wrapper, Pressable wrappers
│   ├── feedback/            # FilterChips, TrapToast
│   ├── help/                # HelpModal (now sheet)
│   ├── home/                # AboutPage, HomePage (deferred — out of MVP-mobile)
│   ├── legal/               # AttributionPage, TermsPage
│   ├── map/                 # MapScreen, ParkingMap, OnboardingOverlay, ParkingAlertBanner, ParkingForecastPanel
│   ├── maps/                # MapsProviderChooser, launchMaps
│   ├── nav/                 # BottomTabBar (now @react-navigation/bottom-tabs)
│   ├── predictions/         # PredictionsScreen + children
│   ├── search/              # SearchBar, ChromeSearchBar
│   └── settings/            # SettingsSheet, MapsProviderSettingRow
├── hooks/                   # mirrors frontend/src/hooks/
├── navigation/
│   ├── RootNavigator.tsx    # NavigationContainer + linking config (App Links)
│   └── BottomTabs.tsx       # BottomTabNavigator with Map + Predictions
├── design-system/           # (Phase 1)
└── services/
    └── apiBays.ts           # port of frontend/src/services/apiBays.js — fetch URLs unchanged
```

---

## 4. Migration map — components

Format: **web file → native file | library | props delta | platform note | risk**.

### 4.1 Layout + chrome

| Web file (LOC) | Native target | Library | Props delta | Note | Risk |
|---|---|---|---|---|---|
| `layout/BottomSheet.jsx` (160) | **delete** (replaced by `@gorhom/bottom-sheet` directly) | `@gorhom/bottom-sheet@^4` | n/a — consumers use library API | Snap points `['15%','50%','75%']`. Configure `enableContentPanningGesture` so vertical drag wins; Android system back-gesture (horizontal edge-swipe) unaffected. | Medium — sheet covers tab bar at SNAP_FULL requires `zIndex` stacking outside library defaults (see §7) |
| `layout/TopBar.jsx` (191) | **drop** — round 3+4 removed it on mobile | — | — | Tablet support (>= 600dp) re-introduces it later; out of v1 MVP | Low — already deprecated by round 4 |
| `layout/SiteFooter.jsx` (124) | **drop** — web-marketing surface, not in native app | — | — | — | Low |
| `nav/BottomTabBar.jsx` (86) | `nav/BottomTabs.tsx` | `@react-navigation/bottom-tabs@^6` | `activePage`/`onNavigate` props vanish — navigation state owned by `react-navigation` | Tab bar height override → **56** (OQ-A5). Active indicator pill **disabled** (Material 3 default on); replace with brand-color + filled-icon dual signal per round 4. `tabBarStyle.height = 56 + insets.bottom`. Use `tabBarBackground` custom component for Material elevation. | Low — library is the standard pattern |
| `search/ChromeSearchBar.jsx` (337) | `search/ChromeSearchBar.tsx` | `react-native` `TextInput` + custom + `react-native-safe-area-context` | `onSettingsTap`, `onClear` callbacks unchanged. Drop CSS `position: fixed` — wrap in `<View>` at top of `MapScreen` inside `<SafeAreaView edges={['top']}>`. | Status-bar translucent (edge-to-edge); inset padding applied by safe-area context. `keyboardType="default"`, `returnKeyType="search"`, `autoCorrect={false}`, `autoCapitalize="none"`. Settings cog opens `SettingsSheet` programmatically via ref. | Medium — keyboard inset math (StatusBar + IME) needs verification; use `KeyboardAvoidingView` or `react-native-keyboard-controller` |
| `search/SearchBar.jsx` (238) | `search/SearchBar.tsx` | same as above | — | Autocomplete dropdown rendered in absolute-positioned `<View>` with `elevation: 12` (overlay token). | Medium — Android IME `adjustResize` vs `adjustPan` window-soft-input-mode behavior; set in `app.json` |
| `common/LogoMark.jsx` (38) | `common/LogoMark.tsx` | `react-native-svg` | `variant: 'light'\|'dark'`, `size: number` | Imports SVG path from `assets/`; `fill` prop swaps per variant. | Low |
| **new** | `common/Screen.tsx` | — | `children`, `edges?: Edge[]` | Wraps every screen: `SafeAreaView` + `<View flex-1>` + status-bar style sync. New primitive (no web counterpart — replaces ad-hoc `min-h-[100dvh]`). | Low |
| **new** | `common/PressableRow.tsx` | — | `onPress`, `children`, `disabled?` | Native ripple via `android_ripple={{color: native-ripple-color}}`. Used by every list row, settings row, chooser row. | Low |

### 4.2 Map

| Web file (LOC) | Native target | Library | Props delta | Note | Risk |
|---|---|---|---|---|---|
| `map/MapPage.jsx` (1422) | `map/MapScreen.tsx` | composes everything below | Page-mode state (`activePage`) gone — `react-navigation` owns it. State machine **otherwise unchanged.** | Phase 2 plan: extract sub-orchestrators (~200 LOC each) — `MapState`, `MapControls`, `MapSheets`, `MapOverlays`. Long file to start; refactor later. | High — single largest port. Suggest pairing with the Phase 2 lead |
| `map/ParkingMap.jsx` (755) | `map/ParkingMap.tsx` | **default:** `react-native-maps` (Google provider) + `react-native-map-clustering`. **Fallback:** `@rnmapbox/maps`. Decision via spike §6. | `bays`, `onBaySelect`, `bbox`, `selectedBayId`, `destination` unchanged. New: `provider="google"`, `userInterfaceStyle` from theme. | ~3000 marker clustering via `react-native-map-clustering` (`radius={40}`). Bay markers: `<Marker>` with `tracksViewChanges={false}` (perf-critical). Tile layer: default Google. | **High** — clustering perf on mid-range Android is the unknown. 3-day spike gates this. |
| `map/OnboardingOverlay.jsx` (203) | `map/OnboardingOverlay.tsx` | Reanimated + `expo-blur` | `step`, `onSkip`, `onNext`, `onDone` unchanged | Blurred map background via `<BlurView intensity={20}>` over a `MapView` snapshot or live `MapView` (verify perf). Pulsing ring on real search bar via Reanimated `withRepeat`; reduced-motion guard skips to static ring. Step 0/2: full-screen `<Modal transparent>` at `zIndex: 800`. Step 1: prompt card via `@gorhom/bottom-sheet` anchored to `15%`. | Medium — blur perf on low-end Android |
| `map/ParkingAlertBanner.jsx` (226) | `map/ParkingAlertBanner.tsx` | NativeWind only | unchanged | View swap only. | Low |
| `map/ParkingForecastPanel.jsx` (252) | `map/ParkingForecastPanel.tsx` | NativeWind | unchanged | View swap. | Low |

### 4.3 Bay detail

All retain props contracts verbatim; view-layer swap only.

| Web file | Native target | Library | Note | Risk |
|---|---|---|---|---|
| `bay/BayDetailSheet.jsx` | `bay/BayDetailSheet.tsx` | `@gorhom/bottom-sheet` `<BottomSheet>` + `<BottomSheetScrollView>` | Snap points `['25%','50%','85%']` per existing spec. Header drag handle = library default. Focus-trap web logic replaced by `accessibilityViewIsModal={true}` on Android. | Medium |
| `bay/BayDetailNavActions.jsx` | `bay/BayDetailNavActions.tsx` | uses `launchMaps` (new) | `Linking.canOpenURL` replaces iframe heuristic — drop 300ms timeout. Real "did it open" signal. | Low (improves on web) |
| `bay/HeroVerdict.jsx` | `bay/HeroVerdict.tsx` | NativeWind | view swap | Low |
| `bay/ParkingVerdictPanel.jsx` | `bay/ParkingVerdictPanel.tsx` | NativeWind | view swap | Low |
| `bay/VerdictCard.jsx` | `bay/VerdictCard.tsx` | NativeWind | view swap | Low |
| `bay/BayCard.jsx` | `bay/BayCard.tsx` | NativeWind | view swap | Low |
| `bay/BayList.jsx` | `bay/BayList.tsx` | `FlatList` | replaces `react-window` virtualization | Low — `FlatList` is built-in |
| `bay/BayStatusAndLimits.jsx` | `bay/BayStatusAndLimits.tsx` | NativeWind | view swap | Low |
| `bay/ConstraintChips.jsx` | `bay/ConstraintChips.tsx` | NativeWind | view swap | Low |
| `bay/ProofRows.jsx` | `bay/ProofRows.tsx` | NativeWind | view swap | Low |
| `bay/TimelineStrip.jsx` | `bay/TimelineStrip.tsx` | NativeWind + Reanimated | view swap + animation port | Low |
| `bay/ParkingSignTranslator.jsx` | `bay/ParkingSignTranslator.tsx` | NativeWind | view swap | Low |

### 4.4 BusyNow vector segments

| Web file | Native target | Library | Note | Risk |
|---|---|---|---|---|
| `busyNow/BusyNowVectorLayer.jsx` (208) | `busyNow/BusyNowVectorLayer.tsx` | **Spike-dependent:** `react-native-maps` `<Polyline>` per segment (initial) OR `<UrlTile>` with vector tile source OR `@rnmapbox/maps` `<VectorSource>` (preferred for parity) | Vector parity is the BusyNow-on-native risk. Spike day-2 evaluates polyline rendering at ~221 zones × multiple segments each. | **High** — same dependency as 4.2 map decision |
| `busyNow/BusyNowPanel.jsx` | `busyNow/BusyNowPanel.tsx` | NativeWind | view swap | Low |
| `busyNow/BusyNowTrendMarkers.jsx` | `busyNow/BusyNowTrendMarkers.tsx` | `react-native-maps` `<Marker>` or Mapbox `<SymbolLayer>` | tied to map library choice | Medium |
| `busyNow/EventBadge.jsx` | `busyNow/EventBadge.tsx` | NativeWind | view swap | Low |
| `busyNow/SegmentPopup.jsx` + `segmentPopupDom.js` | `busyNow/SegmentPopup.tsx` | `@gorhom/bottom-sheet` modal or `react-native-maps` `<Callout>` | DOM popup → either a Material 3 callout (tap-on-marker) or a bottom-sheet drill-in. **Recommend bottom-sheet** — Callouts on Android maps look dated and have layout constraints. | Medium |
| `busyNow/loadVectorGrid.js`, `segmentDetailFromApi.js` | port verbatim into `busyNow/segmentDetailFromApi.ts` | — | data layer only | Low |

### 4.5 Predictions

| Web file (LOC) | Native target | Library | Note | Risk |
|---|---|---|---|---|
| `predictions/PredictionsPage.jsx` (1070) | `predictions/PredictionsScreen.tsx` | `victory-native@^41` for charts | Bar chart, line chart, busiest list. `FlatList` replaces `react-window`. Datetime input → `@react-native-community/datetimepicker`. | Medium — `victory-native` v41 requires `react-native-skia`; verify EAS Build includes it cleanly |

### 4.6 Search

(See 4.1 row — same components.)

### 4.7 Settings + maps provider

| Web file | Native target | Library | Note | Risk |
|---|---|---|---|---|
| `settings/SettingsSheet.jsx` (245) | `settings/SettingsSheet.tsx` | `@gorhom/bottom-sheet` snap `['50%','85%']` | Rows use `PressableRow`. Theme chip toggle (Light/Dark/System) wired to `useDarkMode` port + `Appearance` API. Help link re-opens onboarding via `react-navigation` modal route. | Low |
| `settings/MapsProviderSettingRow.jsx` (68) | `settings/MapsProviderSettingRow.tsx` | uses `MapsProviderChooser` | unchanged props | Low |
| `maps/MapsProviderChooser.jsx` (229) | `maps/MapsProviderChooser.tsx` | `react-native` `<Modal transparent>` or `@gorhom/bottom-sheet` `<BottomSheetModal>` | Recommend `BottomSheetModal` — matches platform convention better than centered modal. `accessibilityViewIsModal={true}`. | Low |
| `maps/launchMaps.js` | `maps/launchMaps.ts` | `expo-linking` | Drop iframe + `document.hidden` heuristic. `Linking.canOpenURL('comgooglemaps://')` returns reliable boolean. Failure path: fall through to web URL + `Linking.openURL`. | Low (improves on web) |
| `maps/launchMaps.test.js` | `maps/launchMaps.test.ts` | `jest` + RN testing | reuse test cases; mock `Linking`. | Low |

### 4.8 Feedback + help

| Web file | Native target | Library | Note | Risk |
|---|---|---|---|---|
| `feedback/FilterChips.jsx` (174) | `feedback/FilterChips.tsx` | NativeWind | view swap | Low |
| `feedback/TrapToast.jsx` (50) | `feedback/TrapToast.tsx` | `react-native-toast-message` or custom Reanimated banner | Material Snackbar pattern preferred over Toast (positioned above tab bar). Recommend custom Reanimated banner anchored above tab bar. | Low |
| `help/HelpModal.jsx` (255) | replaced by Settings → Help → re-open onboarding | — | Web `HelpModal` was the round-3-deprecated `?` button surface. Settings sheet `Help & How to use` row triggers `OnboardingOverlay` via navigation modal. | Low |

### 4.9 Legal + home (deferred / out of MVP-mobile)

| Web file | Native target | Decision |
|---|---|---|
| `home/HomePage.jsx` (223) | **drop** | Web marketing landing; native app opens straight to Map. |
| `home/AboutPage.jsx` (166) | `home/AboutScreen.tsx` (modal route from Settings) | Static content; trivial port. |
| `legal/AttributionPage.jsx` | `legal/AttributionScreen.tsx` | Modal route from Settings → Attribution. |
| `legal/TermsPage.jsx` | `legal/TermsScreen.tsx` | Modal route from Settings → Terms. |
| `SiteGate.jsx` | **drop** | Web-only entry gate. |

---

## 5. Hook port

| Web hook | Native target | Tier | Effort |
|---|---|---|---|
| `useAccessibility.js` | `useAccessibility.ts` | Adapt — swap `localStorage` → `@react-native-async-storage/async-storage` | 0.25d |
| `useBays.js` | `useBays.ts` | **Portable** verbatim | 0.1d |
| `useBusyNow.js` | `useBusyNow.ts` | Portable | 0.1d |
| `useClock.js` | `useClock.ts` | Portable | 0.05d |
| `useDarkMode.js` | `useDarkMode.ts` | Adapt — `matchMedia` → `Appearance` + `useColorScheme` from NativeWind | 0.25d |
| `useDebouncedPlannerParams.js` | port | Portable | 0.05d |
| `useDebouncedValue.js` | port | Portable | 0.05d |
| `useMapState.js` (268) | `useMapState.ts` | **Portable** — no Leaflet dependency | 0.25d |
| `useMapsProvider.js` | `useMapsProvider.ts` | Adapt — `localStorage` → `AsyncStorage` | 0.25d |
| `useParkingForecast.js` | port | Portable | 0.1d |
| `useQuietestSegments.js` | port | Portable | 0.1d |
| `useReducedMotion.js` | `useReducedMotion.ts` | Adapt — `matchMedia` → `AccessibilityInfo.isReduceMotionEnabled` + `change` listener | 0.25d |
| `useRouteAnimation.js` (195) | `useRouteAnimation.ts` | **Replace** — Reanimated worklets | 0.75d |
| `*.test.js(x)` | rewrite under `@testing-library/react-native` | Replace | 0.5d total |

Hook total: ~3 dev-days.

---

## 6. Map performance spike protocol (3-day deadline — D2)

Day 1 — `react-native-maps` baseline:
- Scaffold `MapScreen` with `react-native-maps` provider Google.
- Render 3000 mock markers (no clustering) — measure FPS on Pixel 6a emulator + at least one physical mid-range device if available.
- Add `react-native-map-clustering` with `radius={40}`. Re-measure.
- Pass criterion: sustained ≥60 FPS pan/zoom with clusters.

Day 2 — vector segments:
- Render ~221 BusyNow zones as `<Polyline>` instances over the map.
- Measure FPS during pan/zoom while polylines visible.
- Pass criterion: ≥50 FPS pan/zoom.
- Cold start measurement: app launch → first interactive map < 3s.

Day 3 — decision:
- If both pass → commit `react-native-maps`. Skip Mapbox.
- If either fails → install `@rnmapbox/maps` config plugin, re-run §6 day-1 + day-2 protocol.
- If Mapbox passes → commit Mapbox + budget Mapbox monthly load token cost (free tier covers student traffic; document in `native-open-questions.md`).
- If Mapbox fails → escalate. Likely fix: reduce marker DOM, render only viewport-visible bays via bbox query. Don't switch frameworks.

**Reference device:** Pixel 6a (8GB RAM, Tensor G1) — represents Australian mid-range Android floor. Emulator config: `Pixel 6a API 33, 4GB RAM allocated`.

**Measurement:** React DevTools Profiler + Android Studio CPU Profiler trace.

---

## 7. Tricky pattern — "sheet covers tab bar at SNAP_FULL"

Round 4 spec: at SNAP_FULL the sheet must overlay the tab bar. Library
default tab bars (`@react-navigation/bottom-tabs`) sit above the screen
content and aren't covered by sheets without intervention.

**Solution:**

1. Tab bar uses `tabBarStyle = { position: 'absolute', height: 56 + insets.bottom, zIndex: 490 }`.
2. `@gorhom/bottom-sheet` rendered at `zIndex: 550` (matches MASTER.md `z-sheet`).
3. Tab bar visibility tied to sheet snap index: when index === SNAP_FULL (2), `tabBarStyle.display = 'none'` via `navigation.setOptions`. When sheet collapses, restore display. Use `useAnimatedReaction` on `animatedIndex` to drive the show/hide.
4. Hardware back button at SNAP_FULL: first press → `bottomSheetRef.snapToIndex(1)` (SNAP_HALF). Second press → default navigation back. Wire via `BackHandler`.

Document this pattern as the **canonical sheet-vs-tab-bar handler** —
reuse for Settings sheet, Filter sheet, BayDetailSheet.

---

## 8. Navigation graph

```
RootStack (NavigationContainer + linking config)
 │
 ├── BottomTabs (BottomTabNavigator, height 56)
 │   ├── MapScreen      (Live Map tab)
 │   └── PredictionsScreen (Predictions tab)
 │
 └── modal routes (presentation: 'transparentModal')
     ├── Onboarding   (Steps 0/1/2)
     ├── Help         (Settings → Help replays Onboarding)
     ├── About        (Settings → About)
     ├── Attribution
     └── Terms
```

**Linking config** (App Links — D3):

```
prefixes: ['melopark://', 'https://melopark.app']
config: {
  screens: {
    BottomTabs: {
      screens: {
        MapScreen: {
          path: 'bay/:bayId',
          parse: { bayId: String }
        }
      }
    }
  }
}
```

`/.well-known/assetlinks.json` hosted at `melopark.app` (Phase 3 deliverable).

---

## 9. Edge cases

| Condition | Behavior |
|---|---|
| Hardware back at MapScreen root | Default back behavior — exit app (Android standard) |
| Hardware back inside SettingsSheet | Close sheet, stay on Map |
| Hardware back at SNAP_FULL on BayDetail | Collapse to SNAP_HALF; second press dismiss sheet |
| Rotation to landscape | Out of v1 — lock to portrait via `app.json` `orientation: "portrait"` |
| App backgrounded during planning mode | State preserved (React Navigation handles); on foreground, re-fetch `/api/parking` to refresh live data |
| Network offline | Existing offline banner pattern carries over; consider `react-native-netinfo` for online/offline detection |
| Configuration change (dark mode toggle from quick-settings) | `useColorScheme` re-renders; NativeWind dark variants swap automatically |
| Map tile loading slow on cold start | `MapView` shows blank then tiles; consider `loadingEnabled={true}` prop + brand-color loading view |

---

## 10. Test cases per component category

Not enumerating per-component (would duplicate Phase 2 acceptance). High-level coverage targets:

| Surface | Test type | Coverage target |
|---|---|---|
| Hooks (port) | jest unit | 100% pass parity with web tests |
| `BayDetailSheet` rendering | RTL native | snap-points render, focus trap, accessibility |
| `MapsProviderChooser` | RTL native | radio selection, confirm, clear, escape, back-button |
| `launchMaps` | jest | mock `Linking`, verify 5 platform×provider combos |
| Tab bar + sheet stacking | integration | sheet covers tab bar at SNAP_FULL, restores on collapse |
| Onboarding overlay | integration | step transitions, pulse-ring states, reduced-motion guard |
| Map screen | manual + perf | 3000 markers ≥60 FPS, cold start < 3s |
| Linking | manual | `adb shell am start -W -a android.intent.action.VIEW -d "melopark://bay/123"` routes correctly |

---

## 11. Dependencies

Builds on Phase 1 (`native-design-system-port.md`). External deps to add
in Phase 2:

| Package | Purpose |
|---|---|
| `@react-navigation/native` + `@react-navigation/bottom-tabs` + `@react-navigation/native-stack` | Navigation graph |
| `react-native-screens` | Native screen primitives (perf) |
| `@gorhom/bottom-sheet` | Sheet primitive |
| `react-native-maps` *(default)* OR `@rnmapbox/maps` *(if spike fails)* | Map |
| `react-native-map-clustering` | Marker clustering (if RN-maps wins) |
| `@react-native-async-storage/async-storage` | Replaces localStorage |
| `expo-linking` | Deep linking IN + OUT |
| `expo-blur` | Onboarding blur background |
| `victory-native@^41` + `@shopify/react-native-skia` | Predictions charts |
| `@react-native-community/datetimepicker` | Planner arrival time |
| `react-native-netinfo` | Offline detection |

---

## 12. Open questions (Phase 2 — to resolve during implementation)

| Tag | Question |
|---|---|
| `map-tile-style` | Stock Google Map style vs custom JSON style (matches web aesthetic better)? Recommend stock for v1. |
| `cluster-radius` | `react-native-map-clustering` `radius={40}` is a starting default. Tune during spike day 1. |
| `predictions-chart-engine` | `victory-native@^41` requires Skia; alternative is `react-native-svg-charts` (lighter, less feature-rich). Default victory-native; switch if Skia bundle size is unacceptable. |
| `segment-popup-presentation` | Tap segment → bottom-sheet drill-in vs Callout. Recommend bottom-sheet; confirm with UX during spike. |
| `mapscreen-decomposition` | When to split 1422-LOC MapPage into sub-orchestrators — recommend not on first port (high regression risk); refactor pass after Phase 2 acceptance. |
| `back-button-behavior-onboarding` | Hardware back during onboarding — skip current step or exit onboarding? Recommend exit (matches Skip button). |

---

## 13. Effort estimate

| Sub-phase | Scope | Dev-days |
|---|---|---|
| 2.A | Map spike (§6) — gates map library | 3.0 |
| 2.B | Navigation graph + screen scaffolds + RootStack/BottomTabs | 1.0 |
| 2.C | Hook port (§5) | 3.0 |
| 2.D | Map + cluster + bay markers + tap-to-select | 3.0 |
| 2.E | BusyNow vector segments + popup-as-sheet | 2.0 |
| 2.F | BayDetailSheet + verdict children + nav actions | 3.0 |
| 2.G | Search bar + autocomplete + keyboard handling | 2.0 |
| 2.H | Settings sheet + maps-provider chooser + theme/accessibility wiring | 1.5 |
| 2.I | Onboarding overlay (3 steps + pulse-ring states) | 1.5 |
| 2.J | Predictions screen + charts | 3.0 |
| 2.K | Tab bar ↔ sheet stacking (§7) | 0.5 |
| 2.L | TrapToast / banners / alerts | 0.5 |
| 2.M | Tests (§10) | 3.0 |
| **Phase 2 total** | | **~27 dev-days** |

Honest band: 5–6 calendar weeks for one developer; 3–4 weeks for two.

---

## 14. Risk register (top 5)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Map perf fails the §6 spike, forcing Mapbox migration mid-Phase 2 | Medium | High | 3-day budget is hard. Switch decisively at day 3 — `@rnmapbox/maps` is a config-plugin install, not a rewrite. Marker contract stays the same. |
| `BayDetailSheet` focus/accessibility regression vs web | Medium | Medium | `accessibilityViewIsModal` + manual TalkBack pass before Phase 2 acceptance |
| `MapScreen.tsx` 1422-LOC port causes high-regression rewrite | High | Medium | Don't decompose during initial port. Refactor pass after Phase 2 acceptance. Pair-program first week |
| `victory-native` + Skia bundle size pushes APK over Play warning threshold | Low | Low | Skia is ~5MB stripped; well under Play 100MB AAB limit. Monitor at first build. |
| Hardware back-button behavior diverges from React Navigation expectations | Medium | Medium | Document state-machine for each sheet; `BackHandler` test cases in §10 |

---

## 15. Acceptance criteria

- [ ] Map spike completed (3 days). Library committed. Decision documented in `native-open-questions.md`.
- [ ] Every component listed in §4 has a native file in `mobile/src/components/`.
- [ ] Every hook in §5 has a native file in `mobile/src/hooks/`.
- [ ] Linking config resolves `melopark://bay/123` AND `https://melopark.app/bay/123` (App Links) to MapScreen with bay preselected.
- [ ] Tab bar height 56dp + safe area. Active tab = filled icon + brand color. No Material 3 indicator pill.
- [ ] BayDetailSheet covers tab bar at SNAP_FULL; restores on collapse. Hardware back collapses sheet first, exits second.
- [ ] OnboardingOverlay step transitions match web spec. Pulse-ring: load=animated, first-tap=static, destination-selected=removed. Reduced-motion skips to static.
- [ ] MapsProviderChooser opens as `BottomSheetModal`; confirm → `launchMaps` fires; `Linking.canOpenURL` replaces iframe heuristic.
- [ ] PredictionsScreen renders bar chart + line chart + busiest list; FlatList scrolls 60 FPS.
- [ ] SearchBar keyboard handling: IME push, autocorrect off, returnKeyType=search, dismisses on blur.
- [ ] All ported hooks pass their tests (RN-equivalent) at 100% parity with web suite.
- [ ] Round 4 parity check passes for every wireframe in `docs/ux-mocks/`.

---

## 16. Review gate

Reviewer verifies before Phase 2 → Phase 3:

1. **Map spike outcome documented.** Library choice locked. No "we'll decide later."
2. **Every web component in `frontend/src/components/` accounted for** in §4 — Portable, Adapt, Replace, or explicit "drop with reason."
3. **No iOS-only imports** (e.g. `react-native/Libraries/.../*Native*Ios*`).
4. **Tab bar 56dp + sheet-covers-at-SNAP_FULL** demonstrated on emulator.
5. **App Links + custom scheme both route** — `adb shell am start` test recorded in PR.
6. **TalkBack walkthrough** completes the core flow (open map → tap bay → read verdict → close) without dead ends.
7. **No regression in `frontend/`** — web app builds and tests pass unchanged.
8. **Phase 2 effort estimate refined** with actuals from spike + first week.

Stop. Next: Phase 3 (`docs/native-capabilities.md`) — haptics, permissions, deep linking OUT, app lifecycle.
