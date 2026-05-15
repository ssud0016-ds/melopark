# Native Framework Decision — Phase 0.2 + 0.3

> **Round of revision — Android-only scope (2026-05-12):** Team confirmed
> Android-only deployment. iOS out of scope for v1 and foreseeable v2.
> Framework recommendation unchanged (**Expo**) — Android-only **strengthens**
> the case. iOS-specific rows in the comparison table marked N/A; True Native
> rewritten as Kotlin + Compose only; risk register iOS items removed and
> Android items added; ~3000-marker clustering concern called out as
> framework-agnostic.

> **Android-only banner.** Every mention of iOS, App Store, TestFlight,
> Apple Developer Program, Swift, UIKit, SwiftUI, or notched-iPhone safe-area
> is retained for context but marked **N/A under Android-only scope**.

> **DECISION REQUIRED — STOP GATE.**
>
> This document is the framework-selection gate. The recommendation below is
> the planner's opinionated call; **Phases 1–5 will not be written until the
> user confirms the framework choice.** If a different option is preferred,
> say which and Phases 1–5 will be re-scoped for that choice.

---

## Decision required

> **Pick one framework for the MelOPark native app.** Phases 1–5 (design
> system port, component map, native-only capabilities, store submission,
> rollout) will be authored against this choice and **only this choice**.

Options (re-scoped Android-only):

1. **True native** — Android Kotlin + Jetpack Compose, single codebase. *(iOS Swift evaluation N/A.)*
2. **React Native (bare)** — one JS codebase, `react-native init`, Android build only.
3. **Expo (managed React Native)** *(recommended)* — one JS codebase, Expo SDK, EAS Build (Android target only), OTA updates.
4. **Flutter** — one Dart codebase, Android target only.

---

## TL;DR — recommendation

**Pick Expo (managed React Native). Android target only.**

One line: it's the only option that lets a finite-semester student team
who already write React + Tailwind ship to Play Store while preserving
round 1–4 UX outcomes; Android-only removes the Xcode/iOS half of every
competing option's cost without changing Expo's already-low overhead.

Android-only **strengthens** the Expo recommendation:

- **EAS Build cost drops** — one target per build, ~half the queue time, no iOS credentials to manage.
- **No Apple Developer Program ($99/yr saved).**
- **Phase 4 (store submission) halves in scope** — Play Console only; no App Store Connect, no provisioning profiles, no TestFlight, no privacy nutrition labels, no App Review Information.
- **No iOS-specific UX edge cases** — notched safe-area math, iOS sheet drag physics, iOS Linking quirks, Universal Links: all N/A.
- **One permission model** — Android runtime permissions; drop the iOS "while using" vs "always allow" branch.

Detail and scoring below. **Do not proceed past this doc** until the user
confirms.

---

## Context this decision answers to

- **Team:** FIT5120 S1 2026, Team FlaminGO. Student team, finite semester
  weeks, current skills are React + Tailwind + FastAPI. No documented
  native-platform experience.
- **App shape today:** React + Vite + Tailwind + Leaflet on the frontend,
  FastAPI + PostgreSQL on the backend, ~3000 bay markers, custom vector
  grid for street segments, multi-snap bottom sheet, two-tab navigation.
- **Backend:** unchanged by this migration. All API contracts continue.
- **UX outcomes to preserve:** every round 1 P-ID, round 2 A/B/C/E ID,
  round 3 resolutions, round 4 bottom-tab-bar pattern. See
  `docs/native-codebase-audit.md` for the structural picture.
- **In-flight feature:** Epic 7 (Navigate to Bay) — see
  `docs/epic7-implementation-plan.md`. The native plan must accommodate it.
- **Round 4 dividend:** the migration from floating pill to bottom tab bar
  was already the right call for the **web** app; it also aligns with both
  iOS HIG and Material Design tab-bar conventions. The native migration
  inherits this win and **does not need to re-litigate the navigation
  pattern**. The pattern is already native.

---

## Comparison table

Dimensions weighted in `[brackets]` to communicate planner priority for a
student-team-in-a-semester context. Higher score = better fit.

