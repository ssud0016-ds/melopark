# Native Asset Pipeline — Phase 1

> **Stack:** Expo (managed RN), Android-only, minSdk 26, targetSdk latest.
> Source logos already exist: `frontend/src/assets/logo/mobile-light.png`,
> `mobile-dark.png` (also referenced as `mobileLogoLight.png` /
> `mobileLogoDark.png` in repo root). Asset selection not blocked.

> **Planning doc only. No assets generated this iteration.**
> Sibling to `docs/native-design-system-port.md`.

---

## 1. Goal

Produce the complete Android asset set for first Play Store submission:
adaptive launcher icon, Play Store icon, splash screen, in-app SVG
versions of the brand mark, and feature graphic. All assets derive from
the existing brand mark + wordmark; no new visual design.

## 2. Scope

**In:**
- Adaptive icon (foreground + background, all densities).
- Play Store icon (512×512 separate asset).
- Android 12+ splash screen (icon-only, branded background).
- In-app SVG conversion of `mobile-light.png` / `mobile-dark.png`.
- Feature graphic (1024×500).
- Phone screenshot placeholder spec for Play Console.

**Out:**
- iOS icon matrix (Android-only scope).
- iOS launch storyboard (N/A).
- Tablet-specific screenshots (out of MVP unless tablet support added).
- Marketing site assets (separate effort).
- Themed icons (Android 13+ monochrome) — deferred, see §9.

## 3. Tasks

### 3.1 Adaptive launcher icon

Android 8.0+ (minSdk 26 satisfies this — no fallback needed). Two
layers composited by the launcher with shape, parallax, and
animation applied automatically.

**Spec:**

| Layer | Size (source) | Safe zone | Content |
|---|---|---|---|
| Foreground | 108dp × 108dp PNG (and/or vector drawable) | 72dp × 72dp centered | Brand `P` mark, **no wordmark**, transparent outside safe zone |
| Background | 108dp × 108dp solid fill | n/a | Brand purple `#35338c` solid (matches `--color-chrome`) |

**Files** (Expo config plugin generates densities; source files are
1024×1024 high-res PNGs OR a single vector drawable):

```
mobile/assets/icon/
├── adaptive-foreground.png      # 1024×1024 source, mark within central 683×683 safe zone
└── (background = solid color in app.json — no PNG needed)
```

`app.json` excerpt (no code in this iteration — schema only):

```
android.adaptiveIcon.foregroundImage = "./assets/icon/adaptive-foreground.png"
android.adaptiveIcon.backgroundColor = "#35338c"
```

Expo's prebuild step generates:

```
mobile/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp
mobile/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.webp
mobile/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.webp
mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.webp
mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp
mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
mobile/android/app/src/main/res/values/colors.xml  (ic_launcher_background = #35338c)
```

Designer hand-off note: the `P` mark must fit within the 72dp safe
zone — launchers crop to a circle / squircle / teardrop / etc. Anything
in the outer 18dp ring of the 108dp canvas may be clipped.

### 3.2 Legacy round icon (Android 7 — not in scope under minSdk 26)

**Skipped.** minSdk 26 means every device honors adaptive icons. No
`ic_launcher_round.png` fallback needed.

### 3.3 Play Store icon

Required by Play Console as a separate upload, **not** generated from
the adaptive icon.

| Property | Value |
|---|---|
| Size | 512 × 512 px |
| Format | 32-bit PNG, with alpha |
| Max file size | 1 MB |
| Content | Full brand lockup (mark + optional wordmark since Play Store renders this at large sizes) OR mark-on-purple matching the adaptive icon (consistency) |

File: `mobile/assets/icon/play-store-icon.png`. **Not bundled into APK.**
Uploaded directly to Play Console.

### 3.4 Splash screen (Android 12+ splash API)

Android 12 introduced a system-managed splash with strict constraints.
Configured via `expo-splash-screen` config plugin.

| Slot | Spec |
|---|---|
| Background color | `#35338c` (brand purple) |
| Icon | Centered drawable, 192×192dp logical size (system applies its own mask) |
| Icon background | Optional — solid brand color or transparent |
| Branded image (legacy splash) | Not used — Android 12+ ignores it |
| Animation | System default fade |

**No full wordmark lockup.** Android 12 splash API rejects wide marks;
icon-only is the platform requirement. Wordmark remains in-app on the
Settings → About row (per round-3 settings sheet spec).

`app.json` excerpt (schema only):

```
expo.splash.backgroundColor = "#35338c"
expo.splash.image = "./assets/splash/splash-icon.png"   # 1024×1024 source; rendered centered
expo.splash.resizeMode = "contain"
android.splash.dark.backgroundColor = "#111827"          # dark mode splash
android.splash.dark.image = "./assets/splash/splash-icon-dark.png"
```

