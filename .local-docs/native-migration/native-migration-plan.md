# Native Migration Plan — Master

> **Framework:** Expo (managed React Native), Android-only, minSdk 26.
> **Scope:** Frontend migration. Backend (FastAPI on DigitalOcean) unchanged.
> **Doc:** master index + per-phase summary. Detail in linked sub-docs.
> **No implementation code in this iteration.**

---

## Doc map

| # | Doc | Phase | Status |
|---|---|---|---|
| 1 | `native-codebase-audit.md` | 0.1 | done |
| 2 | `native-framework-decision.md` | 0.2 + 0.3 | done, Expo confirmed |
| 3 | `native-open-questions.md` | cross-cutting | done, D1–D5 + OQ-A5 resolved |
| 4 | `native-design-system-port.md` | 1 | done |
| 5 | `native-asset-pipeline.md` | 1 | done |
| 6 | `native-component-map.md` | 2 | done |
| 7 | `native-capabilities.md` | 3 | done |
| 8 | `native-store-submission.md` | 4 | done |
| 9 | `native-rollout-plan.md` | 5 | done |
| 10 | `native-mvp-scope.md` | cross-cutting | done |
| 11 | `native-ux-parity-check.md` | cross-cutting | done |
| 12 | **this file** | master | done |

---

## Per-phase summary (per-phase schema)

### Phase 1 — Design system port + asset pipeline

| Field | Value |
|---|---|
| Goal | Reproduce MASTER.md tokens on Expo + NativeWind; add `native-*` extensions; ship Android adaptive icon + splash. |
| Scope (in) | Token mapping, Inter font, Reanimated motion tokens, runtime constants (`elevation`, `haptics`, `zIndex`, `focus`), adaptive icon, splash, in-app SVG LogoMark, Play Store icon, feature graphic. |
| Scope (out) | Component migration (Phase 2), capabilities (Phase 3), store metadata (Phase 4). |
| Files | `mobile/tailwind.config.js`, `mobile/src/design-system/*.ts`, `mobile/App.tsx`, `mobile/assets/icon/*`, `mobile/assets/splash/*`, `mobile/assets/marketing/feature-graphic.png`, `mobile/src/components/common/LogoMark.tsx`. |
| Libraries | Expo SDK 51+, nativewind@4, tailwindcss@3.4, reanimated@3, gesture-handler, safe-area-context, expo-font, expo-splash-screen, expo-haptics, expo-system-ui, gorhom/bottom-sheet@4, react-native-svg. |
| Dependencies | None (Phase 0 unblocks). |
| Open questions | Vector source for P mark (assume PNG-only, designer trace 0.5d); themed-icon deferred. |
| Effort | ~3 dev-days + ~2 designer-days. |
| Risks | NativeWind v4 arbitrary-value edge cases (Low); Inter load delay (Low); dark-mode hard-coded hex (Medium). |
| Acceptance | App boots on Pixel 6a emulator; tokens resolve via NativeWind; Inter loaded; dark mode swaps; haptics callable; adaptive icon renders on circle + squircle + teardrop masks. |
| Review gate | Tailwind theme matches MASTER.md 1:1; new `native-*` tokens have rationale; no iOS-only deps; `app.json` `minSdk 26`, `package "app.melopark"`, `scheme "melopark"`. |
| Detail | `docs/native-design-system-port.md`, `docs/native-asset-pipeline.md`. |

### Phase 2 — Component migration

