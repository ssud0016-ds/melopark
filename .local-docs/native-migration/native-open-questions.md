# Native Open Questions — Android-Only Scope

> **Round of revision — Pre-Phase-1 cleanup (2026-05-12, second pass):**
> D1 minSdk → **26**. D2 Mapbox spike → **3-day budget**. D3 domain →
> **`melopark.app` confirmed** (per `frontend/package.json` lighthouse
> target); App Links plan kept. D4 push → **out of MVP** (deleted from
> B-Phase 3, backend FCM-gap row removed from Section C). D5 skill →
> **present at `.cursor/skills/ui-ux-pro-max/scripts/search.py`**;
> findings appended to `native-framework-decision.md`. OQ-A5 added: tab
> bar height **56px** (round-4 wireframe overrides Material 3 80dp).

> **Round of revision — Android-only scope (2026-05-12):** Initial creation
> under the Android-only constraint. Catalogues every decision deferred
> from Phase 0 plus implications for Phases 1–5 that haven't been authored
> yet, so the developer planning those phases knows what's already settled
> vs what's open.

> **Status:** Framework decision recommendation is **Expo (managed
> React Native), Android target only.** Awaiting user confirmation.
> Phases 1–5 not yet authored.

---

## A. Decisions deferred from Phase 0

### OQ-A1 — Map library: `react-native-maps` (Google provider) vs `@rnmapbox/maps` *(D2 resolved — 3-day spike budget)*

**Why open:** BusyNow vector segments (`leaflet.vectorgrid`) need a
vector-tile source on Android. `react-native-maps` does NOT have first-class
vector source support; Mapbox does.

**Trade-off:** `react-native-maps` is simpler to integrate (Expo first-class
module, free Google Maps SDK quota for most usage) but BusyNow vector parity
requires a custom tile overlay. `@rnmapbox/maps` (config plugin on Expo)
gives vector parity out of the box but adds a Mapbox account, SDK size, and
pricing concern.

**Decision (D2):** Default to `react-native-maps` (Google provider).
**3-day spike budget**: if `react-native-maps` cannot render ~3000 markers
+ BusyNow vector overlay at sustained 60 FPS on a mid-range Android
reference device (e.g. Pixel 6a or equivalent ~$400 mid-range) by **end
of day 3** of the spike, switch to `@rnmapbox/maps` and stop evaluating.
No open-ended exploration past day 3.

**Spike pass criteria (Phase 2):**
- 3000 markers rendered with `react-native-map-clustering` at default
  zoom levels.
- BusyNow vector segments overlaid (any working approach — custom tile
  fetch, GeoJSON layer, or fallback) without dropping below 50 FPS on
  pan/zoom.
- App start-to-interactive < 3s on the reference device.

Fail any criterion at day 3 → commit to `@rnmapbox/maps`.

**Owner of resolution:** developer planning Phase 2 component map.

### OQ-A2 — Styling layer: NativeWind vs Restyle vs `StyleSheet`

**Why open:** Tailwind class strings in the current codebase don't run
unmodified on RN. Three options: NativeWind (Tailwind syntax in RN, minimal
rewrite); Restyle (Shopify, type-safe theme objects); plain `StyleSheet`.

**Trade-off:** NativeWind maximizes copy-paste of existing class strings
but adds a runtime layer. Restyle is faster and type-safe but every
component needs rewriting. `StyleSheet` is zero-dep but verbose.

**Recommended default:** NativeWind — maximizes UI reuse from the audit's
"Adapt" tier and keeps the existing design-system token names recognizable.

**Owner:** Phase 1 design-system port.

### OQ-A3 — Min API level + target API level *(D1 resolved)*

**Decision (D1):** **`minSdk 26`** (Android 8.0). Trade ~3% device
coverage (24→26 drops ~98%→~95%) to cut the worst-performing low-RAM
segment that would otherwise struggle with native map + clustering +
Reanimated stacked together. minSdk 26 also enables: adaptive icons
natively, notification channels, background execution limits — all
already part of the platform expectations.

**Rejected alternatives:**
- `minSdk 24` — keeps 9-year-old low-RAM devices in scope; map perf
  becomes a per-device-tier problem.
- `minSdk 28` — saves another ~2% perf headroom but drops to ~90%
  coverage, hurting student-team reach for low cost on devices that
  would otherwise run fine.

