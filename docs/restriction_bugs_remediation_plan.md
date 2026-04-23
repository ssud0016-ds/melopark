# Restriction translation — bug remediation plan

Plan of record for the nine bugs found in the 2026-04-22 audit of the
restriction translation feature (pipeline → DB → API → frontend). Grouped by
priority so the highest user-visible breakage is fixed first, and one fix per
PR so blast radius stays small.

**Status at 2026-04-23:** Bugs 1–8 have shipped. Bug 9 remains, gated on an
audit of the LZ/DP coverage gap.

Historical snapshot (pre-remediation): 12,442 `bay_restrictions` rows across
8,816 bays in RDS, 5,667 restriction rows present in gold parquet silently
dropped on load (77% of bays with fewer rows than source file).

Quick numbers from the 2026-04-22 verification run:
- 1,334 / 8,816 RDS bays (15.1%) appeared weekend-only; 694 of those (~52%)
  were confirmed artefacts of Bug 8, not genuine CoM-only-weekend data.
- Gold parquet had **zero** weekend-only bays — the entire weekend-only
  artefact was introduced at the gold → RDS load step.
- Root cause: `build_gold.py:578` deduplicated on `(bay_id, typedesc)` alone,
  collapsing all same-typedesc time windows to one row per bay. Fixed by
  extracting into `dedup_restrictions_for_db` with subset
  `(bay_id, slot_num, fromday, today, starttime, endtime)`.

---

## Fix order at a glance

| # | Bug | Layer | Severity | PR size | Status |
|---|-----|-------|----------|---------|--------|
| 8 | `drop_duplicates(subset=["bay_id","typedesc"])` drops time-window rows | pipeline (build_gold) | 🔴 root cause of weekend-only / "Unlimited" for 694+ bays | S | ✅ done |
| 1 | Router `datetime.now()` TZ-naïve | backend | 🔴 "Unlimited" during Melbourne daytime on UTC Lambda | S | ✅ done |
| 9 | Loading-zone / disabled-bay designation silently dropped during segment inheritance | pipeline (clean_to_silver) | 🟠 LZ/DP rules missing for bays not in CoM's bay-specific feed (e.g. bay 60956) | M (needs data-source decision) | 🟡 audit pending |
| 2 | `expires_at` emitted as naïve ISO | backend + frontend contract | 🟠 wrong "leave-by" clock shown | S | ✅ done |
| 3 | Raw ISO string rendered in Timeline | frontend | 🟠 unformatted timestamp visible to user | XS | ✅ done |
| 4 | `data_coverage` field is dead on client | frontend | 🟡 UI lies about rule availability | S | ✅ done |
| 5 | Planner sends browser-local as naïve ISO | frontend + backend contract | 🟡 non-Melbourne users get wrong verdicts | M | ✅ done (Approach B) |
| 6 | `rule_category='free'` branch unreachable | silver classifier | 🟢 dead code / possible misclassification | M (needs data audit) | ✅ done (branch retired) |
| 7 | `disabled` rules flagged `is_strict=False` | silver classifier | 🟢 rare mid-stay trap not warned | XS | ✅ done |

---

## Bug 8 — Pipeline drops time-window rows during gold → RDS load ✅ DONE

**Landed as:** `scripts/build_gold.py:538` (`dedup_restrictions_for_db`) +
`scripts/migrations/004_reload_bay_restrictions.sql` + pipeline re-run.
Regression tests at `scripts/tests/test_build_gold_dedup.py` are green
(2 passed, 2026-04-23).

**Root cause:** `scripts/build_gold.py:578` in `write_to_postgres`:
```python
all_rest = all_rest.drop_duplicates(subset=["bay_id", "typedesc"], keep="first")
```
After concatenating `restrictions_long` (direct bay restrictions) and
`segment_restrictions_long` (segment-inherited restrictions), the code
deduplicates on only `(bay_id, typedesc)`. For any bay whose schedule contains
multiple time windows that share the same typedesc — e.g. four separate
`2P MTR` slots covering Sat-Sun, M-F morning, M-F afternoon, and M-F evening
— `keep="first"` silently discards every entry after the first.

Since slot 1 is typically the weekend-only anchor (the segment assigns
`fromday=6 today=0` first), weekday slots 2–4 are dropped. The result is a bay
that appears weekend-only in RDS even though both the silver parquet and gold
parquet carry the full schedule.

**Verified evidence (2026-04-22 query run):**

