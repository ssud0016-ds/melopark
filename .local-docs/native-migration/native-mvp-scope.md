# Native MVP Scope — v1 Android

> **Platform: Android only.** Round 1–4 UX outcomes preserved; Epic 7
> Navigate-to-Bay in scope; push out (D4); tablet out; iOS N/A.

---

## In MVP

### Surfaces

- **Map screen** (`MapScreen`) — live + planning mode, ~3000 bay markers, clustering, BusyNow vector segments, scope strip (Live now / Filters / zoom), search bar at top, bottom tab bar.
- **BayDetailSheet** — verdict, status & limits, constraint chips, parking sign translator, proof rows, timeline strip, Navigate + Walk CTAs (Epic 7), inline fallback notice.
- **Predictions screen** — CBD 6-hour bar chart, forecast trend line, busiest areas, all-zones grid (collapsed by default).
- **Settings sheet** — theme (Light/Dark/System), color-blind palette, accessibility (accessible bays only), maps provider (Google / Browser fallback), help replay, about, attribution, terms.
- **Onboarding** — 3 steps: hero, destination teaching with pulsing real search bar, legend.
- **Maps provider chooser** — first-tap Navigate flow + Settings-row edit flow.

### Capabilities

- **Haptics** — bay tap, nav CTA, tab switch, snap-point change, destination set.
- **Location permission** — request on first "centre on me", banner + settings deep-link on deny.
- **App Links + custom scheme** — `melopark://bay/{id}` and `https://melopark.app/bay/{id}`.
- **Deep linking OUT (Epic 7)** — Google Maps via `comgooglemaps://` / `google.navigation:`; Browser fallback to Google Maps web.
- **App lifecycle** — refetch parking on foreground after >5 min background.
- **Offline banner** — NetInfo-driven.
- **Edge-to-edge display** — Android 15 default; safe-area-aware.
- **Dark mode** — system + user override.
- **Color-blind palette** — toggle persists across sessions.

### UX preservation

Every round 1 P-ID, round 2 A/B/C/E ID, round 3 cleanup item, round 4 tab-bar pattern. See `native-ux-parity-check.md`.

---

## Out of MVP (v2 candidates)

| Feature | Why later |
|---|---|
| **Push notifications** (D4) | Backend frozen this iteration; FCM endpoint absent; not core to find-parking |
| **Saved bays / favorites** | Not validated by user research; defer until v1 usage data |
| **Walking-mode dedicated screen** | Epic 7 Walk currently hands off to Google Maps for walking directions — sufficient for v1 |
| **Tablet layout (≥600dp)** | Mobile-first; tablet design pass not done |
| **Wear OS / widgets** | No design; no user demand validated |
| **Themed app icon** (Android 13+ monochrome) | Cosmetic; default colored icon ships fine |
| **Apple Maps support** | N/A under Android-only scope |
| **iOS port** | Android-only scope; v2 if web analytics show strong iOS demand |
| **Sentry / Firebase Analytics** | Local analytics shim sufficient for v1 telemetry |
| **Biometric quick-pin** | No sensitive data stored; not warranted |
| **Live data refresh background** | Doze + battery cost; foreground refresh on appstate change covers the case |
| **Tap-to-call / share-bay** | Not in current wireframes; out for now |
| **Multi-language** | en-AU only for v1 |

---

## Web app fate (v1 era)

**Keep live**, bug-fix only. Serves iOS users + desktop users +
fallback for Android users without Play Store access. Backend serves
both. Sunset evaluation post-launch (Phase 5 §4).

---

## Rationale — why this cut

1. **Semester budget** — ~40 dev-days fits 14 weeks at one main dev.
2. **Backend frozen** — anything requiring backend changes (push, accounts, saved bays sync) is out.
3. **UX outcomes preserved** — every wireframe-validated feature ships.
4. **Epic 7 is in flight** — Navigate-to-Bay is part of v1 native because it's already planned and design-locked.
5. **Path to v2** — every out-of-MVP item is independently shippable later without rewriting v1.

---

## Acceptance — MVP

- [ ] All in-MVP surfaces render and function.
- [ ] All preserved UX outcomes verified (see `native-ux-parity-check.md`).
- [ ] App installs from Play Store (Internal track) and runs on Pixel 6a + one Samsung mid-range device.
- [ ] Network-offline state degrades gracefully.
- [ ] Permission denial paths reach the user with actionable copy.
- [ ] No out-of-MVP feature accidentally shipped (no `expo-notifications`, no save-bay UI, no tablet-specific code paths).
