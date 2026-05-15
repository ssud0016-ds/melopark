# Native Rollout Plan — Phase 5

> Final phase. MVP scope (separate doc), web-app fate, beta plan, launch
> plan, timeline, per-phase build order. For a developer who wasn't in
> the planning conversation.

---

## 1. Goal

Take the planned native app from "Phase 0 complete" to "v1 live on
Play Store" within the FIT5120 S1 2026 semester. Decide what ships,
in what order, on what schedule, with what success criteria.

## 2. Scope

**In:** MVP cut, web-app fate, beta plan, launch plan, semester
timeline, per-phase build order, review checkpoints, analytics events.

**Out:** post-launch roadmap (v2 candidates listed but not planned),
marketing campaign details.

## 3. MVP scope summary

Detailed in `docs/native-mvp-scope.md`. Headline:

**In v1:** map (live + planning), bay detail sheet, search +
autocomplete, planning mode (Arrive by), Predictions screen, settings
sheet (theme, accessibility, maps provider), onboarding (3 steps),
Epic 7 Navigate-to-Bay (Google + Browser fallback), App Links,
haptics, offline banner, dark mode, color-blind palette.

**Out of v1 (v2 candidates):** push notifications, biometric quick-pin,
saved-bays feature, walk-mode wayfinding screen, widgets, Wear OS,
tablet layout, Apple Maps support (N/A under Android-only anyway).

## 4. Web app fate

**Recommend: keep web app live as the desktop / non-Android fallback.**

Rationale:
- Backend serves both; zero incremental backend cost.
- Vercel free tier covers expected traffic.
- iOS users + desktop users have no other option (Android-only native scope).
- Web app already works; sunsetting it for no reason loses users.

Maintenance plan: web app receives **bug fixes only** during native
build. Feature parity is a non-goal — native is the product going
forward.

Open question (post-launch): if native adoption is strong, evaluate
retiring the web app's mobile-viewport behavior (redirect mobile
browsers to Play Store listing).

## 5. Beta plan — Play Internal Testing

| Item | Value |
|---|---|
| Track | Play Internal Testing (up to 100 testers) |
| Tester pool | Team FlaminGO (4) + FIT5120 cohort volunteers (~15) + external Melbourne drivers via student networks (~10) |
| Tester onboarding | Single Play Store opt-in link emailed; testers install via Play Store directly |
| Duration | 2 weeks minimum |
| Feedback channel | GitHub issue template + a Google Form (low-friction for non-dev testers) |
| Telemetry | Analytics shim counters (Epic 7 + tab switches + bay taps); aggregate counts only |
| Crash/ANR monitoring | Play Console Pre-launch Report + Vitals dashboard |

**Beta success criteria (graduating to public release):**

- Zero unhandled crashes in last 7 days (Play Vitals).
- ANR rate < 0.5% (Play Vitals).
- At least 10 testers report successful core flow (map → tap bay → read verdict → close).
- At least 3 testers complete Navigate-to-Bay flow with Google Maps installed.
- TalkBack screen-reader walkthrough: at least one tester (or team member) confirms core flow accessible.
- No P0 / P1 bugs open in tracker.
- One full session at SNAP_FULL → tab bar covered → drag down → tab bar restored (verified behavior).

## 6. Launch plan

| Item | Value |
|---|---|
| Geography | **Australia only** for v1 (per Phase 4 §7 OQ). Expand to NZ post-launch if Play Vitals stable for 4 weeks. |
| Distribution | Public Production track on Play Store |
| Roll-out | **Staged: 20% → 50% → 100% over 7 days.** Halt + rollback if Vitals regress. |
| Marketing minimums | Play Store listing only for v1. Posts on Monash FIT5120 channel + 1 Reddit /r/melbourne post. No paid acquisition. |
| Support | Single contact email; turnaround 48h |
| Analytics events to track v1 | `app.open`, `map.bay.tap`, `nav.navigate.tap`, `nav.walk.tap`, `nav.tab.switch`, `search.destination.set`, `settings.theme.changed`, `settings.maps_provider.changed`, `predictions.opened`, `onboarding.step.completed` |

## 7. Semester timeline (FIT5120 S1 2026)

Assume ~14 weeks remaining at Phase 0 sign-off. Single developer
primary; second dev pair-programs map screens.