| Metric | Value |
|--------|-------|
| Gold parquet rows | 9,504 |
| RDS rows | 12,442 |
| Bays in both gold & RDS | 3,063 |
| Bays where RDS < gold (rows dropped) | 2,367 (77%) |
| Total rows dropped | 5,667 |
| RDS weekend-only bays | 1,334 |
| Gold weekend-only bays | **0** |
| RDS weekend-only bays fixable by rebuild | 694 (52%) |

Bay 57923 example: gold has 4 rows (Sat-Sun 07:00-22:00 + M-F 09:30-16:00 +
M-F 18:00-19:00 + M-F 19:00-22:00); RDS has 1 row (Sat-Sun only). All four
rows have `typedesc='2P MTR'` — the dedup discards three.

### Change set

1. **`scripts/build_gold.py:578`** — widen the dedup key to preserve distinct
   time windows:
   ```python
   # Before
   all_rest = all_rest.drop_duplicates(subset=["bay_id", "typedesc"], keep="first")

   # After
   all_rest = all_rest.drop_duplicates(
       subset=["bay_id", "slot_num", "fromday", "today", "starttime", "endtime"],
       keep="first",
   )
   ```
   This preserves every unique (bay, slot, day-range, time-window) combination
   while still dropping exact duplicates that arise when the same row appears
   in both `restrictions_long` and `segment_restrictions_long`.

2. **`scripts/migrations/004_reload_bay_restrictions.sql`** — document the
   required reload step (DDL is handled by `write_to_postgres` itself via
   `DROP TABLE … CASCADE`; the migration file serves as an audit trail):
   ```sql
   -- Applied 2026-04-22: reload bay_restrictions after fixing dedup key.
   -- Run write_to_postgres() from build_gold.py after this comment is committed.
   -- Expected: bay_restrictions row count increases from ~12,442 to ~18,100+
   -- Expected: bays where RDS < gold drops from 2,367 to ~56 (the 56 "over" cases)
   -- Expected: weekend-only bays drops from 1,334 to ~640
   ```

3. **Re-run the pipeline:**
   ```bash
   cd scripts
   python build_gold.py --write-postgres
   ```

### Tests

- Add `test_dedup_preserves_time_windows` in the pipeline test suite
  (`scripts/tests/` or equivalent):
  - Construct a DataFrame with three rows for the same bay/typedesc but
    different `(fromday, today, starttime, endtime)` tuples.
  - Assert that after the dedup step all three rows survive.
- Add a regression fixture for bay 57923: assert gold parquet has ≥ 4 rows
  and at least one row covers a weekday (`fromday=1, today=5`).

### Verification queries (run post-reload)

```sql
-- 1. Weekend-only count should drop significantly
WITH flags AS (
  SELECT bay_id,
    bool_or(EXISTS (
      SELECT 1 FROM generate_series(1,5) d
      WHERE (fromday<=today AND d BETWEEN fromday AND today)
         OR (fromday>today  AND (d>=fromday OR d<=today))
    )) AS covers_weekday
  FROM bay_restrictions GROUP BY bay_id
)
SELECT COUNT(*) FILTER (WHERE NOT covers_weekday) AS weekend_only,
       COUNT(*) AS total_bays
FROM flags;
-- Expected: weekend_only ≤ 700 (down from 1,334)

-- 2. Row count increase
SELECT COUNT(*) FROM bay_restrictions;
-- Expected: > 16,000 (up from 12,442)

-- 3. Bay 57923 should now have weekday rows
SELECT slot_num, typedesc, fromday, today, starttime, endtime
FROM bay_restrictions WHERE bay_id = '57923' ORDER BY slot_num;
-- Expected: ≥ 3 rows, at least one with fromday=1 today=5
```

### Acceptance criteria

- `SELECT COUNT(*) FROM bay_restrictions` > 16,000 post-reload.
- Weekend-only bays ≤ 700.
- Bay 57923 evaluates to `active_restriction.typedesc = '2P MTR'` on a
  Wednesday at 12:00 Melbourne time.
- All existing evaluator tests green.

---

## Bug 9 — Loading-zone / disabled-bay coverage gap during segment inheritance

**Root cause:** `scripts/clean_to_silver.py:775` inside
`build_segment_restrictions_long` intentionally skips every sign-plate row whose
`display_code` starts with `LZ` (loading zone) or `DP` (disabled parking):

```python
# scripts/clean_to_silver.py
SEGMENT_EXCLUDE_PREFIXES = ("LZ", "DP")          # line 210
...
for _, row in joined.iterrows():
    display_code = str(row["display_code"]).strip().upper()
    if any(display_code.startswith(p) for p in SEGMENT_EXCLUDE_PREFIXES):
        skipped_bay_specific += 1               # line 775–777
        continue
```