Files:
```
mobile/assets/splash/
├── splash-icon.png       # 1024×1024, P mark, transparent bg, light theme
└── splash-icon-dark.png  # 1024×1024, P mark, transparent bg, dark theme
```

Splash held programmatically until Inter font loads (see
`native-design-system-port.md` §3.3).

### 3.5 In-app brand mark — PNG → SVG conversion

Current asset: PNGs at unknown resolution. Native apps render at
multiple densities; SVG / vector drawable scales without artifacts.

**Plan:**

1. Source the original brand mark (Figma or Illustrator). If only PNG
   exists, hand-trace in Figma (one-day designer task) — flagged in §9 OQ.
2. Export as SVG.
3. Convert to React Native via `react-native-svg`:
   - File: `mobile/src/components/common/LogoMark.tsx`
   - Replaces web `frontend/src/components/common/LogoMark.jsx`
   - Props: `variant: 'light' | 'dark'`, `size: number` (defaults 24)

Light vs dark variants — preserve current convention (light mark on
dark backgrounds, dark mark on light). The two PNG files map to two
SVG fill recipes; one SVG with a `fill` prop is also acceptable.

Wordmark stays in-app in the Settings → About surface only (no other
mobile screen displays it).

### 3.6 Feature graphic (Play Store listing)

| Property | Value |
|---|---|
| Size | 1024 × 500 px |
| Format | JPG or 24-bit PNG (no alpha) |
| Content | Brand mark + tagline ("Stop circling. Start parking.") on brand purple, or a map UI screenshot with branded chrome |
| Tagline source | Hero copy from `onboarding-split.md` Step 0 — "Stop Circling — Start Parking" |

File: `mobile/assets/marketing/feature-graphic.png`. Uploaded directly
to Play Console; not bundled in APK.

### 3.7 Phone screenshots (Play Console listing)

Play Console requires 2–8 phone screenshots. Defer creation to Phase 4
(store submission), but spec now:

| Property | Value |
|---|---|
| Aspect | 16:9 or 9:16 (portrait recommended for parking-app screenshots) |
| Size | Min 320px, max 3840px on the long edge |
| Format | JPG or 24-bit PNG |
| Count | 2 min, 8 max — recommend 5 covering: Onboarding Step 0, Map default, Map destination set, Bay detail sheet, Predictions |

Files: `mobile/assets/marketing/screenshot-{01..05}.png` (Phase 4 deliverable).

---

## 4. Sizing matrix — single source of truth

| Asset | Source size | Output paths | Generated by |
|---|---|---|---|
| Adaptive icon foreground | 1024×1024 PNG | `mipmap-{mdpi..xxxhdpi}/ic_launcher_foreground.webp` | Expo prebuild |
| Adaptive icon background | solid color | `values/colors.xml` | Expo prebuild |
| Play Store icon | 512×512 PNG | uploaded direct | designer |
| Splash icon (light) | 1024×1024 PNG | `drawable/splashscreen_logo.png` | `expo-splash-screen` |
| Splash icon (dark) | 1024×1024 PNG | `drawable-night/splashscreen_logo.png` | `expo-splash-screen` |
| Splash bg color | hex | `values/colors.xml`, `values-night/colors.xml` | `expo-splash-screen` |
| In-app `LogoMark` | SVG | bundled in JS | `react-native-svg` |
| Feature graphic | 1024×500 PNG | uploaded direct | designer |
| Phone screenshots | varies | uploaded direct | Phase 4 |

---

## 5. Edge cases

| Condition | Behavior |
|---|---|
| Launcher crops adaptive icon to circle on Pixel | Mark within 72dp safe zone → no clipping |
| Launcher applies teardrop mask on Samsung | Same — safe-zone respected |
| Device set to dark mode | `splash.dark.image` + `dark.backgroundColor` used |
| Android 13+ themed icons setting on | Currently no monochrome layer provided → device falls back to colored adaptive icon. Acceptable for v1; flagged §9. |
| User installs on Android 7 (below minSdk 26) | Play Store blocks install — adaptive icon legacy fallback unnecessary |
| Splash icon larger than 192dp safe zone | Android 12+ system masks it — content outside zone clipped (same constraint as adaptive icon) |

---

## 6. Test / verification cases