| Dimension `[weight]` | True native (Kotlin + Compose) | React Native (bare) | **Expo (managed RN)** | Flutter |
|---|---|---|---|---|
| **Code reuse from existing React app** `[3×]` | ~10% — data shapes only | ~55–65% — hooks layer + component shapes | **~55–65% — same as bare RN, with higher tooling reuse** | ~10–20% — logic shape only, no JSX→Dart reuse |
| **Team capacity fit (React + Tailwind only)** `[3×]` | Poor — Kotlin + Compose + Material 3 are net-new even on one platform | Good — same language, same idioms, NativeWind keeps Tailwind | **Excellent — same language, simpler tooling, no Gradle config until needed** | Poor — Dart is net-new; widget tree paradigm is a different mental model |
| **Timeline realism for a single semester** `[3×]` | Tight — single platform but full language + framework ramp; ~70% of web reuse lost | Feasible but tight — bare RN still puts Gradle/keystore on the critical path early (iOS toolchain N/A) | **Feasible — `eas build --platform android` handles the plumbing; first APK/AAB day-one** | Feasible — `flutter build apk` is solid, but learning curve eats the saved time |
| **Play Store submission** `[2×]` | One submission; Gradle signing config + Play Console | One submission; manual signing flow unless team adopts EAS or Fastlane | **One submission managed by EAS — Android keystore generated + stored; Play Internal Testing flow wired** | One submission; Flutter docs are good but tooling is less integrated than EAS |
| **Maintenance cost post-launch** `[2×]` | Medium — single codebase but Kotlin + Compose churn | Medium — Gradle + native module upgrades require care | **Medium-low — Expo SDK upgrades batched; OTA delivery for JS-only fixes; EAS handles signing** | Medium — Dart ecosystem is smaller; native plugin churn |
| **Map library quality + ~3000 marker perf on mid-range Android** `[3×]` | Best — Google Maps Android SDK direct; full clustering control via `maps-utils-ktx` | Good — `react-native-maps` (Google provider) + `react-native-map-clustering`; Mapbox via `@rnmapbox/maps` for BusyNow vector parity | **Good — same map options. `react-native-maps` is a first-class Expo module; Mapbox via config plugin** | Good — `google_maps_flutter` solid; Mapbox SDK available; rendering is performant |
| **Bottom-sheet library (round 4 snap + tab-bar overlay)** `[2×]` | Best — Material `BottomSheetBehavior` / `ModalBottomSheet` (Compose) | **`@gorhom/bottom-sheet` — feature-complete: snap points, gesture, dismiss, programmatic open. Reproduces round-4 spec.** | Same as bare RN. | `DraggableScrollableSheet` is decent; advanced "covers tab bar at SNAP_FULL" needs custom stacking |
| **Tab bar quality (round 4 pattern, Material 3)** `[2×]` | Best — `BottomNavigationView` / Compose `NavigationBar` | Good — `@react-navigation/bottom-tabs`; matches round-4 spec | **Good — same as bare RN. Expo supports `react-navigation` first-class.** | Good — `NavigationBar` widget; works |
| **Native-only capabilities (haptics, deep-link IN, permissions, FCM push)** `[2×]` | Best — full SDK access | Good — `expo-haptics`, `expo-linking`, `expo-location`, `expo-notifications` work in bare RN but require manual Android-module config | **Excellent — pre-wired by Expo SDK; permissions + App Links + FCM are config-flag features, not native-module integrations** | Good — `flutter_local_notifications`, `geolocator`, etc. — mature, slightly more wiring than Expo |
| **Risk of getting stuck on tooling** `[3×]` | High — Gradle + Android Studio bugs daily; Compose recomposition debugging | Medium — bare RN means owning Gradle + keystore config | **Low — `eas build` runs in the cloud; team doesn't own Gradle config until a custom native module is needed** | Low-medium — Flutter tooling is consolidated but `flutter doctor` problems happen |
| **Eject / escape hatch if managed limits hit** `[1×]` | N/A | N/A | **`expo prebuild` produces the bare-RN Android project on demand. No vendor lock-in.** | N/A |
| **OTA update path (ship a copy/typo fix without Play review)** `[1×]` | None | None without third-party (CodePush, etc.) | **EAS Update built in — JS-only fixes ship in minutes** | None first-party |
| **Ecosystem maturity for parking/mapping apps on Android** `[1×]` | Strongest | Strong | **Strong (same packages)** | Strong |