The guard exists for a good reason — an `LZ30` plate identifies a specific
bay, and fanning it across every bay on the segment would wrongly mark dozens
of regular 2P bays as loading zones. But for any bay whose `kerbsideid` does
**not** appear in CoM's bay-specific `on-street-car-park-bay-restrictions`
feed, the segment inheritance step is the only path into the pipeline — and
segment inheritance deliberately drops LZ/DP. Those bays therefore receive
their timed-meter rules but lose their loading-zone / disabled-parking
designation entirely.

**Verified evidence — bay 60956 (Flinders Lane between Exhibition and Russell):**

| Source | Content |
|--------|---------|
| `sign_plates.parquet` (parkingzone 7412, 7446 on segment 20123) | `LZ30 Mon-Fri 07:00-16:00`, `MP2P Mon-Fri 16:00-19:00`, `MP2P Mon-Fri 19:00-22:00`, `MP2P Sat-Sun 07:00-22:00` |
| CoM upstream `on-street-car-park-bay-restrictions` (deviceid=60956) | 0 rows (deviceid range in feed is 17,465–30,791) |
| `silver/restrictions_long.parquet` (bay_id=60956) | 0 rows |
| `silver/segment_restrictions_long.parquet` (bay_id=60956) | 3 rows — all `2P MTR`, **LZ30 row silently dropped at `clean_to_silver.py:775`** |
| RDS `bay_restrictions` (bay_id='60956') | 3 rows — all `2P MTR`, no loading-zone row |

This matches the user-reported schedule exactly except for the missing
`Mon-Fri 07:00-16:00 Loading Zone` slot. The LZ data exists in our bronze
layer but is discarded by design before it can reach the bay.

**Scope:** `sign_plates.parquet` currently holds 189 LZ rows (loading zones)
and an unknown number of DP rows (disabled parking) keyed by `parkingzone`.
Up to 4,834 RDS bays fall outside CoM's bay-specific deviceid range and
therefore depend entirely on segment inheritance for all their rules — every
LZ/DP sign plate attached to those bays' parkingzones is invisible to them.
Exact affected-bay count will be computed during the audit step below.

### Why this is distinct from Bug 8

Bug 8 drops _duplicate rows that made it into gold_. Bug 9 drops _source rows
before they ever reach gold_. Fixing Bug 8 alone will not recover any LZ/DP
rule for bay 60956 because the row is absent from silver already. Both fixes
are required.

### Considered options (see audit findings below)

- **Option A (retired):** narrow the `SEGMENT_EXCLUDE_PREFIXES` guard so
  LZ/DP plates fan out across segments whose parkingzones are _uniformly_
  LZ/DP. The audit below shows this affects zero parkingzones in the
  current dataset — every LZ/DP zone co-hosts a timed-meter plate — so
  this path would recover nothing.
- **Option B (selected):** continue skipping LZ/DP during segment
  inheritance, but flag the affected bays with
  `data_coverage='partial_signage'` so the UI can surface a "verify
  signage" banner.

### Audit (completed 2026-04-23)

Script: `scripts/audit/lz_dp_coverage_gap.py`
Output: `docs/audits/lz_dp_coverage_gap_2026-04-23.csv` (193 rows).

**Findings:**

| Metric | Value |
|--------|-------|
| LZ/DP sign-plate rows in bronze | 191 (189 LZ* + 2 DP*) |
| Distinct parkingzones with ≥ 1 LZ/DP plate | 187 |
| Parkingzones that are *uniformly* LZ/DP (Option A target) | **0** |
| Segments that are *uniformly* LZ/DP across all their zones | **0** |
| Bays sitting on an LZ/DP-touched segment | 1,820 |
| …of which have no direct CoM restriction row (rely on segment inheritance) | 1,796 (98.7%) |

**Interpretation.** Every parkingzone that carries an LZ/DP plate also
carries at least one timed-meter plate (e.g. `LZ30 Mon-Fri 07:00-16:00`
alongside `MP2P Mon-Fri 16:00-19:00` on zone 7412). The uniformity
hypothesis behind Option A does not hold anywhere in the dataset — the LZ
plate always describes a _subset_ of bays on the zone, with the remaining
bays governed by the timed rule.

**Decision:** Option A is retired. Ship **Option B** — emit
`data_coverage='partial_signage'` for the 1,796 affected bays and render a
"loading/disabled zone possible — verify signage" banner in the frontend.

### Change set (Option B)