**`targetSdk`:** latest at submission time (currently 35 / Android 15).
Confirm against Play Console device-catalog stats during Phase 4 prep.

**Owner:** Phase 1 / Phase 4.

### OQ-A4 — Animation library: `Animated` vs `Reanimated`

**Why open:** Onboarding pulsing ring, sheet snap physics, route animation
all need smooth transitions. `Reanimated` runs on the UI thread; `Animated`
runs on the JS thread.

**Recommended default:** `Reanimated` (Expo first-class). Worth the slightly
steeper API for the perf headroom on map screens.

**Owner:** Phase 2.

### OQ-A5 — Tab bar height: 56px (round-4 wireframe) vs 80dp (Material 3 default) *(resolved)*

**Why open:** Material 3 `NavigationBar` defaults to 80dp height; the
round-4 wireframe spec (`docs/ux-mocks/navigation-pattern.md`) prescribes
56px. Both are valid under Material spec (56–80dp permitted).

**Decision:** **Ship 56px.** Round-4 wireframe is the source of truth
for the app's UX; ratified against iOS HIG (49pt) and Material 3
(56–80dp) ranges. Web app already runs at 56px — visual continuity
across web and native matters more than matching the Material default.
56px also recovers 24px of vertical map content vs 80dp at SNAP_PEEK
and SNAP_HALF.

**Implementation note (Phase 2):** override
`@react-navigation/bottom-tabs` default `tabBarStyle.height` to 56 +
safe-area-inset-bottom. Active indicator pill (Material 3 default)
disabled — round-4 uses color + filled-icon dual signal instead.

**Owner:** Phase 2.

---

## B. Implications for Phases 1–5 (not yet written)

The original cross-platform plan assumed iOS + Android. Android-only
trims each downstream phase. Flag these for whoever authors the phases.

### B-Phase 1 — Design system port + asset pipeline

**Drop (iOS-only):**

- iOS app icon size matrix (20pt, 29pt, 40pt, 60pt, 76pt, 83.5pt, 1024pt).
- iOS launch screen storyboard.
- iOS type-ramp variant (SF Pro fallback).
- Notched-iPhone safe-area variants.

**Keep + expand (Android):**

- **Adaptive icon** — foreground + background layers at every density
  (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi). Source size 108dp × 108dp; safe zone
  72dp × 72dp. Background = solid brand color or simple shape (NOT the full
  logo).
- **Play Store icon** — 512×512 PNG, separate from the in-app adaptive icon.
- **Android 12+ splash API** — icon-only splash with
  `windowSplashScreenBackground` color (use brand purple `#35338c`) and a
  centered icon drawable. Configured via `expo-splash-screen` config in
  `app.json`.
- **Feature graphic** — 1024×500 PNG for Play Store listing.
- **In-app logo SVG conversion** — `mobile-light.png` / `mobile-dark.png`
  → SVG via `react-native-svg` for resolution-independent rendering.

**Asset pipeline doc:** does **not** exist yet (`docs/native-asset-pipeline.md`).
Phase 1 author must create it.

### B-Phase 2 — Component migration map

**Drop (iOS-only):**

- iOS sheet drag physics considerations.
- iOS-specific tab bar style (`UITabBarController`).
- iOS modal presentation style differences.

**Standardize on Material 3 / Android conventions:**

- Bottom sheet: `@gorhom/bottom-sheet` with Material 3 sheet shape (top
  corners 28dp; matches MASTER.md `rounded-t-2xl` ≈ 24px).
- Tab bar: `@react-navigation/bottom-tabs` with Material 3 `NavigationBar`
  shape (80dp tall on Material 3, but spec calls for 56px — override).
- Ripple touch feedback on tappable rows (Android-native).
- Back button handling: hardware back button + `BackHandler` on RN/Expo.

**~3000-marker clustering library:** specify `react-native-map-clustering`
(wraps `react-native-maps` + supercluster). Mandatory; default `Marker`
rendering will not survive on mid-range Android at 3000 markers.

### B-Phase 3 — Native-only capabilities

**Drop:**

- iOS permission flow (`NSLocationWhenInUseUsageDescription`, etc.).
- iOS "always allow" vs "while using app" branch.
- Universal Links (iOS).
- APNs (Apple Push Notifications).

**Keep (Android only):**