**Weighted scoring** (each cell scored 1–5 against fit, multiplied by
bracket weight, summed; re-scored under Android-only):

| Framework | Weighted score | Rank |
|---|---|---|
| True native (Kotlin + Compose) | ~62 / 130 | 4 |
| React Native (bare) | ~100 / 130 | 2 |
| **Expo (managed RN)** | **~118 / 130** | **1** |
| Flutter | ~85 / 130 | 3 |

True-native moves up modestly under Android-only (one platform instead
of two) but the language-ramp and lost reuse still dominate. Expo's lead
over bare RN widens slightly: Gradle ownership is the only remaining
tooling tax bare RN imposes, and `eas build` removes it.

Scores are planner judgment, not objective measurement. Final ranking
under Android-only: **Expo > bare RN > Flutter > true native**.

---

## Risk register

### Framework-agnostic Android risks (apply to every option)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **~3000 marker rendering on mid-range Android** | Medium | High | Clustering is mandatory. On RN/Expo: `react-native-map-clustering` (wraps `react-native-maps` + supercluster). On Kotlin: Google Maps utility lib `ClusterManager`. On Flutter: `google_maps_cluster_manager`. Phase 2 component map must specify the exact library. |
| **Google Maps SDK API key management** | Certain | Medium | Restrict by Android package name + SHA-1 fingerprint; rotate before launch; do NOT commit key. EAS Secret on managed Expo; `local.properties` (gitignored) on bare RN / Kotlin. |
| **Android version fragmentation — target vs min API level** | Medium | Medium | Target latest API (currently API 35); minSdk 24 (Android 7) covers ~98% of active devices and unlocks modern APIs. Confirm against Play Console's device-catalog stats at submission time. |
| **Adaptive icon design — foreground/background split + safe zone** | Certain | Low | Design icon as a 108dp × 108dp drawable with a 72dp safe zone; background is solid color or simple shape (NOT the full logo). See `native-asset-pipeline.md` (to be written). |
| **Android 12+ splash screen API constraints** | Certain | Low | Icon-only splash with `windowSplashScreenBackground` color and centered icon drawable; no full wordmark lockup. Branded splash on Expo via `expo-splash-screen` config. |
| **Background work / Doze restrictions** | Medium | Medium | If push or background refresh is in scope, use WorkManager-backed APIs (`expo-background-fetch`); document battery-optimization exemption is **not** to be requested. |

### True native (Kotlin + Compose)

| Risk | Likelihood | Impact | Mitigation if chosen |
|---|---|---|---|
| Team learns Kotlin + Compose + Material 3 mid-semester | High | High | Halve MVP scope; pair-program first two weeks |
| ~70% of web-app reuse lost (entire hooks layer + component shapes discarded) | Certain | High | Inherent cost of choice; not mitigable |
| Compose recomposition perf debugging on map screens | Medium | Medium | Lean on `LazyColumn` patterns; profile early |
| Gradle / signing config eats week 1 | Medium | Medium | Use Android Studio templates; defer Play Console signing to launch sprint |

### React Native (bare)

| Risk | Likelihood | Impact | Mitigation if chosen |
|---|---|---|---|
| Gradle + keystore config eats week 1 | Medium | Medium | Adopt Fastlane immediately, or migrate to Expo Dev Client mid-flight |
| Native module versions drift on RN upgrade | Medium | Medium | Pin RN minor; defer upgrades to post-launch |
| Map library choice (RN-maps vs Mapbox) needs an early prototype | High | High | Spike day-1 on `react-native-maps` (Google provider); only adopt Mapbox if BusyNow vector parity demands it |
| Bare project diverges from Expo conventions, blocking later "managed" benefits | Low | Low | Standard React-Native-Community modules only |