| Field | Value |
|---|---|
| Goal | Port every web component + hook to native equivalents; preserve round 1–4 UX. |
| Scope (in) | All map / bay / busynow / predictions / search / settings / nav components; hook ports; navigation graph; sheet↔tab-bar stacking; 3-day map spike (D2). |
| Scope (out) | Haptic wiring (Phase 3); deep linking (Phase 3); store assets (Phase 4). |
| Files | `mobile/src/components/**`, `mobile/src/hooks/**`, `mobile/src/navigation/{RootNavigator,BottomTabs}.tsx`, `mobile/src/services/apiBays.ts`. |
| Libraries | @react-navigation/{native,bottom-tabs,native-stack}, react-native-screens, @gorhom/bottom-sheet, react-native-maps + react-native-map-clustering (or @rnmapbox/maps if spike fails), async-storage, expo-linking, expo-blur, victory-native + skia, datetimepicker, netinfo. |
| Dependencies | Phase 1 complete. |
| Open questions | Map library locked by spike day 3; victory-native vs svg-charts; segment-popup-as-sheet vs Callout; MapScreen decomposition timing. |
| Effort | ~27 dev-days. |
| Risks | Map spike fail (Medium/High); MapScreen 1422-LOC regression (High/Medium); victory-native + Skia bundle size (Low/Low); hardware-back divergence (Medium/Medium). |
| Acceptance | Map library committed; every component listed in component map ported; tab bar 56dp + sheet-covers-at-SNAP_FULL behavior; App Links + scheme both route; PredictionsScreen scrolls 60 FPS; ported hooks pass parity tests. |
| Review gate | No iOS-only imports; round-4 wireframes match on emulator; TalkBack walkthrough completes; web `frontend/` untouched. |
| Detail | `docs/native-component-map.md`. |

### Phase 3 — Native capabilities

| Field | Value |
|---|---|
| Goal | Wire Android-native features: haptics, location permission, deep linking IN + OUT, app lifecycle refresh, offline state, edge-to-edge. |
| Scope (in) | Haptics tokens, `expo-location` permission flow + deny banner, App Links + custom scheme + `assetlinks.json` hosting, `launchMaps.ts` Linking port, `AppState` cache refresh, NetInfo banner, edge-to-edge status + nav bars. |
| Scope (out) | Push notifications (D4 deferred to v2); background fetch; biometric; geofencing. |
| Files | `mobile/src/utils/haptics.ts`, `mobile/src/components/maps/launchMaps.ts`, `mobile/src/components/common/OfflineBanner.tsx`, `mobile/src/components/common/LocationPermissionBanner.tsx`, `app.json` intentFilters + permissions, `mobile/App.tsx` AppState listener. Hosted: `https://melopark.app/.well-known/assetlinks.json`. |
| Libraries | expo-haptics, expo-location, expo-linking, expo-status-bar, expo-navigation-bar, @react-native-community/netinfo. |
| Dependencies | Phase 2 complete (screens exist to bind to). |
| Open questions | Location accuracy tier (Balanced vs High); foreground-refresh threshold; cert rotation impact on assetlinks. |
| Effort | ~4 dev-days. |
| Risks | App Links autoVerify fail (Medium/High); permanent deny path UX (Medium/Medium); edge-to-edge layout regression (Low/Medium). |
| Acceptance | Haptics fire; permission grant + deny + settings deep-link work; `melopark://bay/X` and `https://melopark.app/bay/X` open app; Navigate CTA opens Google Maps; AppState foreground refreshes data; offline banner mounts/unmounts; no `expo-notifications`. |
| Review gate | Permissions list exactly `[FINE, COARSE]`; no notifications module imported; App Links pass Google validator; chooser shows Google + Browser only. |
| Detail | `docs/native-capabilities.md`. |

### Phase 4 — Store submission

| Field | Value |
|---|---|
| Goal | Submission-ready Play Store entry: AAB, listing, Data Safety, privacy policy, screenshots, Play Internal Testing track. |
| Scope (in) | Package reservation (`app.melopark`), EAS production build, Play App Signing, listing metadata + descriptions, 5 phone screenshots, feature graphic, Data Safety form, permissions justification, content rating, privacy policy hosting, Internal Testing track. |
| Scope (out) | Public production roll-out (Phase 5); ASO optimization; paid promotion. |
| Files | `eas.json` production profile; Play Console entries (off-repo); `mobile/assets/marketing/screenshot-{01..05}.png`; `https://melopark.app/privacy` (Vercel-hosted markdown page). |
| Libraries | EAS Build; Play Console UI (no in-repo libs). |
| Dependencies | Phase 3 complete (final screenshots need final native chrome). |
| Open questions | Play Console identity verification owner; privacy policy legal review with Monash; Sentry / analytics SDK adoption decision; AU-only vs AU+NZ distribution. |
| Effort | ~4.5 dev-days + ~2 calendar days Google identity wait. |
| Risks | Identity verification stalls (Medium/High); Data Safety form mismatch (Low/Medium); privacy policy URL late (Medium/Medium); App Links cert mismatch (Medium/Medium). |
| Acceptance | AAB on Internal Testing track; all listing fields populated; privacy policy live + 200; Data Safety submitted; Pre-launch Report green; ≥5 internal testers installed. |
| Review gate | AAB has no iOS frameworks bundled; signing cert SHA-256 matches `assetlinks.json`; permissions list matches declared; privacy URL readable on mobile; testers install via Play Store Internal link. |
| Detail | `docs/native-store-submission.md`. |