1. **`scripts/clean_to_silver.py`** — continue skipping LZ/DP during
   segment inheritance (no behaviour change), but additionally record a
   per-bay flag ``has_unassigned_lz_dp_in_zone`` for bays whose
   parkingzones contain ≥ 1 LZ/DP plate. Written to a new silver artefact
   `signage_gap_flags.parquet` keyed by `bay_id`.
2. **`scripts/build_gold.py`** — join the flag onto `bays` and
   propagate `has_signage_gap: bool` into `bay_restrictions`' parent bay
   row (or a new `bay_flags` table, TBD at implementation time).
3. **`app/schemas/bay.py`** — extend the `data_coverage` Literal to
   include `"partial_signage"`.
4. **`app/services/restriction_evaluator.py`** — when the bay has
   `has_signage_gap=True` and the normal verdict path would have returned
   `"rules_only"` or `"full"`, return `"partial_signage"` instead (keep the
   verdict/active_restriction/warning fields unchanged).
5. **`frontend/src/components/bay/BayDetailSheet.jsx`** +
   `VerdictCard.jsx` — add a new badge variant for `partial_signage`:
   "Some signage not captured — check the bay for a loading or disabled
   zone sign before parking."

### Tests

- Pipeline: fixture with a parkingzone holding `LZ30 Mon-Fri 07:00-16:00`
  + `MP2P Mon-Fri 16:00-19:00` and two bays on the zone; assert both bays
  emerge from the silver/gold step with `has_signage_gap=True`.
- Backend: evaluator returns `data_coverage='partial_signage'` for a bay
  with that flag, whether or not a governing restriction applies at
  arrival.
- Frontend: RTL test renders the new banner variant for a
  `partial_signage` bay.

### Acceptance criteria

- Bay 60956 returns `data_coverage='partial_signage'` on Wed 10:00
  Melbourne time.
- Post-deploy, the BayDetailSheet banner on bay 60956 reads "Some signage
  not captured — check the bay for a loading or disabled zone sign".
- No regression — bays not on LZ/DP-touched segments keep returning
  `data_coverage='full'` or `'rules_only'` as today.

### Tests

- Pipeline unit test (once Option A lands): a fixture segment with two
  parkingzones, both holding only LZ30 plates for Mon-Fri 07:00-16:00, plus
  two bays on that segment. Assert both bays emerge from
  `build_segment_restrictions_long` with an LZ30 row.
- Regression: a fixture segment with one LZ plate + one MP2P plate on the
  same parkingzone must still skip the LZ row (current behaviour preserved).
- Regression for bay 60956: after the fix, gold must contain ≥ 4 rows for
  60956, including `typedesc='LZ 30MINS'` (or the chosen display) with
  `fromday=1, today=5, starttime='07:00', endtime='16:00'`.

### Verification queries (post-reload, if Option A ships)

```sql
-- 1. LZ row count exists at all (baseline currently 0–few hundred in RDS)
SELECT COUNT(*) FROM bay_restrictions
 WHERE typedesc ILIKE 'LZ%' OR typedesc ILIKE 'LOADING%';
-- Expected: several hundred (≥ the 189 source plates × bays-per-segment).

-- 2. Bay 60956 spot-check
SELECT slot_num, typedesc, fromday, today, starttime, endtime
  FROM bay_restrictions WHERE bay_id = '60956' ORDER BY slot_num;
-- Expected: ≥ 4 rows including the Mon-Fri 07:00-16:00 loading zone slot.
```

### Acceptance criteria

- Audit CSV committed under `docs/audits/lz_dp_coverage_gap_2026-04-xx.csv`
  and the A/B decision recorded in this plan.
- If Option A ships: bay 60956 returns an `active_restriction` with
  `rule_category='loading'` at Wed 10:00 Melbourne time.
- If Option B ships: bay 60956 returns `data_coverage='partial_signage'` (or
  equivalent) and the frontend renders the "check signage" banner alongside
  the inherited 2P rules.
- No regression — no bay that currently shows 2P suddenly shows LZ unless
  every plate on its parkingzone set is LZ.

---

## Bug 1 — Backend timezone-naïve `datetime.now()` in the router ✅ DONE

**Landed as:** `app/routers/bays.py` now uses
`datetime.now(_MELBOURNE_TZ)` on both endpoints; naïve `arrival_iso` is
reattached to `Australia/Melbourne` before being passed to the evaluator.
Commit `28a7b4a feat(api): implement Melbourne timezone handling for bay
evaluations`. 50 backend tests pass.

