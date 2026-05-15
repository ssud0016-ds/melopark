# Native UX Parity Check

> Verifies every UX outcome from rounds 1–4 is preserved or improved
> by the native plan. Anything that regresses justified explicitly.

---

## Round 1 — P-IDs

| P-ID | Issue | Web resolution | Native status | How preserved |
|---|---|---|---|---|
| **P1** | Header overlap | TopBar offset fix | **Improved** | No TopBar on mobile native. Search bar floats with safe-area-top inset; map bleeds edge-to-edge under translucent status bar |
| **P2** | Cluster integers | Integer-only labels | **Preserved** | `react-native-map-clustering` `pointCount` rendered as integer (or chosen Mapbox cluster expression in fallback) |
| **P3** | Scope strip overload | `[Live now] [Filters ▾]` simplified | **Preserved** | Same chip set, anchored above tab bar via `bottom: 56 + 15dvh + 12` analogue |
| **P4** | Sheet card repetition | YOUR PICK consolidated into sheet | **Preserved** | `BayDetailSheet` keeps round-2 hierarchy |
| **P5** | Three names for one concept | "Good chance / Getting busy / Hard to park" unified | **Preserved** | Same copy tokens reused |
| **P6** | Onboarding does too much | Arrive-by + chips removed Step 1 | **Preserved + Improved** | Real search bar with Reanimated pulse-ring; reduced-motion guard via `AccessibilityInfo` |
| **P7** | Date formats | Locale-aware "Today, dd/mm/yyyy" | **Preserved** | `Intl.DateTimeFormat` works on RN |
| **P8** | Predictions dashboard-y | Collapsed sections | **Preserved** | Same expand-on-tap pattern; `FlatList` for busiest list |
| **P9** | Color semantics | Status / segment / chrome separation | **Preserved** | NativeWind theme enforces it; raw hex banned outside `colors.ts` |
| **P10** | Sheet snap points | SNAP_PEEK / HALF / FULL | **Preserved** | `@gorhom/bottom-sheet` `snapPoints={['15%','50%','75%']}` |

## Round 2 — A/B/C/E IDs

| ID | Issue | Web resolution | Native status |
|---|---|---|---|
| **A1** | Coach tip too loud | `?` in legend footer | **Preserved** |
| **A2** | Two banners stacked | Zoom hint gated | **Preserved** |
| **A3** | Floating panel count | Reduced | **Improved** — fewer floating panels on native (no desktop chrome to worry about) |
| **B1** | Green destination card | Removed | **Preserved** |
| **B2** | Subtitle mislabel | Pressure context | **Preserved** |
| **B3** | Street name truncation | 1-line ellipsis | **Preserved** — `numberOfLines={1}` |
| **C1** | TARGET AREA weight | Collapsed | **Preserved** |
| **C2** | Data freshness pills | Behind `ⓘ` | **Preserved** |
| **C3** | Rules timestamp in live mode | Amber + planning only | **Preserved** |
| **E1** | SNAP_PEEK 15dvh | 0.15 | **Preserved** — `snapPoints[0] = '15%'` |

## Round 3 — cleanup decisions

| Item | Web decision | Native status |
|---|---|---|
| Issue 1 — ⚙ visibility when destination set | Dynamic-width input; ⚙ + ✕ always visible | **Preserved** — TextInput flex-1; cog + clear both rendered |
| Issue 2 — Predictions page top bar behavior | Routes to Map page | **Preserved** — `navigation.navigate('MapScreen', {focusSearch: true})` |
| Polish 1 — pulsing ring stop conditions | Three states (load / first-tap / selected) | **Preserved** — Reanimated state machine; reduced-motion skips to static |
| Polish 2 — SVG icons | No emoji structural icons | **Preserved** — `react-native-svg` |
| Polish 3 — safe-area math | `max(8px, env(safe-area-inset-top))` | **Improved** — `useSafeAreaInsets()` returns real device inset including display cutout API |
| Round-3 Settings consolidation | ⚙ → Settings sheet | **Preserved** |
| Round-3 Onboarding real search bar | Pulse-ring on real top bar | **Preserved** |

## Round 4 — tab bar pattern