### Phase 5 — Rollout

| Field | Value |
|---|---|
| Goal | Beta → graduated public Play Store launch in Australia. |
| Scope (in) | Play Internal Testing 2-week beta; staged production roll-out 20%→50%→100% over 7 days; Vitals monitoring; bug-fix cycles via EAS Update for JS-only patches; v1 launch announcement. |
| Scope (out) | v2 features; international expansion; paid marketing. |
| Files | None (rollout is operational, not code-producing). |
| Libraries | EAS Update (existing); Play Console (existing). |
| Dependencies | Phase 4 complete (Internal Testing track live). |
| Open questions | Australia-only vs AU+NZ from day one (recommend AU only); web-app sunset timing (defer post-launch). |
| Effort | ~2 dev-days of bug-fix work + 10 calendar days of beta + 7 days of staged rollout = ~3 calendar weeks. |
| Risks | Map spike late slip cascades to launch (Medium/High); P0 crash discovered late beta (Medium/High); privacy policy approval slips (Medium/High); Play first-time review delay (Medium/Medium). |
| Acceptance | App live at 100% AU; Play Vitals crash-free ≥99%, ANR <0.5%; ≥50 installs; ≥5 user feedback items; web app remains live; round 1–4 UX verified on physical device; `v1.0.0` git tag. |
| Review gate | Vitals green 14 consecutive days; v2 backlog filed; web-app maintenance owner named; post-mortem doc written. |
| Detail | `docs/native-rollout-plan.md`. |

---

## Per-phase recommended order

```
Week 1: Phase 1 (design system + assets)
Week 2: Phase 2A spike (map library) + Phase 2B navigation scaffold + Phase 2C hooks (parallel)
Week 3–8: Phase 2D–2M (components, sheet primitives, screens, tests)
Week 9: Phase 3 capabilities
Week 10: Phase 4A identity (parallel) + Phase 4B build + listing
Week 11–12: Phase 5 beta + iteration
Week 13: Beta graduation prep
Week 14: Phase 5 staged roll-out
```

Review-gate checkpoints (pause for sign-off):

1. End of Phase 1 — design tokens reviewed.
2. End of Phase 2 spike day 3 — map library committed.
3. End of Phase 2 — feature parity demonstrated.
4. End of Phase 3 — capabilities verified on device.
5. End of Phase 4 — submission packaged.
6. End of beta — graduation criteria met.

---

## Total program estimate

| Layer | Days |
|---|---|
| Phase 1 (dev) | 3 |
| Phase 1 (designer) | 2 |
| Phase 2 | 27 |
| Phase 3 | 4 |
| Phase 4 | 4.5 (+2 calendar wait) |
| Phase 5 | 2 dev (10 calendar) |
| **Total dev-days** | **~40** |
| **Calendar** | **~14 weeks** (matches FIT5120 S1 2026 remaining) |

---

## Cross-cutting non-negotiables

1. **Preserve every UX outcome.** See `native-ux-parity-check.md`. Anything that regresses requires written justification.
2. **No new color semantics.** Status green/amber/red and chrome purple meanings locked.
3. **Native components feel native.** Material 3 sheets on Android; platform-standard tab bar; ripple on press; hardware-back support.
4. **Backend untouched.** All `/api/*` endpoints unchanged. Backend gap (FCM token endpoint) **closed** under D4.
5. **Android-only.** No iOS branches anywhere — package list, runtime, assets all single-platform.
6. **MVP discipline.** Out-of-MVP features (push, saved bays, tablet, etc.) do not slip into v1. See `native-mvp-scope.md`.

---

## Stop

End of native migration planning. Hand off to implementation:

1. **Phase 1 first.** Confirm design tokens + asset pipeline before Phase 2 starts.
2. **Phase 2 map spike day 1 of week 2.** 3-day budget is hard.
3. **Pause at each review gate.** Sign-off before continuing.
4. **No phase skipping.** Phase 3 depends on Phase 2 screens existing.