- **Runtime permissions** — `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
  via `expo-location`. Request at the moment of use, not on app launch.
  Document the deny path (show muted in-app banner with link to
  app-settings deep link).
- **App Links** *(D3 resolved — domain `melopark.app` confirmed via
  `frontend/package.json` lighthouse target)* — `melopark.app/bay/{id}`.
  Configured via `intent-filter` in `AndroidManifest.xml` and
  `assetlinks.json` hosted at
  `https://melopark.app/.well-known/assetlinks.json`. Deep-linking IN
  custom scheme: `melopark://`. Both routes resolve to the same in-app
  bay-detail handler.
- **Deep linking OUT (Epic 7)** — `Linking.openURL` with
  `google.navigation:` / `comgooglemaps://` schemes; `canOpenURL` to detect
  installed packages.
- **Haptics** — `expo-haptics` with `Selection` / `ImpactLight` /
  `ImpactMedium` intensities mapped to bay tap / nav tap / snap-point change.

**Out of MVP (D4 resolved):**

- ~~Push notifications via FCM (`expo-notifications`)~~ — **deferred to v2.**
  Reasons: backend is frozen this iteration so the FCM token registration
  endpoint isn't available; push isn't core to find-parking; semester is
  tight. File as v2 candidate alongside arrival-window reminders and
  trap-warning alerts.

### B-Phase 4 — Store submission

**Drop entirely (App Store / TestFlight):**

- App Store Connect entries.
- Bundle ID, iOS signing certificate, provisioning profile.
- iOS screenshots (6.7", 6.5", 5.5").
- Privacy nutrition labels.
- TestFlight beta.
- App Review Information (demo account, instructions).
- Apple Developer Program enrollment ($99/yr).

**Keep (Play Store only):**

- **Play Console** account + organizational verification.
- **Package name** — `app.melopark` or similar; locked at first publish.
- **Signing key** — generated by EAS Build and stored in EAS Secrets, OR
  uploaded to Play App Signing.
- **Play Console entries** — short description (≤80 chars), full description
  (≤4000 chars), feature graphic (1024×500), promo screenshots.
- **Android screenshots** — phone (1080×1920 or similar) + 7" tablet + 10"
  tablet if tablet support is in MVP.
- **Data Safety form** — declare location collection, analytics events.
- **Target API level** — must be ≥ Play Console's minimum target (currently
  API 34; rises annually).
- **Adaptive icon assets** — see Phase 1.
- **Play Internal Testing** — beta channel for the team + invited testers
  before public release.
- **Privacy policy URL** — required even for Play Store; needs a hosted page.

### B-Phase 5 — Rollout

**Timeline shortens by ~1–2 weeks** under Android-only:

- No App Store Connect setup (~3 days saved).
- No TestFlight tester onboarding flow (~1 day saved).
- No App Review iteration cycle, which can be 1–3 days per rejection.
- No iOS device QA pass.

**Net:** revise developer-week estimate downward by 1.5–2 weeks when the
Phase 5 plan is authored.

**Beta plan:** Play Internal Testing (replaces TestFlight + Play Internal).

**Launch geography:** Melbourne first, AU-wide on confirmation. Same as
original plan.

---

## C. Backend gaps (no backend change in this iteration)

| Gap | Triggering phase | Note |
|---|---|---|
| No analytics ingest | Phase 4 (analytics shim from Epic 7) | Epic 7 already noted no analytics surface exists; shim in `frontend/src/utils/analytics.js` is the workaround. Native port should keep the same shim until backend gains an analytics endpoint or the team adopts a third-party SDK (Firebase Analytics, PostHog, etc.). |

> ~~FCM token registration endpoint~~ — **closed (D4).** Push out of MVP;
> backend gap no longer triggered this iteration. Reopen if push is
> revived as a v2 candidate.

---

## D. UX-pro-max skill searches — outcome *(D5 resolved)*

**Skill located at `.cursor/skills/ui-ux-pro-max/scripts/search.py`**
(not the `.claude/skills/` path originally checked). Skill runs.
Findings appended to `docs/native-framework-decision.md` under
"Skill audit findings (D5)".

Phase 1 author may re-run additional queries as needed; the skill is
working and available.

---

## E. Stop gate (unchanged from original Phase 0)

Phases 1–5 will not be authored until the user **confirms Expo**
(or selects an alternative under the Android-only constraint).