**Root cause:** `app/routers/bays.py:44` and `:87` call `datetime.now()`, which
on AWS Lambda returns naïve UTC. The evaluator then compares `dt.hour` and
`dt.weekday()` directly against DB values stored in Melbourne local time
(`bay_restrictions.starttime/endtime`). During Melbourne business hours UTC
often falls outside the `07:30–23:00` window, the evaluator returns
`verdict="yes"` + `active_restriction=null`, and `BayDetailSheet.jsx:331`
renders "Unlimited".

### Change set

1. **`app/routers/bays.py`** — replace both `arrival = datetime.now()` lines
   with `arrival = datetime.now(ZoneInfo("Australia/Melbourne"))`.
2. **`app/routers/bays.py`** — when parsing `arrival_iso`, attach the
   Melbourne zone if the parsed datetime is naïve:
   ```python
   arrival = datetime.fromisoformat(arrival_iso)
   if arrival.tzinfo is None:
       arrival = arrival.replace(tzinfo=ZoneInfo("Australia/Melbourne"))
   ```
3. **`app/services/restriction_evaluator.py`** — normalise at the top of
   `evaluate_bay_at` and `evaluate_bays_bulk`:
   ```python
   if arrival.tzinfo is not None:
       arrival = arrival.astimezone(ZoneInfo("Australia/Melbourne")).replace(tzinfo=None)
   ```
   This keeps the downstream code path (naïve datetimes compared to naïve DB
   `time` columns) unchanged, which avoids a rewrite of
   `is_restriction_active_at` and `_find_strict_starting_during_stay`.

### Tests

- Add `TestTimezoneNormalisation` class in `test_restriction_evaluator.py`:
  - UTC-aware datetime at 02:00 UTC (= 12:00 AEST) resolves a 1P rule active.
  - AEDT-aware datetime at 12:00 +11:00 resolves the same rule.
  - Naïve datetime at 12:00 (already Melbourne-local) unchanged behaviour.
- Add router-level test (FastAPI TestClient) asserting that with no
  `arrival_iso` the evaluator sees a Melbourne-local timestamp.

### Verification

- Manual: call `/api/bays/10279/evaluate` at 13:00 AEST → expect
  `active_restriction.typedesc == "1P"`, `max_stay_mins == 60`.
- Lambda smoke-test after deploy — spot-check five timed bays at Melbourne
  noon; no "Unlimited" labels on bays with active windows.

### Acceptance criteria

- All 44 existing tests plus ≥3 new TZ tests pass.
- `/api/bays/{id}/evaluate` with no `arrival_iso` returns the same
  `active_restriction` shape at Melbourne 12:00 regardless of server TZ
  (`TZ=UTC python -m pytest` and `TZ=Australia/Melbourne python -m pytest`
  both green).

---

## Bug 2 — `expires_at` emitted as naïve ISO ✅ DONE

**Landed as:** `restriction_evaluator.py` now normalises arrivals to Melbourne
and emits offset-aware ISO strings via a `_to_melbourne_iso()` helper used at
both `expires_at` (line 327) and `warning.starts_at` (line 245). Commit
`28a7b4a`.

**Root cause:** `restriction_evaluator.py:317`
```python
expires_at = (arrival + timedelta(minutes=max_stay)).isoformat()
```
`arrival` is naïve → output is `"2026-04-14T11:00:00"` (no offset). The
frontend parses it with `new Date(iso)` which ES2016+ interprets as **local
browser time**. If the backend is UTC and the user is in Melbourne, the
"leave-by" clock is off by ~10 h.

This fix depends on Bug 1 landing (needs `arrival` to already be
Melbourne-zoned before isoformat).

### Change set

1. **`app/services/restriction_evaluator.py:317`** — build a tz-aware datetime:
   ```python
   expires_dt = (arrival.replace(tzinfo=ZoneInfo("Australia/Melbourne"))
                 + timedelta(minutes=max_stay))
   expires_at = expires_dt.isoformat()  # emits "...+11:00" or "+10:00"
   ```
2. Do the same for `warning.starts_at` in `_find_strict_starting_during_stay`
   — it currently calls `.isoformat()` on a naïve datetime on line 227.
3. **`app/schemas/bay.py`** — update field docstrings to state
   "ISO-8601 with Australia/Melbourne offset".

### Tests

- `TestExpiresAtIsTzAware` — parse the `expires_at` string with
  `datetime.fromisoformat` and assert `tzinfo is not None` and `utcoffset()`
  is 10 h or 11 h.
- Freeze the clock at 2026-04-14 10:00 Melbourne in `_find_strict_starting…`
  test and assert the `warning.starts_at` offset matches.

### Acceptance criteria

- Frontend `new Date(expires_at)` parses to the correct instant regardless of
  browser TZ.
