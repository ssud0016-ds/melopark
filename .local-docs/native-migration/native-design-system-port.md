# Native Design System Port — Phase 1

> **Stack:** Expo (managed React Native), Android target only, minSdk 26,
> targetSdk latest. Styling layer: **NativeWind** (default per OQ-A2).
> All tokens map from `design-system/melopark/MASTER.md` to NativeWind /
> React Native primitives.

> **Planning doc only. No code.** Phase 1 ships two deliverables:
> this token-mapping doc and `docs/native-asset-pipeline.md`.

---

## 1. Goal

Reproduce every MASTER.md token (color, type, spacing, shadow, z-index,
animation, focus, root layout) on Expo + NativeWind such that the round 1–4
UX outcomes are preserved without inventing new visual semantics.

Extend the system with **native-only** tokens prefixed `native-` for
concepts that don't exist on web (haptic intensity, Material elevation,
Android cutout-aware safe-area, Material 3 ripple). Document each gap with
a one-line rationale.

## 2. Scope

**In:**
- Color tokens: status, chrome, surface, text, dark mode.
- Typography: Inter font loading on Android + Tailwind type ramp.
- Spacing scale: 4px base, NativeWind passthrough.
- Touch targets: 44dp minimum enforcement strategy.
- Shadows: web `shadow-*` tokens → Android elevation values.
- Z-index scale: 5 named layers from MASTER.md.
- Focus visible: keyboard navigation + TalkBack focus.
- Animation tokens: pulse-dot, pulse-ring with reduced-motion guard.
- Root layout: `min-h-[100dvh]` → equivalent `flex: 1` + safe-area.
- New native-only tokens: haptic, elevation, ripple, edge-to-edge insets.

**Out:**
- Component-level migration (Phase 2).
- Asset files (Phase 1 sibling — `native-asset-pipeline.md`).
- iOS-specific anything (Android-only scope).
- Backend or API changes.

## 3. Tasks

Files the Phase 1 developer creates. Paths anchored at a new `mobile/`
directory at repo root (per Expo project convention; not under `frontend/`).

### 3.1 Project bootstrap

| Task | Files / commands | Library |
|---|---|---|
| Init Expo project | `npx create-expo-app mobile --template blank-typescript` | Expo SDK 51+ |
| Add NativeWind | `mobile/tailwind.config.js`, `mobile/babel.config.js`, `mobile/nativewind-env.d.ts` | `nativewind@^4`, `tailwindcss@^3.4` |
| Add Reanimated | `mobile/babel.config.js` (plugin) | `react-native-reanimated@^3` |
| Add safe-area | `mobile/App.tsx` wraps `<SafeAreaProvider>` | `react-native-safe-area-context` |
| Add gesture handler | `mobile/index.js` first import | `react-native-gesture-handler` |
| Configure `app.json` | `package: "app.melopark"`, `android.adaptiveIcon`, `android.permissions: []` (Phase 3 adds), `expo.scheme: "melopark"`, `android.intentFilters` (App Links — D3) | Expo config |

### 3.2 Token files

| File | Purpose |
|---|---|
| `mobile/tailwind.config.js` | NativeWind theme — port colors, fontFamily, fontSize, spacing, borderRadius, boxShadow, zIndex from MASTER.md verbatim. |
| `mobile/src/design-system/tokens.ts` | TypeScript exports for non-Tailwind consumers (e.g. animation timing, haptic intensity). Single source of truth for runtime values. |
| `mobile/src/design-system/colors.ts` | Color hex constants re-exported (mirrors `MASTER.md §Semantic Color Palette`). Used where Tailwind class strings can't reach (status bar color, splash background). |
| `mobile/src/design-system/elevation.ts` | New native-only token: web `shadow-card` / `shadow-sheet` / `shadow-overlay` → Android elevation values (see §4.4). |
| `mobile/src/design-system/haptics.ts` | New native-only token: `native-haptic-selection` / `native-haptic-light` / `native-haptic-medium` wrappers around `expo-haptics`. |
| `mobile/src/design-system/motion.ts` | Reanimated timing presets matching MASTER.md animation tokens (150–250ms ease-out). |
| `mobile/src/design-system/typography.ts` | Inter font config (`expo-font` `useFonts` hook) + ramp constants. |
| `mobile/src/design-system/zIndex.ts` | TS constants for the 5 named z-layers from MASTER.md plus a new `native-tab-bar` layer = 490 (matches `BottomTabBar.jsx`). |
| `mobile/src/design-system/focus.ts` | Helper to apply focus-visible ring (`accessibilityState` + Reanimated outline) — see §4.7. |