Not unit tests (assets aren't unit-testable in the conventional sense)
but a manual verification checklist for the Phase 1 reviewer.

1. Install APK on Pixel emulator (API 26) — launcher icon renders correctly under circular mask.
2. Install on Samsung emulator (API 33) — launcher icon renders under squircle mask.
3. Cold launch — splash screen shows brand purple bg + centered mark, no flash of white.
4. Cold launch in dark mode — splash uses dark background variant.
5. Switch system theme while app is running — `LogoMark` `variant` prop switches correctly.
6. Render `LogoMark` at size 16, 24, 48 — no aliasing or artifacts (SVG → vector path).
7. Upload Play Store icon to Play Console preview — renders correctly at 512×512.
8. Upload feature graphic — renders correctly without alpha bleed.
9. Splash bg color matches in-app `bg-brand` exactly (visual continuity from splash to first screen).
10. Adaptive icon foreground SVG / PNG: P mark sits within central 67% of canvas (72dp safe zone in 108dp canvas).

---

## 7. Dependencies

- `expo-splash-screen` (already listed in design-system port deps)
- `react-native-svg` (Expo first-class)
- Original brand mark vector source (Figma / Illustrator file). **If only
  PNG exists, designer task added — see §9.**

---

## 8. Open questions

| Tag | Question |
|---|---|
| `asset-source-vector` | Does Figma / Illustrator source exist for the brand `P` mark, or do we have only PNGs? If PNG-only, allocate designer time to vector-trace the mark for SVG export. **Default assumption:** PNG-only → ~0.5 day designer task added. |
| `asset-themed-icon` | Provide a monochrome layer for Android 13+ themed icons in v1? Recommend: **no** — round-mark looks fine in tinted form; revisit post-launch if user feedback requests it. |
| `asset-feature-graphic-content` | Feature graphic content: brand-mark-only vs UI screenshot? Recommend: branded with tagline. Defer final art to Phase 4 marketing prep. |
| `asset-store-listing-copy` | Short description (≤80 chars) + full description (≤4000 chars) — Phase 4 deliverable. |
| `asset-screenshot-source-device` | Capture screenshots on Pixel 6a emulator (matches Phase 2 perf reference device). Confirm at Phase 4. |

---

## 9. Effort estimate

| Sub-task | Owner | Effort |
|---|---|---|
| Vector-trace P mark (if PNG-only) | designer | 0.5 day |
| Export adaptive foreground 1024×1024 | designer | 0.25 day |
| Export splash icons (light + dark) | designer | 0.25 day |
| SVG conversion to `LogoMark.tsx` | dev | 0.25 day |
| Configure `app.json` (icon + splash) | dev | 0.1 day |
| Build feature graphic | designer | 0.5 day |
| Verification on Pixel + Samsung emulators | dev | 0.25 day |
| **Total** | | **~2 days (designer + dev combined)** |

Already counted within Phase 1 total (`native-design-system-port.md`
§10 sub-phase 1.F = 0.75 dev-days; designer time additive).

---

## 10. Risk register (top 3)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| No vector source for brand mark — only PNG exists | High | Low | Designer vector-traces in Figma (~0.5 day). Trivial because the mark is geometrically simple. |
| Splash icon clips on aggressive launcher masks | Low | Low | 72dp safe zone respected by spec; verified via §6 manual checks. |
| Themed icon absence flagged by Play Store review (unlikely) | Very low | Low | Themed icons are optional; Play Store does not require them. Add post-launch if user feedback demands. |

---

## 11. Acceptance criteria

- [ ] `mobile/assets/icon/adaptive-foreground.png` exists at 1024×1024 with P mark inside 72dp safe zone.
- [ ] `app.json` `android.adaptiveIcon.backgroundColor === "#35338c"`.
- [ ] `mobile/assets/icon/play-store-icon.png` exists at 512×512.
- [ ] `mobile/assets/splash/splash-icon.png` + `splash-icon-dark.png` at 1024×1024.
- [ ] `app.json` `expo.splash.backgroundColor === "#35338c"`.
- [ ] `mobile/src/components/common/LogoMark.tsx` renders crisply at sizes 16/24/48.
- [ ] `mobile/assets/marketing/feature-graphic.png` at 1024×500.
- [ ] All 10 manual verification checks pass on Pixel + Samsung emulators.
- [ ] No bundled iOS asset files. Only Android paths populated.

---

## 12. Review gate

Reviewer checks before approving Phase 1 sibling → Phase 2:

1. Adaptive icon renders correctly on **at least three** launcher mask
   shapes (circle, squircle, teardrop) — emulator screenshots in PR.
2. Splash transitions visually continuous into first app screen (no
   flash of white, no color shift) — recorded screen capture in PR.
3. `LogoMark.tsx` is the **only** in-app brand asset surface;
   wordmark used only in Settings → About.
4. No PNG bundled where SVG suffices.
5. Feature graphic + Play Store icon exist but are NOT in the APK
   (verify via APK inspector — they're listing assets only).
6. Asset paths under `mobile/assets/` consistent with directory
   structure in design-system port doc.
