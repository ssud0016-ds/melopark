# Native Capabilities — Phase 3

> **Stack:** Expo SDK 51+ on Android, minSdk 26. Builds on Phase 1 + 2.
> Planning doc only. No code.

---

## 1. Goal

Wire Android-only native features the web app cannot offer: haptics,
runtime location permissions, deep linking IN (App Links + custom
scheme), deep linking OUT (Epic 7 maps handoff), app lifecycle / cache
refresh, network state. Push notifications **out of MVP (D4)**.

## 2. Scope

**In:** haptics tokens, location permission flow + deny path, App Links
+ `melopark://` scheme, `Linking.canOpenURL` for Epic 7, app lifecycle
(`AppState`) cache refresh, offline banner via NetInfo.

**Out:** push notifications (v2), background fetch, geofencing, biometric
auth.

## 3. Tasks

### 3.1 Haptics

| Trigger | Token (Phase 1) | API |
|---|---|---|
| Bay marker tap | `native-haptic-light` | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` |
| Navigate / Walk CTA tap | `native-haptic-medium` | `Haptics.impactAsync(Medium)` |
| Tab switch | `native-haptic-selection` | `Haptics.selectionAsync()` |
| Snap-point change (sheet) | `native-haptic-selection` | fires on `onSnapPointChange` callback |
| Destination set | `native-haptic-medium` | once on autocomplete pick |
| Error toast | none | haptic on error feels punitive — skip |

File: `mobile/src/utils/haptics.ts` wraps `expo-haptics`; no-ops if
device returns `Haptics.isSupportedAsync() === false`.

### 3.2 Location permissions

`expo-location`. Request **at moment of use**, not on app launch.

Flow:

```
User taps "Use my location" / first map-center attempt
  → Location.requestForegroundPermissionsAsync()
  → granted: Location.getCurrentPositionAsync({accuracy: Balanced})
  → denied: muted in-app banner with link to app-settings
            "Allow location to centre map on you. [Open settings]"
            tap → Linking.openSettings()
  → permanently denied (ask=never): same banner, no further prompt
```

Permission strings in `app.json`:
```
android.permissions = ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
```

**No `ACCESS_BACKGROUND_LOCATION`** — out of scope; would trigger Play
Console review escalation.

Accuracy: `Balanced` (~100m, fast, low battery). Fine accuracy not needed
for CBD map centering.

### 3.3 Deep linking IN

**Custom scheme:** `melopark://bay/{id}` and `melopark://predictions`.

**App Links:** `https://melopark.app/bay/{id}` and
`https://melopark.app/predictions`.

`assetlinks.json` (Phase 4 hosts at
`https://melopark.app/.well-known/assetlinks.json`):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.melopark",
    "sha256_cert_fingerprints": ["<EAS signing cert SHA-256>"]
  }
}]
```

SHA-256 fingerprint sourced from EAS `eas credentials` after first
Android build.

`app.json` `intentFilters`:
```
{
  "action": "VIEW",
  "autoVerify": true,
  "data": [
    {"scheme":"https","host":"melopark.app","pathPrefix":"/bay"},
    {"scheme":"https","host":"melopark.app","pathPrefix":"/predictions"},
    {"scheme":"melopark"}
  ],
  "category": ["BROWSABLE","DEFAULT"]
}
```

Linking config consumed by `react-navigation` (Phase 2 §8).

### 3.4 Deep linking OUT (Epic 7 maps handoff)

`expo-linking` replaces web `window.open` + iframe heuristic.

```
launchMaps(provider, mode, destination, origin?)
  → Linking.canOpenURL('comgooglemaps://') / 'google.navigation:' / 'geo:'
  → if supported: Linking.openURL(scheme)
  → if not: Linking.openURL(webFallbackUrl)
  → onFallback(...) → inline notice in BayDetailSheet
```

Android Intent URI alternative for Google Maps: `google.navigation:q=lat,lng&mode=d` — fires Google Maps app directly via Intent resolution.

Apple Maps **dropped** (Android-only). Provider chooser shows Google + Browser fallback only. Update `MapsProviderChooser.tsx` props: `providers: ['google', 'web']`.

### 3.5 App lifecycle

`AppState` listener at `App.tsx`:

```
'active' → if app was 'background' > 5 min: refetch /api/parking
        → if last fetch > 5 min: refetch