### Expo (managed React Native) — **recommended**

| Risk | Likelihood | Impact | Mitigation if chosen |
|---|---|---|---|
| A required native dependency isn't in the Expo SDK and isn't a config plugin | Low (modern Expo SDK 50+ with Dev Client and config plugins effectively closes this gap — maps, haptics, linking, location, notifications, async-storage, secure-store all first-class) | Medium | If hit, `expo prebuild` continues on bare RN; ~half-day cost; no rewrite |
| Mapbox vector parity for BusyNow segments may require a config plugin | Medium | Medium | Spike `@rnmapbox/maps` via config plugin. Fallback: `react-native-maps` (Google provider) + custom tile overlay |
| EAS Build queue / costs | Low (Android-only halves build minutes vs cross-platform) | Low | Free tier sufficient for student traffic; local builds remain available |
| OTA-update misuse pushes a broken JS bundle | Low | Medium | Treat EAS Update with the same review discipline as store releases; use channels |
| ~~iOS-specific App Store review rejection~~ | **N/A — Android-only scope** | — | — |
| ~~iOS sheet drag physics divergence from Android~~ | **N/A** | — | — |

### Flutter

| Risk | Likelihood | Impact | Mitigation if chosen |
|---|---|---|---|
| Team learns Dart + widget paradigm | High | High | Halve scope; widget-tree mental model is the cost of admission |
| 100% UI rewrite — no JSX reuse | Certain | High | Plan for it; Flutter pays back on visual fidelity but the labor is real |
| Map library choice (Google Maps vs Mapbox in Flutter) is its own decision | Medium | Medium | Default to `google_maps_flutter` for fastest start |
| Hooks layer (~9 fully portable files) is **discarded** | Certain | Medium | Re-encode logic in Dart; widget state + Provider/Bloc is the equivalent |

---

## Why Expo over bare React Native specifically (Android-only)

Both options preserve the same ~55–65% code reuse and the same library
ecosystem. The split is in **tooling cost**, which Android-only narrows
but does not eliminate:

1. **Day-1 builds.** `eas build --platform android` produces a
   Play-Internal-ready AAB without the team touching Gradle keystores.
   Bare RN puts keystore + signing config on the critical path before
   the first build can install on a phone.
2. **Config plugins instead of native module wiring.** App Links,
   runtime permissions, FCM, location — all config-file edits on Expo;
   bare RN requires editing `AndroidManifest.xml` + `build.gradle`.
3. **OTA update path.** Typo fixes and JS-only patches ship via
   `eas update` in minutes. Important for a student project where
   end-of-semester is a single window and Play review can take 1–3 days
   (sometimes longer on first submission).
4. **No lock-in.** `expo prebuild` produces the bare-RN Android project
   on demand. If a future requirement breaks the managed model, the
   team converts in half a day without losing the codebase. **The
   "managed Expo limits what you can do" concern is closed** by SDK 50+
   with Dev Client and config plugins — see the risk register row.
5. **Map-library risk is the same** on bare RN and Expo — both use
   `react-native-maps` (Google provider) or `@rnmapbox/maps`. Expo
   supports both via first-class modules and config plugins.

The case for bare RN is **only** if the team already needs a native
module that isn't supported as a config plugin and isn't worth a
prebuild. The codebase audit (`docs/native-codebase-audit.md`) doesn't
surface any such module.

---

## Why Expo over Flutter specifically

The hooks layer in MelOPark is the strongest portability win — ~9 of 17
hooks are pure logic that move into React Native verbatim
(`useBays`, `useMapState`, `useBusyNow`, `useParkingForecast`,
`useDebounced*`, `useQuietestSegments`, `useClock`). Flutter discards all
of that and reauthors in Dart. The team's React fluency is also discarded.