| Week | Phase | Deliverables | Review gate |
|---|---|---|---|
| 1 | Phase 1A | Expo bootstrap + NativeWind + Reanimated + safe-area | App boots on Android emulator |
| 1 | Phase 1B–F (parallel) | Token files, Inter loading, asset pipeline draft | Placeholder screen with brand tokens renders |
| 2 | Phase 2A | **Map spike (3-day budget)** | Map library locked |
| 2 | Phase 2B + 2C | Navigation graph + hook ports | Hooks pass parity tests |
| 3 | Phase 2D | Map screen + clustering + markers + bay select | 3000 markers ≥60 FPS on Pixel 6a |
| 4 | Phase 2E | BusyNow vector segments + popup-as-sheet | Vector parity confirmed |
| 5 | Phase 2F | BayDetailSheet + verdict + nav actions | Round-2 sheet hierarchy preserved |
| 6 | Phase 2G + 2H | Search bar + autocomplete + settings sheet | Round-3+4 chrome verified |
| 7 | Phase 2I + 2J | Onboarding + Predictions screen | Onboarding pulse-ring states correct |
| 8 | Phase 2K + 2L + 2M | Tab-bar↔sheet stacking, banners, tests | Phase 2 acceptance §15 met |
| 9 | Phase 3 | Haptics, location, App Links, lifecycle, NetInfo | Phase 3 acceptance met |
| 10 | Phase 4A | Play Console org + identity verification (kick off early — has 2-day wait) | Identity verified |
| 10 | Phase 4B | EAS production build + listing copy + screenshots | Internal testing AAB uploaded |
| 11 | Beta start | Tester recruitment + first internal track release | ≥10 testers installed |
| 12 | Beta iteration | Bug fix passes + EAS Updates for JS-only patches | Vitals clean |
| 13 | Beta close | Graduation criteria met (§5) | Production submission prepared |
| 14 | Launch | 20% → 50% → 100% staged roll-out | Vitals stable through week-end |

Total: ~14 weeks. Honest: weeks 6–8 are the highest-risk band (component density). Buffer in week 13 absorbs Play review delay (1–7 days first submission).

## 8. Per-phase build order (recommended)

Why this order:

1. **Phase 1 first.** Phase 2 component map depends on tokens existing.
2. **Phase 2 spike before Phase 2 implementation.** Map library decision gates ~30% of Phase 2 LOC.
3. **Phase 2C (hooks) runs in parallel with 2B (navigation).** Hooks don't depend on screens.
4. **Phase 2D (map) before 2E (busynow).** Vector layer needs map host.
5. **Phase 2F (bay detail) before 2H (settings).** Settings sheet reuses sheet primitive proven in BayDetailSheet.
6. **Phase 3 (capabilities) runs **after** Phase 2** because haptics, location, deep linking IN need real screens to bind to.
7. **Phase 4A (Play Console identity) runs **in parallel with late Phase 2** because it has a 2-day Google-side wait. Start it week 10 earliest, week 9 ideally.
8. **Phase 4B (listing + AAB) after Phase 3 complete.** Listing needs final screenshots.
9. **Phase 5 (rollout + beta) after Phase 4 submission accepted to internal track.**

Review-gate checkpoints — pause for sign-off:

- End of Phase 1: design-system port reviewed.
- End of Phase 2 spike (day 3 of week 2): map library committed.
- End of Phase 2: full feature parity demonstrated on emulator.
- End of Phase 3: native capabilities verified on physical device.
- End of Phase 4: Play Console submission packaged.
- End of beta: graduation criteria met.

## 9. Effort estimate — cumulative

| Phase | Days |
|---|---|
| 1 | ~3 |
| 2 | ~27 |
| 3 | ~4 |
| 4 | ~4.5 (+ 2 calendar wait days) |
| 5 | ongoing through beta (~10 calendar days, ~2 dev-days for fixes) |
| **Total dev-days** | **~40 dev-days** |
| **Calendar** | **~14 weeks** matching semester |

## 10. Risk register (top 5 program-level)

| Risk | L | I | Mitigation |
|---|---|---|---|
| Map spike fails day 3, forces Mapbox migration mid-Phase 2 | Medium | High | Hard budget; Mapbox is config-plugin install, not rewrite |
| Phase 2 weeks 6–8 slip — too much UI in one band | High | High | Pair-program; ruthless on round-4 parity (no scope creep) |
| Play Console identity verification stalls launch | Medium | High | Start week 9 (1 week early); Monash legal in the loop |
| Beta surfaces a P0 crash 3 days before launch | Medium | High | EAS Update path for JS-only fixes; staged roll-out catches it at 20% |
| Privacy policy not approved by Monash legal in time | Medium | High | Draft week 9; review week 10; published week 11 |

## 11. v2 candidates (post-launch backlog)

Listed for traceability; not planned now.

- Push notifications: arrival-window reminders, trap-warning alerts (requires backend FCM endpoint — closed in `native-open-questions.md` D4)
- Saved bays / favorites
- Walking-mode dedicated screen (Epic 7 Walk → step-by-step)
- Tablet layout (>= 600dp)
- Wear OS companion
- iOS port (if web-app analytics show strong iOS demand; pivot then)
- Themed app icon (Android 13+ monochrome)
- Sentry crash reporting
- Firebase Analytics or PostHog (replace local shim)

## 12. Acceptance — Phase 5 complete

- [ ] App live on Play Store at 100% Australia roll-out.
- [ ] Play Vitals stable: crash-free users ≥99%, ANR rate <0.5%.
- [ ] At least 50 installs.
- [ ] At least 5 user-feedback items collected via support email.
- [ ] Web app remains live and unaffected.
- [ ] All round 1–4 UX outcomes verified on physical Android device (Pixel 6a or equivalent).
- [ ] Source code archived in git with `v1.0.0` tag.

## 13. Review gate — final

Project closes when:

1. Play Vitals green for 14 consecutive days post-launch.
2. v2 backlog filed in tracker.
3. Web app maintenance owner identified (likely same team during semester; defer post-semester).
4. Post-mortem doc written: what worked, what didn't, what to do differently for v2.
