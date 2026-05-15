# Native Store Submission — Phase 4

> **Play Store only.** Apple App Store / TestFlight / nutrition labels
> N/A under Android-only scope. Planning doc only.

---

## 1. Goal

Produce a complete Play Console submission for MelOPark v1: signed AAB,
listing metadata, Data Safety form, screenshots, privacy policy, and
Play Internal Testing track for beta. Submission-ready, not yet
submitted.

## 2. Scope

**In:** package name, signing, Play Console entries (descriptions,
screenshots, feature graphic), Data Safety form, target API level,
adaptive icon, Play Internal Testing setup, privacy policy hosting.

**Out:** App Store anything. Public release (Phase 5). Marketing campaign.

## 3. Tasks

### 3.1 Identifiers + signing

| Item | Value |
|---|---|
| Package name | `app.melopark` (locked at first publish — irreversible) |
| App name | MelOPark |
| App category | Maps & Navigation |
| Signing | Play App Signing (Google manages upload key; EAS Build generates upload keystore stored in EAS Secrets) |
| Upload key | EAS-generated; backed up to team-shared 1Password vault |
| Versioning | `versionCode` = monotonic int (auto via EAS); `versionName` = semver (e.g. `1.0.0`) |

### 3.2 Build configuration

| Item | Value |
|---|---|
| `targetSdkVersion` | 35 (Android 15) — must meet Play's annual target API floor |
| `minSdkVersion` | 26 (Android 8) — D1 resolution |
| `compileSdkVersion` | 35 |
| Build type | AAB (Android App Bundle) — required by Play since 2021 |
| Build command | `eas build --platform android --profile production` |
| Output | `.aab` artifact, downloadable from EAS dashboard |

EAS profile `production` in `eas.json`:
```
{
  "production": {
    "android": {
      "buildType": "app-bundle",
      "autoIncrement": true
    }
  }
}
```

### 3.3 Adaptive icon + Play Store icon

From `docs/native-asset-pipeline.md` §3.1, §3.3. Pre-built before submission:

- Adaptive icon foreground: `mobile/assets/icon/adaptive-foreground.png` (1024×1024)
- Adaptive icon background: `#35338c` solid
- Play Store icon: `mobile/assets/icon/play-store-icon.png` (512×512, 32-bit PNG, ≤1MB)

### 3.4 Listing metadata

| Field | Constraint | Content (draft) |
|---|---|---|
| App name | ≤30 chars | "MelOPark — Find Parking Melbourne" (33 → trim to "MelOPark: Find Parking Melb") |
| Short description | ≤80 chars | "Find on-street parking in Melbourne CBD. Live bays, rules, predictions." (74) |
| Full description | ≤4000 chars | Draft below (§3.5) |
| App category | — | Maps & Navigation |
| Tags | — | parking, melbourne, cbd, maps, navigation |
| Content rating | IARC questionnaire | Likely "Everyone" — no UGC, no ads, no purchases |
| Contact email | — | team-flamingo email (set up before submission) |
| Website | — | https://melopark.app |
| Privacy policy URL | required | https://melopark.app/privacy (hosted via Vercel; content owner: team) |

### 3.5 Full description (draft, ~600 chars)

```
MelOPark answers one question: can I park here, now, for my planned stay,
and what rules apply?

Live map of Melbourne CBD on-street parking, with sensor-backed bay
occupancy and rule-aware legality checks. Tap any bay to see "Good /
Caution / Avoid", plus the exact restriction that applies. Set an arrival
time to see how the map looks at that moment — trap rules that start
during your stay are flagged.

Built for Melbourne drivers. Uses City of Melbourne open data. No ads,
no tracking, no purchases.

Source data: City of Melbourne Open Data (CC BY).
```

Refine before submission with team.

### 3.6 Screenshots

5 phone screenshots. Capture from Pixel 6a emulator (matches Phase 2
reference device).

| # | Screen | Capture |
|---|---|---|
| 1 | Onboarding Step 0 | Hero "Welcome to MelOPark" |
| 2 | Map default | Markers, scope strip, sheet at SNAP_PEEK |
| 3 | Map destination set | Destination pin, YOUR PICK card, sheet at SNAP_HALF |
| 4 | BayDetailSheet open | Verdict + limits + Navigate CTA visible |
| 5 | Predictions screen | Bar chart + "Show forecast & zone detail" |

Resolution: 1080×2400 (Pixel 6a portrait). Format: PNG or 24-bit JPG.

File path: `mobile/assets/marketing/screenshot-{01..05}.png`.

### 3.7 Feature graphic

1024×500 PNG, no alpha. Content: brand mark + tagline "Stop circling.
Start parking." on brand-purple background. File:
`mobile/assets/marketing/feature-graphic.png`.

### 3.8 Data Safety form (Play Console)

Required for every app since 2022. Declare exactly what's collected.

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** (location, app activity counters from analytics shim) |
| Is data collected encrypted in transit? | **Yes** (HTTPS only) |
| Can users request deletion? | **No personal data stored** — analytics counters are aggregate. State this in privacy policy. |
| **Location** | Collected: approximate + precise. Purpose: app functionality (map centering). Optional: yes (user can deny). Shared with third parties: no. |
| **App activity** | Collected: in-app interactions (Navigate-CTA tap counts). Purpose: analytics. Optional: no. Shared: no. |
| **App info and performance** | Collected: crash logs (if Sentry adopted; otherwise none). Purpose: app functionality. |
| **Device or other IDs** | Not collected. |
| **Personal info** | Not collected. |
| **Financial info** | Not collected. |

### 3.9 Privacy policy

Required URL. Must be live before submission. Hosted at
`https://melopark.app/privacy` on Vercel.