Flutter's strengths — pixel-identical visuals across platforms, Skia
rendering performance, mature widget catalogue — are real, but they
optimize for a problem MelOPark doesn't have. The app is a map app: the
heavy rendering is the **map**, not the chrome. The chrome is two tabs
and a bottom sheet. Flutter's rendering advantage doesn't outweigh the
React-native code reuse that Expo retains.

---

## Why not true native (Kotlin + Compose) — Android-only re-litigation

> A common reflex: "if Android-only, you might as well go native." That
> is theoretically true but practically wrong for **this** team.

1. **Team skill mismatch.** The team has React + Tailwind muscle memory,
   not Kotlin + Compose + Material 3. Single-platform doesn't matter if
   the language and UI framework are both net-new.
2. **Lost reuse.** The codebase audit shows ~9 of 17 hooks port verbatim
   into RN/Expo and the component layer is mostly view-swap, not rewrite.
   Going Kotlin discards ~70% of that. The cost is paid back nowhere.
3. **No perf justification.** The Expo↔Kotlin performance gap matters
   for heavy custom rendering, sub-millisecond audio, or on-device ML.
   MelOPark has none of those. The heavy rendering is the **map**, which
   is the same Google Maps SDK whether you call it from Kotlin or from
   `react-native-maps`.
4. **One semester.** Kotlin + Compose + Android Studio + Gradle + Play
   Console as a first-time stack in a finite semester is a calendar risk
   the team can't absorb on top of the actual feature work.

True native remains the right answer for a different team profile or a
different feature set. Not this one.

---

## What this decision does NOT touch

- **The backend.** FastAPI on DigitalOcean continues. All API contracts
  preserved. No backend code planned in this iteration.
- **The web app.** Future of the web app (sunset / keep / desktop-only)
  is a Phase 5 decision (`docs/native-mvp-scope.md` and
  `docs/native-migration-plan.md`). Not decided here.
- **Map library.** `react-native-maps` (Google provider) vs `@rnmapbox/maps`
  is a Phase 2 decision contingent on a 3000-marker performance spike.
  Both are available under Expo. Flagged in `docs/native-open-questions.md`.
- **Styling layer inside Expo.** NativeWind vs Restyle vs `StyleSheet` is
  a Phase 1 decision contingent on how directly we want to lift Tailwind
  class strings.
- **Min API level.** Recommended minSdk 24 (Android 7) — confirm at
  submission time against Play Console device-catalog stats. Flagged in
  `docs/native-open-questions.md`.

## ~~Cross-platform considerations~~ — N/A under Android-only scope

The following sections of the original analysis are retained for
reference but **do not apply**:

- iOS sheet drag physics vs Material sheet physics — Material only.
- iOS notched-iPhone safe-area math — Android cutout API only.
- Universal Links (iOS) — N/A. App Links (Android) only.
- App Store Connect, TestFlight, App Review Information, privacy
  nutrition labels — N/A.
- Apple Developer Program ($99/yr) — N/A.
- "Which store first?" — Play Store only.

---

## What we'd do with the answer

If the user confirms **Expo**:

1. Write `docs/native-design-system-port.md` (Phase 1) — token mapping
   to NativeWind/Restyle, native-only extensions (haptic intensity, iOS
   sheet style vs Material sheet style, platform type ramp).
2. Write `docs/native-asset-pipeline.md` (Phase 1) — full icon matrix
   per Apple/Google specs, splash storyboard, in-app SVG conversion plan.
   Logo source assets are already chosen.
3. Write `docs/native-component-map.md` (Phase 2) — per-component native
   target + library + risk, building on `docs/native-codebase-audit.md`.
4. Write the native-only capabilities, store submission, and rollout
   phases (`docs/native-migration-plan.md`, `docs/native-mvp-scope.md`,
   `docs/native-open-questions.md`, `docs/native-ux-parity-check.md`).

If the user picks **a different option**, Phases 1–5 will be re-scoped
to that choice and the per-phase library decisions will change.

---

## Skill audit findings (D5 — `.cursor/skills/ui-ux-pro-max`)