'background' → no action (caches stay)
'inactive' → ignore (transient on Android)
```

Planning mode (arrival_iso set): on foreground, do NOT auto-reset planner. User explicitly chose that time; preserve until they clear it.

Forecast cache (`useParkingForecast`): refresh on foreground unconditionally — predictions are time-sensitive.

### 3.6 Network state

`@react-native-community/netinfo`. Hook: `useNetInfo` from library directly.

Offline banner: top of map, below search bar, `bg-amber-50 text-amber-700` (caution token, not destructive). Copy: "You're offline. Showing cached data." Auto-dismiss on reconnect.

Queued tap behavior: bay tap while offline opens BayDetailSheet with cached last evaluation if available; otherwise muted "Reconnect to evaluate this bay" inline message in sheet.

### 3.7 Edge-to-edge + status bar

Edge-to-edge enabled (Android 15 default). `expo-status-bar`:
- Light theme: `style="dark"` (dark content on light bg).
- Dark theme: `style="light"`.
- Translucent: always.

System nav bar (gesture-bar zone): match tab-bar color when tab bar visible; surface color otherwise. `expo-navigation-bar` sets color + button style.

---

## 4. State flow

```
App boot
  ├─ Load Inter fonts (Phase 1)
  ├─ Hydrate AsyncStorage (theme, accessibility, maps provider)
  ├─ Mount NavigationContainer with linking config
  ├─ AppState listener attached
  ├─ NetInfo listener attached
  └─ First screen = MapScreen
       │
       ├─ User taps "centre on me"
       │    → request permission (3.2)
       │    → granted: Location.getCurrentPositionAsync
       │    → denied: banner + settings link
       │
       ├─ User taps bay marker
       │    → haptic Light
       │    → BayDetailSheet opens
       │
       ├─ User taps Navigate CTA
       │    → haptic Medium
       │    → launchMaps (3.4)
       │
       └─ Deep link arrives (App Link or scheme)
            → react-navigation routes to MapScreen with bayId param
            → bay preselected on map; sheet opens
```

## 5. Edge cases

| Condition | Behavior |
|---|---|
| User denies location once | Banner; can re-prompt on next tap |
| User denies + "don't ask again" | Banner shows settings deep-link; no re-prompt |
| Google Maps not installed | `canOpenURL('comgooglemaps://')` false → fallback web URL |
| App Link tapped while app installed | `autoVerify=true` routes directly to app (no chooser) |
| App Link tapped while app NOT installed | Browser opens web URL (existing Vercel app) |
| Backgrounded during onboarding | Resume at same step on foreground |
| Network drops mid-evaluation | Inline error in BayDetailSheet, retry button |
| Airplane mode on launch | Offline banner; cached bays from last session shown |

## 6. Test cases

1. Haptics fires on bay tap (mock `Haptics.impactAsync`).
2. Haptics no-op when `isSupportedAsync` resolves false.
3. Location permission grant flow.
4. Location permission deny → banner renders.
5. `Linking.openSettings` called from banner CTA.
6. Linking config: `melopark://bay/123` → navigation state has bayId=123.
7. App Link: `https://melopark.app/bay/123` → same.
8. `canOpenURL('comgooglemaps://')` true → native scheme opened.
9. `canOpenURL` false → web fallback opened.
10. AppState foreground after >5min → `fetchParkingBays` called.
11. NetInfo offline → banner mounts.
12. NetInfo reconnect → banner unmounts.

## 7. Dependencies

| Package | Purpose |
|---|---|
| `expo-haptics` | Haptics |
| `expo-location` | Location + permission |
| `expo-linking` | Deep linking IN + OUT |
| `expo-status-bar` | Status bar style |
| `expo-navigation-bar` | System nav bar color |
| `@react-native-community/netinfo` | Network state |

## 8. Open questions

| Tag | Question |
|---|---|
| `loc-accuracy-tier` | Balanced (100m) vs High (10m)? Recommend Balanced; revisit if "centre on me" feels imprecise. |
| `appstate-refresh-threshold` | 5min foreground-refresh threshold matches backend cache TTL. Confirm with backend owner. |
| `applinks-cert-rotation` | EAS cert rotation impacts assetlinks.json. Document re-publish step in Phase 4 runbook. |

## 9. Effort

| Sub-task | Days |
|---|---|
| Haptics tokens | 0.25 |
| Location permission + banner | 0.75 |
| App Links + scheme config + linking integration | 0.75 |
| `launchMaps.ts` port | 0.25 |
| AppState lifecycle | 0.5 |
| NetInfo banner | 0.25 |
| Edge-to-edge + nav bar color | 0.25 |
| Tests (12 cases) | 1.0 |
| **Total** | **~4 dev-days** |

## 10. Risk register

| Risk | L | I | Mitigation |
|---|---|---|---|
| App Links autoVerify fails (assetlinks.json mis-served) | Medium | High | Verify via Google's `digital-asset-links` API tool before Phase 4 submission |
| Location permission denied permanently — user can't recover without settings | Medium | Medium | Settings deep-link in banner; explicit copy |
| Edge-to-edge layout breaks legacy components | Low | Medium | All screens wrapped in `Screen.tsx` primitive (Phase 1) which handles insets |

## 11. Acceptance

- [ ] Haptics fire on bay tap, nav CTA, tab switch, sheet snap.
- [ ] Location permission request + grant + use cycle works.
- [ ] Deny path shows banner + settings link.
- [ ] `melopark://bay/X` and `https://melopark.app/bay/X` both open app to bay X.
- [ ] Epic 7 launch path: Navigate CTA → Google Maps opens with destination.
- [ ] AppState foreground after backgrounding refreshes parking data.
- [ ] Offline banner mounts/unmounts on connectivity change.
- [ ] No push, no FCM, no notification permission anywhere in the build.

## 12. Review gate

1. `app.json` permissions list is **exactly** `[FINE, COARSE]` location — no extras.
2. No `expo-notifications` import anywhere.
3. App Links verified with Google's digital-asset-links checker.
4. `MapsProviderChooser` shows Google + Browser only (no Apple option).
5. TalkBack: location permission banner is announced and actionable.