- No assertion in existing tests breaks (search for hardcoded
  `"2026-04-14T..."` strings first; likely 3–5 test fixtures to update).

---

## Bug 3 — Raw ISO string rendered in TimelineStrip ✅ DONE

**Landed as:** `TimelineStrip.jsx:2,48` now imports and uses
`formatLeaveByClock(activeRestriction.expires_at)` instead of dumping the raw
ISO into the `desc` field.

**Root cause:** `frontend/src/components/bay/TimelineStrip.jsx:47-53`
dumps `activeRestriction.expires_at` verbatim into the user-visible `desc`
field.

### Change set

1. **`TimelineStrip.jsx`** — import and use the existing helper:
   ```js
   import { formatLeaveByClock } from '../../utils/plannerTime'
   …
   const leaveBy = formatLeaveByClock(activeRestriction.expires_at)
   if (leaveBy) {
     items.push({ time: 'Restriction expires', desc: leaveBy, on: true })
   }
   ```
2. Match the label wording to BayDetailSheet ("Leave by") for consistency.

### Tests

- Vitest/RTL: render `TimelineStrip` with a known
  `expires_at="2026-04-14T11:00:00+10:00"`; assert the node text contains
  `"11:00 AM"` (not the raw ISO).
- Covers both Bug 2 and Bug 3 since it exercises the full format pipeline.

### Acceptance criteria

- No user-visible `T` separator or `+10:00` offset in the rendered Timeline.
- Screenshot review on the bay detail sheet.

---

## Bug 4 — `data_coverage` field is dead on the client ✅ DONE

**Landed as:** `BayDetailSheet.jsx:243` and `VerdictCard.jsx:48` now read
`evaluation?.data_coverage` and render the coverage-aware badge.
`BayDetailSheet.test.jsx` and `VerdictCard.test.jsx` cover the three coverage
variants.

**Root cause:** Phase 5 added `data_coverage: "full" | "rules_only" | "none"`
on every evaluation; `apiBays.js:63` hardcodes `hasRules: true` on every live
bay; `BayDetailSheet.jsx:243` reads `bay.hasRules` for the "Full rules
available" badge. Grep confirms zero reads of `data_coverage` in
`frontend/src`.

### Change set

1. **`BayDetailSheet.jsx`** — replace the badge logic with evaluation-driven
   coverage:
   ```js
   const coverage = evaluation?.data_coverage ?? null
   const badge = evalLoading
     ? null
     : coverage === 'full'
       ? { tone: 'strong',  label: 'Live status + rules' }
       : coverage === 'rules_only'
         ? { tone: 'weak',  label: 'Rules only — no live status' }
         : { tone: 'mute',  label: 'No data — check signage' }
   ```