### 3.3 Font loading

Inter is the only font (per MASTER.md "do NOT switch to Plus Jakarta Sans").

| Task | File | Note |
|---|---|---|
| Bundle Inter weights 400/500/600/700/800 | `mobile/assets/fonts/Inter-*.ttf` (5 weights) | Sourced from rsms.me/inter or Google Fonts; bundled via `expo-font`. |
| Load fonts on app boot | `mobile/App.tsx` `useFonts` + splash-screen hold until loaded | `expo-font`, `expo-splash-screen` |
| Fallback | None — splash held until Inter loads (text-render correctness > startup time) | — |

### 3.4 NativeWind theme — full mapping

`mobile/tailwind.config.js` `theme.extend` shape (planning sketch, not
code; Phase 2 author writes the file). Every entry below maps **one-to-one**
to a MASTER.md row.

#### Colors

| MASTER token | Hex | NativeWind token name |
|---|---|---|
| `--status-good` | `#15803d` | `status-good` (Tailwind defaults already have `green-700`) |
| `--status-good-bg` | `#f0fdf4` | `status-good-bg` (= `green-50`) |
| `--status-caution` | `#b45309` | `status-caution` |
| `--status-caution-bg` | `#fffbeb` | `status-caution-bg` |
| `--status-avoid` | `#b91c1c` | `status-avoid` |
| `--status-avoid-bg` | `#fef2f2` | `status-avoid-bg` |
| `--status-unknown` | `#94a3b8` | `status-unknown` |
| `--status-unknown-bg` | `#f1f5f9` | `status-unknown-bg` |
| `--color-chrome` | `#35338c` | `brand` |
| `--color-chrome-light` | `#8388c6` | `brand-light` |
| `--color-chrome-accent` | `#a3ec48` | `accent` |
| `--color-surface` | `#ffffff` | `surface` |
| `--color-surface-muted` | `#f4f6ff` | `surface-tertiary` |
| `--color-surface-dark` | `#111827` | `surface-dark` |
| `--color-surface-dark-secondary` | `#1f2937` | `surface-dark-secondary` |

**Dark mode strategy:** NativeWind v4 supports `dark:` variants via
`useColorScheme()` from `nativewind`. Wire to `Appearance.getColorScheme`
+ user override (replaces web `useDarkMode` `matchMedia` path). Color
swap rules from MASTER.md preserved verbatim.

#### Typography

| Role | Size | Weight | NativeWind class | Note |
|---|---|---|---|---|
| Display | 34 | 800 | `text-4xl font-extrabold` | Onboarding hero. |
| Heading | 20 | 700 | `text-xl font-bold` | Sheet titles. |
| Title | 16 | 600 | `text-base font-semibold` | Card titles. |
| Body | 14 | 400 | `text-sm` | Panel text. |
| Label | 12 | 500 | `text-xs font-medium` | Chips, badges. |
| Caption | 11 | 500 | `text-[11px] font-medium` | Section caps. |
| ~~Micro~~ | 9–10 | — | banned | Content banned per MASTER.md. |

NativeWind passes `text-[11px]` through to `fontSize: 11`. Font family
defaults to Inter via `fontFamily.sans` extension.

**Android type-ramp variant:** none. Material 3 type scale (`Display L`,
`Headline M`, etc.) is **not** adopted — MASTER.md ramp is authoritative.
Native components that default to Material type (e.g. `Snackbar`) get
explicit `fontFamily: Inter` + size override.

#### Spacing

NativeWind passes the entire Tailwind spacing scale through unchanged.
4px base grid preserved. No native-only extensions.

#### Touch targets

44dp minimum. NativeWind has no built-in `min-h-[44px]` helper distinct
from web, but the class string works as-is. **New runtime guard:**
`mobile/src/design-system/touch.ts` exports `minTapTarget = 44` and a
dev-mode assertion helper that warns when a `Pressable` renders smaller.

#### Border radius

| Role | NativeWind | Note |
|---|---|---|
| Sheet top corners | `rounded-t-3xl` (24px) | Material 3 sheets spec 28dp; round to existing token. |
| Card | `rounded-2xl` | Matches web. |
| Button | `rounded-lg` | Matches web. |
| Chip | `rounded-full` | Matches web. |

### 3.5 Shadows → elevation

Web has 4 shadow tokens; Android uses `elevation: number`. Map:

| MASTER token | Web shadow | Android elevation | Native-only addition |
|---|---|---|---|
| `shadow-card` | `0 1 3 rgba(0,0,0,.06)` | `elevation: 1` | — |
| `shadow-sheet` | `0 -2 12 rgba(0,0,0,.12)` | `elevation: 8` | — |
| `shadow-map-float` | `0 2 8 rgba(0,0,0,.1)` | `elevation: 4` | — |
| `shadow-overlay` | `0 4 16 rgba(0,0,0,.15)` | `elevation: 12` | — |
| **NEW: `native-elevation-ripple-host`** | — | `elevation: 2` | For pressable rows that need a stable shadow during ripple. |
| **NEW: `native-elevation-tab-bar`** | — | `elevation: 8` + `borderTopWidth: 0.5` | Material 3 default. Round-4 spec uses `border-t` + top shadow — preserve both. |

Implementation: `mobile/src/design-system/elevation.ts` exports the table
above. Components import the integer; NativeWind cannot express
elevation as a utility class on Android.

### 3.6 Z-index scale

Verbatim from MASTER.md plus the existing tab-bar layer from
`BottomTabBar.jsx`. Source-of-truth file: `mobile/src/design-system/zIndex.ts`.

```
z-tab-bar     = 490
z-pill        = 495  (legacy — kept for any leftover floating control)
z-scope-strip = 500
z-sheet       = 550
z-settings    = 570
z-search-bar  = 1000
```

NativeWind ports these as `zIndex` extensions; runtime constants live in
the TS file for non-Tailwind reach (e.g. modal `style={{ zIndex }}`).

### 3.7 Focus visible + accessibility focus

Web: `focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`.

Android equivalents — **two distinct concerns:**

1. **Keyboard/Bluetooth-keyboard focus ring.** Rare on phones but
   required for accessibility. Implement via `Pressable`'s `focusable`
   + a Reanimated outline rendered when `pressed === false && focused === true`.
   Helper: `mobile/src/design-system/focus.ts` exports a
   `useFocusRing()` hook returning Reanimated style + handlers.
2. **TalkBack focus order.** Use `accessibilityLabel`,
   `accessibilityRole`, `accessibilityState`, and explicit
   `accessibilityViewIsModal` on sheets. Replaces the web `listFocusable`
   focus-trap helper.

### 3.8 Animation tokens

MASTER.md tokens: `animate-pulse-dot` (live badge), `animate-pulse-ring`
(onboarding step 1 attention).

Native port: **Reanimated** worklets (per OQ-A4). NativeWind v4 does
support some animations, but pulse-ring requires `prefers-reduced-motion`
gating and ring-state machine (Polish 1 in `onboarding-split.md`):

```
state: 'load' | 'first-tap' | 'destination-selected'
load:                   pulsing ring (Reanimated `withRepeat(withTiming)`)
first-tap:              static ring (Reanimated `withTiming` to opacity 1)
destination-selected:   no ring (opacity 0)
reduced motion guard:   AccessibilityInfo.isReduceMotionEnabled → skip to static
```

File: `mobile/src/design-system/motion.ts` exports the timing presets
+ a `usePulseRing(state)` hook.

**Sheet snap physics:** delegated to `@gorhom/bottom-sheet`'s default
spring config. Round-4 snap heights `[15dvh, 50dvh, 75dvh]` translate
to `snapPoints={['15%', '50%', '75%']}` (gorhom accepts percentage
strings).

### 3.9 Root layout

Web: `min-h-[100dvh]` (not `min-h-screen`).

Native: `flex: 1` on `<View>` + `<SafeAreaProvider>` wrapping the app
shell. The `100dvh` problem (mobile address-bar resize) does not exist
on native. Replace token: `mobile/src/design-system/layout.ts` exports
`rootStyle = { flex: 1 }`.

**Edge-to-edge display (Android 15 default):** opt in via
`app.json` `android.statusBar.translucent: true` + `expo-system-ui`
status-bar style sync. Use `useSafeAreaInsets()` for content padding.
This **is** a new native-only concern — flagged as
`native-edge-to-edge-strategy` for Phase 2 verification.

---

## 4. New native-only tokens (gap analysis)

Web has no equivalent — extending the system, not replacing it. Every
new token is `native-` prefixed in TS exports.