Ran the three original Phase 0 queries plus two Android-specific
follow-ups. Skill present at `.cursor/skills/ui-ux-pro-max/scripts/search.py`.
Findings below; cross-references to where Phase 0 already addresses them.

### Q1 — `native mobile app navigation patterns tab bar` (`--domain ux`)

| Finding | Status |
|---|---|
| **Back Button (Navigation/Mobile, High):** Users expect back to work predictably. Preserve nav history. | Addressed — `@react-navigation/bottom-tabs` plus Android hardware-back via `BackHandler`. Flagged in OQ B-Phase 2. |
| **Sticky Navigation (Navigation/Web, Medium):** Fixed nav must not obscure content; pad equal to nav height. | Already enforced in `predictions-simplified.md` (`padding-bottom: calc(56px + env(safe-area-inset-bottom))`). |
| **Mobile Keyboards (Forms/Mobile, Medium):** Show appropriate keyboard for input type via `inputmode`. | Web app uses default text input on search; native equivalent: `TextInput` `keyboardType="default"` + `returnKeyType="search"`. Flagged for Phase 2. |

### Q2 — `ios android design system parity tokens` (`--domain style`)

Results returned generic style categories (Swiss Modernism, Bento Grids,
Real-Time Monitoring) rather than parity guidance. **No applicable
finding.** The CSV doesn't index iOS↔Android parity directly. Falling
back to authoritative Material 3 + HIG specs (already cited in `MASTER.md`
and `navigation-pattern.md`).

### Q3 — `native bottom sheet snap points gesture` (`--domain ux`)

| Finding | Status |
|---|---|
| **Gesture Conflicts (Touch/Mobile, Medium):** Custom gestures can conflict with system. Avoid horizontal swipe on main content; vertical scroll primary. | Addressed — sheet uses vertical drag only (round-4 spec). Android system back-gesture (edge-swipe) does not conflict with vertical sheet drag. Flagged for Phase 2 to verify `@gorhom/bottom-sheet` edge-gesture exclusion is configured. |

### Q4 — `google maps android marker clustering performance` (`--stack react`)

| Finding | Status |
|---|---|
| **Profile before optimizing (Performance, Medium):** Use React DevTools Profiler. | Adopted into the Phase 2 spike protocol: profile clustering perf before committing to a library swap. |
| **Batch state updates (Performance, Low):** React 18 auto-batches. | Already used in `useMapState.js`. Carries to native verbatim. |
| **Lazy load components (Performance, Medium):** `React.lazy` for code splitting. | Less applicable on native (Metro bundles single file by default); RAM Bundles + inline requires are the RN equivalent. Flag for Phase 5 perf pass. |

### Q5 — `android only deployment expo react native` (`--stack react`)

| Finding | Status |
|---|---|
| **Synthetic events (Events, Low):** Use `e.preventDefault()` / `e.stopPropagation()`. | RN has `Pressable` + `responder` system instead. Not directly applicable. |
| **Rules of Hooks (Hooks, High):** Top-level only, never conditional. | Already enforced in codebase audit; carries verbatim. |
| **Label form controls (Accessibility, High):** Associate labels with inputs. | RN equivalent: `accessibilityLabel` on `TextInput`. Flag for Phase 1 design-system port. |

### Net assessment

Skill output is shallow for the specific native-Android questions
(`--domain ux` and `--stack react` CSVs are web-centric). It produced
**no findings that overturn or substantially modify Phase 0
recommendations.** The skill is more useful for verifying the **web
parity** of the migration (back button, sticky nav, gesture conflicts,
accessibility labels) than for native-specific architecture choices.

Phase 1 author should re-run with more specific queries
(e.g. `expo splash screen android 12`, `react-native-maps clustering`,
`gorhom bottom sheet android back gesture`) and cite findings inline.

---

## Stop gate

**STOP. Awaiting framework confirmation.** Do not author Phases 1–5
until the user confirms (or selects an alternative). The codebase audit
(`docs/native-codebase-audit.md`), this decision doc, and the open
questions list (`docs/native-open-questions.md`) are the only Phase 0
deliverables.