Required content:
- Identity of data controller (Team FlaminGO / Monash University)
- What is collected (location, anonymous usage counters)
- Purpose (map centering, product improvement)
- Retention (location not stored; counters aggregate)
- Sharing (none with third parties)
- User rights (deny location at OS level; uninstall to revoke)
- Contact email
- Effective date
- Source data attribution (City of Melbourne Open Data CC BY)

### 3.10 Permissions justification (Play Console "Permissions declaration")

| Permission | Justification |
|---|---|
| `ACCESS_FINE_LOCATION` | Centre map on user. Used only when user taps "centre on me". Not in background. |
| `ACCESS_COARSE_LOCATION` | Same purpose; fine + coarse declared together per Google guidance. |
| `INTERNET` | Fetch bay data from melopark API. |

No `ACCESS_BACKGROUND_LOCATION`, no `READ_PHONE_STATE`, no
`POST_NOTIFICATIONS`, no `READ_CONTACTS`, no storage permissions.

### 3.11 Play Internal Testing

Pre-launch beta channel.

| Item | Value |
|---|---|
| Track | Internal testing (up to 100 testers, no review delay) |
| Tester list | Email-list-based: team + invited Monash students + 5 external testers |
| Release upload | Same AAB as production track |
| Promotion to production | Manual after acceptance criteria met (Phase 5) |
| Feedback channel | GitHub issue template "Internal Tester Feedback" |

### 3.12 Pre-launch report

Play Console runs automated tests on uploaded AAB (Robo crawler on
several device profiles). Free; produces crash/ANR/perf reports.

Acceptance: zero crash, zero ANR, no policy violations.

## 4. Submission checklist

- [ ] Package `app.melopark` reserved on Play Console
- [ ] EAS production AAB built and signed
- [ ] Play App Signing enrolled
- [ ] Listing fields populated (name, short, full, category, tags, email, website)
- [ ] Privacy policy live at https://melopark.app/privacy
- [ ] Adaptive icon + Play Store icon uploaded
- [ ] Feature graphic uploaded
- [ ] 5 phone screenshots uploaded
- [ ] Data Safety form completed
- [ ] Permissions declaration completed (location justification)
- [ ] Content rating questionnaire submitted (IARC)
- [ ] App Content section: target audience, ads (none), news app (no), COVID-19 (no)
- [ ] Pricing: free
- [ ] Distribution: AU initially; AU + NZ for v1; expand post-launch
- [ ] App Links assetlinks.json hosted (Phase 3 deliverable)
- [ ] Internal testing track active with team + invited testers
- [ ] Pre-launch report green (no crash/ANR/policy issues)

## 5. Edge cases

| Condition | Behavior |
|---|---|
| Play Console reviews app for first-time submission | Up to 7 days; budget accordingly in Phase 5 timeline |
| Permission review escalation | Location-only with foreground justification rarely escalates; backup justification doc prepared |
| AAB exceeds Play 200MB base size | Currently estimated ~30–50MB; well within limits |
| Robo crawler flags accessibility issue | Fix → re-upload — no review penalty |
| Privacy policy URL 404 | Submission blocked at upload; verify URL works before clicking submit |

## 6. Effort

| Task | Days |
|---|---|
| Play Console org setup + identity verification | 0.5 (calendar; ~2 days wait for Google) |
| Package reservation + signing config | 0.25 |
| Listing copy draft + screenshot capture | 1.0 |
| Feature graphic design | 0.5 (designer) |
| Data Safety form completion | 0.5 |
| Privacy policy authoring + hosting | 1.0 (legal review with Monash) |
| Internal testing track setup + tester recruitment | 0.5 |
| Pre-launch report review + fixes | 0.5 |
| **Total** | **~4.5 dev-days + 2 calendar days wait** |

## 7. Open questions

| Tag | Question |
|---|---|
| `play-org-identity` | Play Console developer identity verification (passport/license) — who on the team is named? Monash legal sign-off? |
| `legal-policy-review` | Privacy policy needs FIT5120 supervisor / Monash legal review before publish |
| `analytics-truth-claim` | Data Safety claim "anonymous aggregate counters" must match reality. If Sentry / Firebase Analytics is adopted post-MVP, re-submit form. |
| `dist-geo-v1` | Launch AU only or AU + NZ from day one? Recommend AU only — keeps support surface narrow. |

## 8. Risk register

| Risk | L | I | Mitigation |
|---|---|---|---|
| Play Console identity verification stalls submission by 2+ weeks | Medium | High | Start identity flow week 1 of Phase 4 — runs in parallel with other tasks |
| Data Safety form mismatch with actual collection rejects submission | Low | Medium | Cross-check claims against code; document the analytics shim's exact behavior |
| Privacy policy URL not yet live at submit time | Medium | Medium | Block submission on this checklist row |
| App Links auto-verify fails after first install | Medium | Medium | Test on real device pre-submission; Google's digital-asset-links validator passes |

## 9. Acceptance

- [ ] AAB uploaded to Internal Testing track
- [ ] All listing fields populated, screenshots match latest UI
- [ ] Privacy policy URL returns 200
- [ ] Data Safety form submitted with no warnings
- [ ] Pre-launch report green
- [ ] At least 5 internal testers report successful install + core flow

## 10. Review gate

1. AAB inspected — no iOS-only frameworks bundled, no debug logging.
2. `versionCode` increments correctly across rebuilds.
3. Signing cert SHA-256 matches `assetlinks.json` published at melopark.app.
4. Privacy policy URL live + readable on mobile.
5. Permissions list in installed APK matches declared list — no extras.
6. Internal testers can install via Play Store Internal track link.