| Element | Web spec | Native status |
|---|---|---|
| Floating pill removed | yes | **Preserved** — no pill component |
| Bottom tab bar | 56px, 2 tabs | **Preserved** — `@react-navigation/bottom-tabs` height override 56 (OQ-A5) |
| Tab 1 Live Map | location-pin SVG | **Preserved** |
| Tab 2 Predictions | bar-chart SVG | **Preserved** |
| Active indicator | brand color + filled icon (no pill) | **Preserved** — Material 3 default indicator pill disabled |
| Visible at SNAP_PEEK | yes | **Preserved** |
| Visible at SNAP_HALF | yes | **Preserved** |
| Covered at SNAP_FULL | yes; drag down restores | **Preserved** — `tabBarStyle.display` toggled via Reanimated `useAnimatedReaction(animatedIndex)` |
| Scope strip above tab bar | `calc(56px + 15dvh + 12px)` | **Preserved** — absolute position with safe-area inset added |
| Tab bar z-index 490 | below sheet (550) | **Preserved** |

## Epic 7 — Navigate to Bay

| AC | Web plan | Native status |
|---|---|---|
| 7.1.1 Navigate launches saved provider | yes | **Preserved + Improved** — `Linking.canOpenURL` reliable, drop iframe heuristic |
| 7.1.2 First-tap chooser | yes | **Preserved** — `BottomSheetModal` chooser |
| 7.1.3 Web fallback on unsupported | yes | **Preserved** |
| 7.1.4 Hide button on invalid bay coords | yes | **Preserved** |
| 7.2.1 / 7.2.2 / 7.2.4 chooser behavior | yes | **Preserved** |
| 7.2.3 Settings-row edits provider | yes | **Preserved** — `MapsProviderSettingRow` in `SettingsSheet` |
| 7.3.1 Walk to destination | yes | **Preserved** |
| 7.3.2 Hidden when no destination | yes | **Preserved** — muted note instead |
| 7.3.3 Walk web fallback | yes | **Preserved** |

**Native delta:** Apple Maps option **dropped** from chooser (Android-only; Apple Maps not present on Android). Chooser shows Google + Browser. Documented in `native-capabilities.md` §3.4.

## MASTER.md tokens

| Token group | Native status |
|---|---|
| Status palette (good/caution/avoid/unknown) | **Preserved** — NativeWind theme |
| Chrome palette (brand / brand-light / accent / surface) | **Preserved** |
| Dark mode swaps | **Preserved** — `dark:` variants via `useColorScheme()` |
| Typography (Inter, 6 roles) | **Preserved** — `expo-font` loads all 5 weights; ramp ports verbatim |
| Spacing (4px grid) | **Preserved** — Tailwind passthrough |
| Touch targets (44dp min) | **Preserved** — runtime helper + manual review |
| Shadows | **Adapted** — mapped to Android `elevation` integer scale (documented gap, not regression) |
| Z-index scale (pill/scope-strip/sheet/settings/search-bar) | **Preserved** + new `native-tab-bar = 490` |
| Animation tokens (pulse-dot, pulse-ring) | **Preserved** — Reanimated; reduced-motion guard |
| Focus states | **Adapted** — `useFocusRing` + TalkBack equivalents |
| Root layout `min-h-[100dvh]` | **N/A** — `flex: 1` + SafeAreaProvider equivalent |

## New native-only additions (not regressions, extensions)

- Haptic intensity tokens (`native-haptic-*`) — no web equivalent.
- Material elevation values — replace web `box-shadow` on Android.
- Material ripple color — Android pressed-state convention.
- Edge-to-edge insets — Android 15 system-bar transparency.
- System nav bar color sync — Android gesture-bar zone.

All documented in `native-design-system-port.md` §4.

## Regressions

**None identified.** Every preserved/improved column above marks the
native plan as meeting or exceeding the web outcome. Two adaptations
documented (shadows → elevation; focus → TalkBack + ring hook) preserve
intent under platform constraints.

If implementation reveals a regression: file in `native-open-questions.md`,
revise plan, do not silently regress.

## Acceptance — parity verified when

- [ ] Every P-ID, A/B/C/E ID, Round 3 cleanup, Round 4 element, Epic 7 AC checked on the implemented build.
- [ ] Manual side-by-side comparison of web vs native at each preserved row.
- [ ] Any adaptation documented with rationale (already done above for shadows + focus).
- [ ] TalkBack walkthrough completes core flow (open map → tap bay → read verdict → close).
- [ ] Color-blind palette verified across all status surfaces.
- [ ] Dark mode swap verified on every surface listed in MASTER.md.
- [ ] No round-4 pill component in the build; tab bar is the only nav primitive.