| New token | Why it has no web equivalent | Default value |
|---|---|---|
| `native-haptic-selection` | No web Haptic API consistent on Android Chrome | `Haptics.selectionAsync()` |
| `native-haptic-light` | Same | `Haptics.impactAsync(Light)` — Bay tap, snap-point change |
| `native-haptic-medium` | Same | `Haptics.impactAsync(Medium)` — Navigate CTA tap, destination set |
| `native-elevation-*` (see §3.5) | CSS box-shadow doesn't translate 1:1 to Android elevation | integer scale 1–12 |
| `native-ripple-color` | Web has no Material ripple | `rgba(53, 51, 140, 0.12)` (brand at 12%) |
| `native-status-bar-style` | Web app doesn't control OS status bar | `auto` (light/dark per theme); `dark-content` on light, `light-content` on dark |
| `native-status-bar-bg` | Edge-to-edge means the bar is transparent over content | `transparent` (Android 15 default) |
| `native-system-nav-bar-bg` | Bottom system gesture bar on Android | Tab-bar bg color (white / surface-dark-secondary) |
| `native-back-gesture-edge-exclusion` | Android back gesture conflicts with horizontal swipes | not used on round-4 spec — sheet is vertical only. Document for Phase 2. |
| `native-tab-bar-height` | Round 4 spec 56px; Material 3 default 80dp — OQ-A5 resolved | 56 |

---

## 5. State flow — token lookup paths

```
Component (.tsx)
   │
   ├── uses NativeWind classes  ──▶ tailwind.config.js theme
   │                                    │
   │                                    └── ports MASTER.md colors,
   │                                        sizes, spacing, radius
   │
   ├── imports runtime token   ──▶ src/design-system/*.ts
   │                                    │
   │                                    ├── colors.ts   (status bar, splash)
   │                                    ├── elevation.ts(Android elevation int)
   │                                    ├── haptics.ts  (expo-haptics wrappers)
   │                                    ├── motion.ts   (Reanimated timings)
   │                                    ├── zIndex.ts   (modal style overrides)
   │                                    └── focus.ts    (useFocusRing hook)
   │
   └── uses native module     ──▶ expo-haptics, expo-font, etc.
```

---

## 6. Edge cases

| Condition | Behavior | Where handled |
|---|---|---|
| Font load fails (e.g. corrupted asset) | Splash held; surfaces an error toast after 10s timeout | `App.tsx` `useFonts` error path |
| User toggles system dark mode while app is open | `useColorScheme()` re-render swaps tokens; no manual reload | NativeWind v4 built-in |
| Reduced motion enabled mid-session | `AccessibilityInfo` `change` listener re-renders animated components | `usePulseRing` + `useReducedMotion` hook port |
| Edge-to-edge means content under status bar | All top-level screens use `useSafeAreaInsets().top` padding | Layout primitive in `mobile/src/components/Screen.tsx` (Phase 2) |
| Display cutout (notch on Android) | `useSafeAreaInsets()` covers both notch and gesture bar | `react-native-safe-area-context` handles both |
| RTL locale (e.g. ar-AU) | Out of scope for v1 — Melbourne CBD app, en-AU only | Flagged, not implemented |
| High-contrast / large-font Android accessibility settings | Inter scales via OS text scale; layouts must accommodate | Test as part of acceptance criteria §10 |

---

## 7. Test cases

Tests live at `mobile/src/design-system/__tests__/*.test.ts(x)`,
runner `jest` + `@testing-library/react-native`.

1. `tailwind.config.js` resolves `bg-brand` to `#35338c`.
2. `tailwind.config.js` resolves `text-status-good` to `#15803d`.
3. Dark mode: `dark:bg-surface-dark` resolves to `#111827`.
4. `colors.ts` constants match the Tailwind theme exactly (snapshot).
5. `elevation.ts` `card` returns 1, `sheet` returns 8.
6. `zIndex.ts` `tabBar` returns 490.
7. `haptics.ts` `light()` calls `Haptics.impactAsync` with `Light` enum.
8. `haptics.ts` is no-op when haptics permission is denied.
9. `motion.ts` `pulseRing` returns expected Reanimated value when motion not reduced.
10. `motion.ts` `pulseRing` returns static value when `AccessibilityInfo.isReduceMotionEnabled === true`.
11. `useFocusRing` returns visible style when `focused && !pressed`.
12. Inter font config registers all 5 weights with `expo-font`.
13. Snapshot test: rendering a `<View className="bg-brand p-4 rounded-lg">` matches `{backgroundColor:'#35338c', padding:16, borderRadius:8}`.
14. minSdk-26 platform constants exposed in `app.json` correctly read at runtime.

---

## 8. Dependencies

Phase 0 only. No Phase-1 dependencies on Phase-2/3/4/5 work.

External deps to install (locked at planning time):