2. Keep `bay.hasRules` for the loading state only (fall back while the
   evaluation request is in flight so the badge doesn't flicker).
3. **`VerdictCard.jsx:100-112`** — the `limitVal` branch for "no rules"
   should also read `coverage === 'none'` instead of inferring from
   `hasRealData`.

### Tests

- RTL tests for three coverage states driving three badge variants.
- Regression: existing "Sensor only — check the sign" text path still appears
  for `coverage === 'none'`.

### Acceptance criteria

- A bay returning `data_coverage: "none"` from the backend no longer shows
  "Full rules available" in the UI.
- Loading state unchanged (no flash of "No data" while evaluation in flight).

---

## Bug 5 — Planner sends browser-local wall-clock as a naïve ISO ✅ DONE (Approach B)

**Landed as:** Approach B — naïve `arrivalIso` is kept; UI copy at
`BayDetailSheet.jsx:448` now reads "Times are Melbourne time (AEST/AEDT).",
and backend interprets naïve datetimes as Melbourne-local (see Bug 1 fix in
`bays.py:49-50, 94-95`). Users outside Melbourne rely on the UI disclosure.

**Root cause:** `BayDetailSheet.jsx:79` builds
`arrivalIso: \`${dateStr}T${timeStr}:00\`` from the date/time inputs in
browser-local clock. Sent naïve to the backend. A user in Sydney DST types
"14:00" expecting Melbourne 14:00 but is sent "14:00 Sydney wall clock" — the
backend now interprets it as Melbourne-local after the Bug 1 fix, so the
evaluation is for the wrong moment.

### Change set

Two viable approaches — **approach A** is safer and recommended.

**Approach A (frontend converts to Melbourne before sending).**
1. **`BayDetailSheet.jsx:77-80`** — treat the inputs as "Melbourne wall
   clock" explicitly:
   ```js
   const rawPlanner = useMemo(() => {
     if (!dateStr || !timeStr) return null
     // Inputs are labelled "Melbourne time" in the UI — append the offset so
     // the backend parses an unambiguous instant.
     const offset = melbourneOffsetForLocalDate(dateStr)  // "+10:00" or "+11:00"
     return { arrivalIso: `${dateStr}T${timeStr}:00${offset}`, durationMins }
   }, [dateStr, timeStr, durationMins])
   ```
2. Add `melbourneOffsetForLocalDate(dateStr)` to `plannerTime.js`; compute
   the offset via a probe `new Date` and `Intl.DateTimeFormat` with
   `timeZone: 'Australia/Melbourne'`.
3. Add "(Melbourne time)" helper text below the date/time input.
4. Backend already handles the offset after the Bug 1 fix (normalises
   tz-aware → Melbourne naïve).

**Approach B (backend enforces "naïve = Melbourne").**
1. Document that `arrival_iso` without offset is Melbourne-local; already
   covered by the Bug 1 fix.
2. Visible helper text in the UI ("Times are Melbourne time").
3. Risk: users and test tooling outside Melbourne who copy-paste an ISO
   timestamp still get silent misinterpretation.

Recommend **A** — explicit is safer, and it composes with future features
(e.g. trip-planner from another city) without further contract changes.

Current implementation choice: **Approach B**.
Naive `arrival_iso` is kept; UI and API contract now state "Times are Melbourne
time", and backend interprets naive datetimes as Melbourne-local.

### Tests

- Vitest: `melbourneOffsetForLocalDate("2026-04-22")` returns `"+10:00"`
  (post-DST end), `"2026-10-10"` returns `"+11:00"`.
- Integration: mock a browser in Sydney tz; pick "14:00" in the planner;
  assert the outgoing fetch URL includes `arrival_iso=2026-04-22T14:00:00+10:00`.

### Acceptance criteria

- Users in any timezone see consistent verdicts for the same Melbourne wall
  clock value.
- No regression for Melbourne users on Melbourne-tz browsers.

---

## Bug 6 — `rule_category='free'` branch is unreachable ✅ DONE (branch retired)

**Landed as:** Audit confirmed no RDS rows with `rule_category='free'` and no
realistic upstream path that would emit one (rows like `1P FREE` are
time-limited and correctly classified as `timed`). The dead `cat == "free"`
arm has been removed from `_verdict_for_restriction` — grep confirms zero
matches in `backend/app/services/restriction_evaluator.py`.

**Root cause:** `_verdict_for_restriction` has a `cat == "free"` arm
(lines 300-306), but the DB has 0 rows with that category. The silver-layer
classifier in `scripts/build_gold.py` / `scripts/clean_to_silver.py` never
emits `"free"`. Some genuinely-unrestricted bays may be misclassified as
`"timed"` or `"other"`, or the branch may just be dead.

### Change set

1. **Audit (no code change):** Spot-check 10–20 bays in CoM's live feed
   whose `description1` contains "free" or "no restriction" or "P" without a
   numeric prefix, and see which `rule_category` the silver step assigns.
2. **If misclassifications exist:** extend the classifier's regex in
   `scripts/clean_to_silver.py` (likely the `_categorise_rule` or
   equivalent function) with a "free" branch matching `free`, `unrestricted`,
   `no time limit`.
3. **If no misclassifications:** delete the dead branch in
   `_verdict_for_restriction` and add a comment noting the CoM feed never
   emits free-parking rules (they're implied by the absence of any rule).

### Tests

- If classifier extended: add a silver fixture row whose description maps
  to `rule_category="free"` and assert the golden output.
- If branch deleted: remove any unused fixtures.

### Acceptance criteria

- Either the dead branch is demonstrably reachable (at least one RDS row
  with `rule_category='free'`) or the branch is removed.

### Audit-first implementation note

Current audit found no real `rule_category='free'` rows in DB export artifacts.
Rows with `typedesc` like `1P FREE` are time-limited and currently classified as
`timed`, which is correct for evaluator stay-limit behavior. Therefore the dead
`cat == "free"` evaluator branch is retired.

---

## Bug 7 — `disabled` not flagged `is_strict` ✅ DONE

**Landed as 2026-04-23:**
- `scripts/build_gold.py` `classify_rule()` now returns `(True, "disabled")`
  for disabled patterns (line 422 + updated docstrings at lines 48 & 390).
- `scripts/migrations/003_disabled_is_strict.sql` flips the existing 11
  `disabled` rows in RDS from `is_strict=FALSE` to `TRUE`. Idempotent.
- `scripts/tests/test_classify_rule.py` — 26 unit tests covering disabled
  patterns (strict), strict-category regression, non-strict regression,
  and LZ-vs-timed cascade ordering. All green.
- `backend/app/tests/test_restriction_evaluator.py::TestMidStayWarning`
  gained `test_disabled_starts_mid_stay` (positive path — verdict=yes
  timed window at arrival, disabled activation at 18:30 raises warning)
  and `test_disabled_not_strict_regression` (pre-migration DB rows with
  `is_strict=False` still correctly suppress the warning). Both green.

**Full-suite verification (2026-04-23):**
- `pytest backend/app/tests` → 52 passed (2 new).
- `pytest scripts/tests` → 28 passed (26 new).

**Root cause:** In RDS, 139/139 `disabled` rows had `is_strict=False`.
`_find_strict_starting_during_stay` never raises a mid-stay warning for a
disabled zone activating. Rare, but mixed schedules ("1P 07:30–18:30,
Disabled 18:30–22:00") leave an un-permitted driver parked illegally with
no warning.

### Change set

1. **`scripts/clean_to_silver.py` (or whichever module sets `is_strict`)** —
   mark `disabled` rules as strict alongside `loading`, `no_standing`,
   `clearway`.
2. **`scripts/migrations/003_disabled_is_strict.sql`** — idempotent:
   ```sql
   UPDATE bay_restrictions
     SET is_strict = TRUE
     WHERE rule_category = 'disabled' AND is_strict = FALSE;
   ```
3. Re-run build_gold once the classifier is updated (next pipeline cycle
   will overwrite the flag correctly; the migration handles the immediate
   production DB without waiting).

### Tests

- Unit: fixture bay with `timed 07:30–18:30` + `disabled 18:30–22:00`;
  arrival 10:00, duration 9 h → expect `warning.type == "disabled"`,
  `warning.starts_at` matches 18:30.

### Acceptance criteria

- Post-migration query: `SELECT COUNT(*) FROM bay_restrictions WHERE
  rule_category='disabled' AND is_strict=FALSE` returns 0.
- New test green, all existing tests green.

---

## Sequencing

Bugs 1–8 have shipped. Bug 9 audit is complete (2026-04-23): Option A is
retired (zero uniform parkingzones), Option B is the path forward.

```
Now
  PR A ─ Bug 9 pipeline  flag bays on LZ/DP-touched segments with
                          has_signage_gap; propagate to bay_restrictions.

Next
  PR B ─ Bug 9 backend   extend data_coverage Literal to include
                          'partial_signage'; emit it when bay has the
                          signage-gap flag.

Then
  PR C ─ Bug 9 frontend  new badge/banner variant for 'partial_signage'
                          in BayDetailSheet + VerdictCard.
```

### Dependency graph

```
Bug 9 audit ───► PR A (pipeline flag) ───► PR B (backend) ───► PR C (frontend)
```

### Completed work (reference)

- Bug 8 — `scripts/build_gold.py:538` + migration 004 + dedup tests ✅
- Bug 1 — `app/routers/bays.py` TZ-aware + commit `28a7b4a` ✅
- Bug 2 — `_to_melbourne_iso()` in `restriction_evaluator.py` ✅
- Bug 3 — `TimelineStrip.jsx` uses `formatLeaveByClock` ✅
- Bug 4 — `data_coverage` wired in `BayDetailSheet.jsx` + `VerdictCard.jsx` ✅
- Bug 5 — Approach B (UI disclosure; backend interprets naïve as Melbourne) ✅
- Bug 6 — `cat == "free"` branch retired after audit ✅
- Bug 7 — `classify_rule()` returns is_strict=True for disabled +
           migration 003 + 28 unit tests + 2 evaluator tests ✅

---

## Out of scope for this remediation

- Converting the evaluator to work natively in tz-aware datetimes (current
  plan normalises at the boundary and keeps the inner logic naïve). Larger
  refactor, not required to fix the bugs.
- Storing restriction times as `timestamptz` in RDS. The clock-time
  semantics make `TIME` the right type; revisit only if we add per-bay
  timezones.
- Deleting NULL-geometry bays. Already decided (Phase 5) to keep them
  addressable via single-bay `/evaluate` for shareable URLs.
- Reconciling the 4,834 RDS bays whose `deviceid` no longer appears in the
  current CoM upstream restrictions feed. These are likely from a prior
  snapshot; the active sensor feed still returns live status for them. Track
  as a separate data-freshness story once Bug 8 is resolved and the reload
  baseline is clean.