| Package | Version pin | Purpose |
|---|---|---|
| `expo` | ~51 | SDK |
| `nativewind` | ^4 | Tailwind on RN |
| `tailwindcss` | ^3.4 | NativeWind peer |
| `react-native-reanimated` | ^3 | Animation engine |
| `react-native-gesture-handler` | latest | Gesture base for sheet |
| `react-native-safe-area-context` | latest | Safe-area + cutout |
| `expo-font` | latest | Inter loading |
| `expo-splash-screen` | latest | Hold splash during font load |
| `expo-haptics` | latest | Haptic tokens |
| `expo-system-ui` | latest | Status bar + nav bar color sync |
| `@gorhom/bottom-sheet` | ^4 | Sheet primitive (consumed by Phase 2) |

---

## 9. Open questions (deferred to Phase 2 or beyond)

| Tag | Question |
|---|---|
| `native-tablet-layout` | Tablet (>= 600dp width) — same one-pane layout or split? Out of scope v1. |
| `native-foldables` | Foldable devices — adaptive layout. Out of scope v1. |
| `native-themed-icons` | Android 13+ themed app icons (tinted monochrome). Defer to Phase 1 asset doc. |
| `native-large-fonts` | Behavior at 200% Android system text scale — verify in acceptance, but no token-level mitigation planned beyond ensuring no fixed heights on text containers. |
| `native-color-blind-palette` | Existing `useAccessibility.js` color-blind palette — port unchanged to Phase 2. Tokens already in MASTER.md (status only); no new tokens needed. |

---

## 10. Effort estimate

| Sub-phase | Scope | Dev-days |
|---|---|---|
| 1.A | Expo project bootstrap + NativeWind + Reanimated + safe-area wiring | 0.5 |
| 1.B | Tailwind theme port (`tailwind.config.js` + dark mode wire) | 0.5 |
| 1.C | Runtime token files (`colors`, `elevation`, `haptics`, `motion`, `zIndex`, `focus`) | 0.5 |
| 1.D | Inter font bundling + splash-screen hold | 0.25 |
| 1.E | Tests (14 cases above) | 0.5 |
| 1.F | Asset pipeline (sibling doc) | 0.75 |
| **Phase 1 total** | | **~3 dev-days** |

Phase 1 is light because **most of MASTER.md ports verbatim**. The real
labor is Phase 2's component migration.

---

## 11. Risk register (top 3)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| NativeWind v4 has a parsing edge case for an exotic Tailwind class used in `MASTER.md` (e.g. arbitrary values like `text-[11px]`) | Low | Low | NativeWind v4 supports arbitrary values; spike day-1; fallback is to use `StyleSheet.create` for the affected component (escape hatch, not architectural change) |
| Inter font loading delays first-paint | Low | Medium | Splash held until load; users see brand splash, not flash of system font |
| Dark mode swap on theme change misses a hard-coded hex | Medium | Low | Snapshot test 4 + the ban from MASTER.md anti-pattern #4 catch this; Phase 2 lint rule (`eslint-plugin-tailwindcss`) blocks raw hex in components |

---

## 12. Acceptance criteria

- [ ] `npx expo start --android` boots the app on Android emulator (minSdk 26) and renders a placeholder screen using `bg-brand` + Inter font.
- [ ] All MASTER.md `§Semantic Color Palette` rows resolvable via NativeWind class (`bg-status-good`, etc.) — verified by tests §7 1–4.
- [ ] Dark mode toggle (system + user override) swaps surface tokens correctly — verified by test §7 3.
- [ ] Inter loaded at all 5 weights — verified by test §7 12 and visible in placeholder screen.
- [ ] `expo-haptics` callable; placeholder button triggers `Light` impact — test §7 7.
- [ ] Reduced-motion respected — toggling Android Talkback's "Remove animations" yields static ring in placeholder.
- [ ] No hard-coded hex anywhere outside `colors.ts` and `tailwind.config.js` — verified by grep CI check.
- [ ] Edge-to-edge: app draws under transparent status bar; content respects `useSafeAreaInsets().top`.
- [ ] All 14 unit tests pass.

---

## 13. Review gate

Reviewer checks before approving Phase 1 → Phase 2:

1. `mobile/tailwind.config.js` matches every MASTER.md row 1:1. No
   silent renames, no skipped tokens.
2. New `native-*` tokens are listed with **rationale**, not just
   defined.
3. NativeWind dark variant works on at least 3 sample components
   (placeholder screens).
4. Inter loads on cold start without flash of fallback.
5. No iOS-only Expo modules pulled in (`expo-haptics` is
   cross-platform — accept; reject any iOS-specific package).
6. `app.json` `minSdkVersion = 26`, `package = "app.melopark"`,
   `scheme = "melopark"`.
7. Asset pipeline doc (`native-asset-pipeline.md`) submitted alongside
   this one.
8. No code beyond `mobile/` directory — `frontend/` untouched.
