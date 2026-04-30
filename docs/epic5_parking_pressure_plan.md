# Epic 5: Parking Pressure Map — Feature Plan

## 1. Feature Overview

### Vision
A parking pressure map that visualises busy vs quiet zones across Melbourne CBD, combining live parking sensor data with historical traffic congestion profiles and scheduled event data. When demand is high, the system recommends less crowded alternatives nearby.

### Two UI Surfaces
| Surface | Purpose | Trigger |
|---------|---------|---------|
| **Pressure heatmap** (ambient) | At-a-glance zone-level busy/quiet shading on map with time slider | Toggle button, always available |
| **ETA decision card** (committed) | Predicted pressure at destination at arrival time + top-3 alternatives | User searches destination + sets ETA |

### Persona
**Liam** — a driver heading to Melbourne CBD who wants to maximise his parking success rate. Decision moment: 10–30 min before arriving, plus en-route pivots.

### User Stories (from Analysis & Design Report)
1. **US5.1** — As Liam, I want to see a visual map of parking pressure so I can avoid congested zones.
2. **US5.2** — As Liam, I want to view predicted pressure for a future time window so I can plan ahead.
3. **US5.3** — As Liam, I want the system to recommend less crowded alternatives when my target zone is busy.

---

## 2. Data Architecture

### Data Sources
| Source | Type | Freshness | What it provides |
|--------|------|-----------|-----------------|
| CoM parking bay sensors | Live API | ~2 min lag | Occupied/free per bay → ground-truth occupancy per zone |
| VicGov traffic signal volume (SCATS) | Historical monthly ZIP | 2–6 week lag | Vehicle counts per intersection → typical traffic profile by hour-of-week |
| Victorian traffic signals geo | Static CSV | Stable | SCATS site → lat/lon for spatial join |
| Eventfinda `/api/v2/events` | Live API | Real-time | Upcoming events near CBD → event load overlay |

### Zone Definition
Use CoM parking zones already present in `sensors_clean.zone_number` (332 distinct zones, 3261 bays, 98% segment coverage). No custom grid needed — semantically meaningful, pre-joined.

### Pressure Formula (v1)
All three components normalised to [0, 1] via percentile rank across zones at query time:

```
pressure(zone, t) = 0.55 × pct_rank(occupancy)
                  + 0.30 × pct_rank(traffic_profile_z)
                  + 0.15 × pct_rank(event_load)
```

**Components:**

| Component | "Now" mode | "Forecast" mode (t+Nh) |
|-----------|-----------|----------------------|
| `occupancy` | Live: occupied_bays / total_bays in zone | Profile-based: historical median occupancy for this zone × dow × hour (v2, requires sensor backfill). v1 forecast: carry forward current occupancy + direction hint from traffic delta |
| `traffic_profile_z` | z-score of typical volume at nearest SCATS site for current dow × hour vs site's own distribution | Same formula at future dow × hour |
| `event_load` | Σ (attendance_est × gaussian(distance, σ=300m)) for events active now, sigmoid-normalised | Same formula for events active at horizon timestamp |

**Pressure bins:** low < 0.4 | medium 0.4–0.7 | high > 0.7

**Trend arrow:** Compare pressure(now) vs pressure(now − 1h). Rising / stable / falling.

### Zone ↔ SCATS Mapping
Each zone's centroid (mean lat/lon of member bays) matched to k=3 nearest SCATS sites within 500m, inverse-distance weighted. Zones with no SCATS site within 500m get `traffic_profile_z = 0` (neutral — no traffic signal, likely minor street).

### Medallion Pipeline

```
BRONZE (fetch)              SILVER (clean)                GOLD (serve)
─────────────               ──────────────                ────────────
epic5_scats_sites_raw    →  epic5_scats_sites_clean    →  epic5_zone_scats_map
epic5_traffic_volume_raw →  epic5_traffic_long          →  epic5_traffic_profile
                            epic5_traffic_site_hourly      (site × dow × hour)
                            epic5_traffic_profile
epic5_events_raw         →  epic5_events_clean          →  epic5_zone_pressure_grid
                                                           epic5_alternatives_lookup
                         +  sensors_clean.zone_number   →  epic5_zone_bay_counts
                            (existing silver)               (zone → total_bays, centroid)
```

---

## 3. Prototype Design

### 3.1 Heatmap Layer (Surface A)

**Visual:**
- Choropleth overlay on Leaflet map using zone polygons (or convex hulls of zone bays)
- Color ramp: green (#a3ec48) → amber (#FFB382) → red (#ed6868) — matches existing app palette
- Opacity: 0.35 (subtle, doesn't obscure bay dots beneath)
- Legend: "Parking Pressure: Low | Medium | High" with colour chips

**Interaction:**
- Toggle via control button (same pattern as accessibility toggle, right sidebar)
- Time slider beneath map: "Now", "+1h", "+3h", "+6h" — horizontal pill selector
- Click zone → side panel: zone name, pressure score, breakdown (occupancy %, traffic trend, events list), trend arrow
- Existing bay dots remain visible through overlay — user can still click individual bays

**Integration with existing UI:**
- Heatmap toggle joins the right-side control button group (MapPage lines 454–517)
- Zone detail panel reuses BayDetailSheet pattern (bottom sheet mobile, right panel desktop)
- Time slider sits in same row as FilterChips, below TopBar
- Dark mode: green/amber/red still contrast on dark tiles (verified against CARTO dark)

### 3.2 ETA Decision Card (Surface B)

**Trigger:** User has selected a destination via SearchBar AND adjusted arrival time (existing planner time picker)

**Layout:**
```
┌────────────────────────────────────────────────┐
│ Arriving at Bourke St at 6:45 PM Tuesday       │
│                                                │
│ ██████████████░░░░░  70% occupied  ↑ Rising    │
│ Pressure: HIGH                                 │
│                                                │
│ ⚡ AFL game at MCG starts 7:30 PM (1.2 km)     │
│ 📈 Tuesday 6–7 PM is typically busy here       │
│                                                │
│ 💡 Try instead:                                │
│ ┌──────────────────────────────────────────┐   │
│ │ 🟢 Russell St  · 35% occupied · 8 min walk │ │
│ │ 🟢 Exhibition St · 42% occupied · 6 min walk│ │
│ │ 🟡 Lonsdale St · 55% occupied · 11 min walk │ │
│ └──────────────────────────────────────────┘   │
│                                                │
│ Based on typical Tuesday traffic + 1 event nearby │
└────────────────────────────────────────────────┘
```

**Behaviour:**
- Card appears above proximity banner (MapPage lines 558–574)
- If destination set but no time → shows "now" pressure only
- If destination + time → shows predicted pressure at ETA
- Alternatives sorted by walking time (Haversine × 1.4 Manhattan factor → mins at 5 km/h)
- Click alternative → map pans to that zone, highlights it
- Card collapsible via chevron
- Mobile: card renders as top portion of BottomSheet

---

## 4. Usability Evaluation

### 4.1 Heuristic Analysis (Nielsen's 10)

| Heuristic | Assessment | Mitigation |
|-----------|-----------|------------|
| **Visibility of system status** | Heatmap shows stale data risk — SCATS is historical, not live | Label: "Based on typical [day] traffic pattern" + "Sensor data live as of [time]". Distinct badge for each data source freshness |
| **Match between system and real world** | "Pressure" is abstract — users think "busy" or "full" | Use plain language: "Busy", "Quiet", "Moderate" instead of "High/Medium/Low pressure" |
| **User control and freedom** | Heatmap may overwhelm users who just want bay dots | Off by default. Toggle clearly labelled. Easy dismiss. Remembers preference in localStorage |
| **Consistency and standards** | Time slider is new pattern not used elsewhere in app | Use same pill-button pattern as FilterChips for consistency. Same font, spacing, active-state color |
| **Error prevention** | Forecast beyond 6h increasingly unreliable | Cap slider at +6h. Grey out further options. Tooltip: "Predictions less reliable beyond 3 hours" |
| **Recognition over recall** | Zone IDs (7250, 7566) are meaningless to users | Display street name instead: "Bourke St (Swanston–Elizabeth)". Derive from zones_to_segments.onstreet + streetfrom/streetto |
| **Flexibility and efficiency** | Power users want quick comparison | Allow click-to-compare: tap two zones to see side-by-side pressure |
| **Aesthetic and minimalist design** | Heatmap + bay dots + destination circle + decision card = visual overload | Heatmap auto-dims bay dots to 0.3 opacity. Decision card collapses to single line when not focused. Heatmap uses low opacity (0.35) |
| **Help users recover from errors** | User picks high-pressure zone, gets frustrated | Proactive: alternatives shown before user commits. "Try instead" framing, not "You chose wrong" |
| **Help and documentation** | New feature, users won't know what colours mean | Onboarding tooltip on first toggle. Legend always visible when heatmap on. "What does this show?" link |

### 4.2 Cognitive Load Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Two overlapping visualisations (bay dots + zone shading) | Medium | Heatmap opacity 0.35. Bay dots render ON TOP. At low zoom, hide individual dots, show only zones. At high zoom, zones become background context for dots |
| Time slider adds decision dimension | Medium | Default to "Now". Slider only appears when heatmap is ON. Minimal labels (Now / +1h / +3h / +6h) |
| Decision card has multiple data points | Low | Progressive disclosure: headline (pressure level + trend) always visible. Breakdown expands on tap. Alternatives expand on tap |
| Three data sources with different freshness | High | Single "confidence" indicator: "Based on live sensors + typical Tuesday traffic". Don't expose raw data source names |

### 4.3 Accessibility (WCAG 2.1 AA)

| Concern | Solution |
|---------|----------|
| Red-green colour ramp fails for protanopia/deuteranopia | Use blue (#3B82F6) → amber (#F59E0B) → red (#EF4444) ramp in high-contrast mode. Toggle in accessibility settings. Or add pattern fills (dots for low, lines for medium, cross-hatch for high) |
| Time slider not keyboard-navigable | Implement as `role="tablist"` with arrow-key navigation. Each option is `role="tab"` with `aria-selected` |
| Zone click target too small on mobile | Minimum touch target 44×44px. Zone polygons inherently large enough. Fallback: tap anywhere in zone area |
| Screen reader can't interpret choropleth | Add `aria-label` on each zone element: "Bourke Street zone, moderate pressure, 55% occupied" |
| Decision card text contrast | Ensure all text meets 4.5:1 contrast ratio. Pressure bar uses both colour + text label |
| Reduced motion | Trend arrow is static icon, not animated. Time slider transition respects `prefers-reduced-motion` (existing hook: `useReducedMotion`) |

### 4.4 Mobile UX Considerations

| Pattern | Desktop | Mobile (<900px) |
|---------|---------|-----------------|
| Heatmap toggle | Right sidebar button group | Same, but icon-only (no label) |
| Time slider | Horizontal pills below TopBar | Same, scrollable if needed |
| Zone detail | Right panel (like BayDetailSheet) | Bottom sheet (existing pattern) |
| Decision card | Floating card above map | Top section of bottom sheet, above bay list |
| Legend | Floating bottom-left | Collapsible icon button (existing pattern from MapPage legend) |

---

## 5. Risk Evaluation

### 5.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Eventfinda API returns 0 events** (already happening) | Event component = zero. Pressure degrades to occupancy + traffic only | High | Graceful degradation — event_load = 0, formula still works. UI shows "No events detected nearby" instead of blank. Investigate auth separately |
| **SCATS data 2–6 week lag** | Traffic profile reflects last month, not this week | Medium | Acceptable for hour-of-week medians — patterns stable across weeks. Document limitation. Label as "typical" not "current" |
| **Zone polygons don't exist as GeoJSON** | Can't render choropleth without zone boundaries | High | **Fallback: use convex hull of bay points per zone.** Precompute in gold. Or use circle markers sized by zone extent. No external polygon dataset needed |
| **332 zones = 332 polygons on map** | Potential Leaflet rendering lag | Medium | Use Leaflet's `GeoJSON` layer with `onEachFeature` (not individual markers). Simplify hulls. Test on mobile. Fallback: cluster zones at low zoom |
| **Sensor API outage** | Occupancy component goes stale | Low (existing resilience) | Existing stale-cache pattern in `parking_service.py`. Pressure falls back to traffic + events only. Badge: "Sensor data from [stale time]" |
| **No historical sensor data for occupancy forecast** | Cannot predict zone occupancy at future hour | High | v1: forecast uses traffic delta as proxy. Label honestly: "Based on traffic pattern, not parking history". v2: start logging sensor snapshots for backfill |
| **Walking time estimate inaccurate** | Haversine × 1.4 is crude | Low | Acceptable for v1 (±2 min error). v2: use OSRM/Google walking directions |

### 5.2 Data Quality Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Some zones have very few bays (1–3) | Occupancy % is noisy (one car = 33% → 100%) | Filter out zones with < 5 bays from heatmap. Or merge adjacent tiny zones |
| SCATS site coverage gaps in some CBD blocks | Traffic component = neutral for those zones | Acceptable. Most CBD intersections have SCATS. Document gap zones |
| Eventfinda attendance estimates missing/unreliable | Event load underweighted or overweighted | Default attendance = 200 if missing. Cap at 50,000. Log warnings for missing data |
| Zone centroid doesn't represent zone shape well | SCATS matching could pick wrong intersection | Use median lat/lon of bays, not mean (robust to outliers). Validate visually |

### 5.3 UX Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature perceived as redundant vs bay dots | Low adoption | Differentiate clearly: "Bay dots = individual spots. Pressure map = area trend + forecast". Onboarding tooltip |
| Forecast inaccuracy erodes trust | User arrives at "low pressure" zone, finds it full | Honest labeling: "Predicted" not "Guaranteed". Confidence indicator. "Based on typical patterns — actual availability may vary" |
| Visual overload with heatmap + dots + circle + card | Cognitive fatigue | Progressive disclosure. Heatmap dims dots. Card collapses. Layers don't stack all at once |
| Alternative suggestions send user to unfamiliar area | User frustration | Show street name + walking time + direction arrow. Map highlights alternative zone. User can preview before committing |

### 5.4 Project Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Eventfinda API credentials not obtained | Event component = zero indefinitely | Medium | Design works without events (pressure = occupancy + traffic). Events are enhancement, not dependency. Team to pursue creds in parallel |
| Scope creep into real-time traffic | Timeline blown | Medium | Hard boundary: SCATS profile only in v1. Document "live traffic" as v2 future enhancement |
| Integration conflicts with existing planner mode | Both modify map appearance | Medium | Heatmap and planner are mutually exclusive toggles. If planner active, heatmap auto-disables (or vice versa). Avoids conflicting color schemes on bays |
| Performance on mobile with 300+ zone polygons | Poor UX on low-end devices | Medium | Profile on Android mid-range. Simplify polygon geometry. Lazy-load zone layer. Show zones only at zoom 13–17 (at 18+ bay dots take over) |

---

## 6. Implementation Plan

### Phase 1: Gold Pipeline (Est. 2–3 days)
**Goal:** Zone-level pressure parquets ready for backend consumption.

| Step | Script | Output | Dependencies |
|------|--------|--------|-------------|
| 1a | `scripts/build_gold_epic5.py` | `epic5_zone_bay_counts.parquet` (zone_number, total_bays, centroid_lat, centroid_lon, zone_label) | `sensors_clean`, `zones_to_segments` |
| 1b | Same | `epic5_zone_scats_map.parquet` (zone_number → [scats_site_no, weight]) | `epic5_scats_sites_clean`, zone centroids |
| 1c | Same | `epic5_zone_hulls.geojson` (zone boundary polygons via convex hull of bay points) | `sensors_clean` lat/lon grouped by zone |
| 1d | Same | `epic5_traffic_profile_by_zone.parquet` (zone, dow_type [weekday/weekend], hour, traffic_z) | `epic5_traffic_profile`, zone↔scats map |
| 1e | Same | `epic5_zone_pressure_snapshot.parquet` (zone, pressure, occupancy_pct, traffic_z, event_load, level, trend) | All above + live sensor logic |

### Phase 2: Backend API (Est. 2–3 days)
**Goal:** Endpoints serving pressure data + alternatives.

| Step | File | Endpoint | Notes |
|------|------|----------|-------|
| 2a | `services/pressure_service.py` | — | Load gold parquets. Cache zone metadata. Compute live pressure on demand from sensor cache + static profiles |
| 2b | `routers/pressure.py` | `GET /api/pressure?at=<iso>&horizon=now` | Returns all zones: `[{zone_id, label, pressure, level, trend, occupancy_pct, centroid, components}]` |
| 2c | Same | `GET /api/pressure/zone/{zone_id}?at=<iso>` | Single zone detail with event list, traffic breakdown |
| 2d | Same | `GET /api/pressure/alternatives?lat=&lon=&at=<iso>&radius=800` | Top-3 low-pressure zones near destination with walk time |
| 2e | `schemas/pressure.py` | — | Pydantic models: `ZonePressure`, `PressureResponse`, `AlternativeZone` |
| 2f | `main.py` | — | Register pressure_router, load gold data at startup |

### Phase 3: Frontend Heatmap (Est. 3–4 days)
**Goal:** Zone choropleth on map with toggle + time selector.

| Step | File | What |
|------|------|------|
| 3a | `services/apiPressure.js` | `fetchPressure(at)`, `fetchZoneDetail(zoneId, at)`, `fetchAlternatives(lat, lon, at)` |
| 3b | `hooks/usePressure.js` | Manages pressure state, polling (30s), time horizon selection |
| 3c | `components/map/PressureLayer.jsx` | Leaflet GeoJSON layer rendering zone hulls with pressure-based fill colour |
| 3d | `components/map/PressureToggle.jsx` | Control button for heatmap on/off (joins right sidebar button group) |
| 3e | `components/map/TimeHorizonSelector.jsx` | Pill selector: Now / +1h / +3h / +6h |
| 3f | `components/map/PressureLegend.jsx` | Floating legend with colour chips + "What's this?" tooltip |
| 3g | `components/pressure/ZoneDetailPanel.jsx` | Side panel / bottom sheet for zone detail on click |
| 3h | Integration in `MapPage.jsx` | Wire toggle, time selector, layer, panel. Mutual exclusion with planner mode |

### Phase 4: Frontend Decision Card (Est. 2–3 days)
**Goal:** ETA-aware pressure card with alternatives.

| Step | File | What |
|------|------|------|
| 4a | `components/pressure/DecisionCard.jsx` | Card component: headline, pressure bar, event warnings, alternatives list |
| 4b | `components/pressure/AlternativeRow.jsx` | Single alternative: zone label, pressure level, walk time, click-to-navigate |
| 4c | Integration in `MapPage.jsx` | Show card when destination + time set. Fetch alternatives. Click alternative → pan map + highlight zone |

### Phase 5: Polish & QA (Est. 2–3 days)
| Step | What |
|------|------|
| 5a | Dark mode styling for all new components |
| 5b | Accessibility audit: keyboard nav, screen reader, colour contrast, reduced motion |
| 5c | Mobile responsiveness: test on 375px, 390px, 414px widths |
| 5d | Performance profiling: 300+ zone polygons on mobile. Simplify if needed |
| 5e | Onboarding tooltip for first-time pressure toggle |
| 5f | Error states: API down, no events, stale sensors |
| 5g | Integration test: pressure + bay dots + planner mode mutual exclusion |

### Phase 6: Documentation & Validation (Est. 1 day)
| Step | What |
|------|------|
| 6a | Update `docs/data_pipeline.md` with Epic 5 flow |
| 6b | Accuracy validation: compare predicted pressure vs actual sensor occupancy on held-out dates |
| 6c | QA report: data coverage, zone counts, event match rate |

---

## 7. API Contract (Draft)

### GET /api/pressure

**Query params:** `at` (ISO-8601, default=now), `horizon` (enum: now/1h/3h/6h, default=now)

**Response:**
```json
{
  "generated_at": "2026-04-30T14:00:00+10:00",
  "query_time": "2026-04-30T14:00:00+10:00",
  "horizon": "now",
  "data_sources": {
    "sensors": {"status": "live", "as_of": "2026-04-30T13:58:22+10:00"},
    "traffic_profile": {"status": "historical", "data_month": "2026-04"},
    "events": {"status": "live", "count": 3}
  },
  "zones": [
    {
      "zone_id": 7250,
      "label": "Bourke St (Swanston–Elizabeth)",
      "centroid": {"lat": -37.8136, "lon": 144.9631},
      "pressure": 0.72,
      "level": "high",
      "trend": "rising",
      "components": {
        "occupancy_pct": 0.80,
        "traffic_z": 1.2,
        "event_load": 0.45
      },
      "total_bays": 76,
      "occupied_bays": 61,
      "free_bays": 15,
      "events_nearby": [
        {"name": "AFL at MCG", "starts": "19:30", "distance_m": 1200}
      ]
    }
  ]
}
```

### GET /api/pressure/alternatives

**Query params:** `lat`, `lon`, `at` (ISO-8601), `radius` (metres, default=800), `limit` (int, default=3)

**Response:**
```json
{
  "target_zone": {
    "zone_id": 7250,
    "label": "Bourke St (Swanston–Elizabeth)",
    "pressure": 0.72,
    "level": "high"
  },
  "alternatives": [
    {
      "zone_id": 7320,
      "label": "Russell St (Bourke–Little Collins)",
      "pressure": 0.32,
      "level": "low",
      "free_bays": 28,
      "walk_minutes": 8,
      "walk_distance_m": 540,
      "centroid": {"lat": -37.8128, "lon": 144.9698},
      "reason": "Lower traffic, no events nearby"
    }
  ]
}
```

---

## 8. Technical Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Aggregation unit | CoM parking zones (existing `zone_number`) | Semantic, pre-joined to sensors, no custom geo work |
| Zone boundaries | Convex hull of bay lat/lon points per zone | No external polygon dataset available. Hull = good enough for choropleth shading |
| Pressure formula | Percentile-rank weighted blend | Avoids hand-tuning sigmoid params. Rank-based = self-normalising. Easy to explain |
| Profile grouping | Weekday (Mon–Fri) vs weekend (Sat–Sun) | 15+ samples per group vs 3–4 per individual DOW. More stable |
| Traffic matching | k=3 nearest SCATS within 500m, IDW | Smooths single-detector noise. 500m cap prevents irrelevant matches |
| Heatmap library | Leaflet GeoJSON layer (built-in) | No extra dependency. Zone polygons as GeoJSON features with style function |
| Heatmap default state | Off | Avoid overwhelming new users. Discoverable via toggle button |
| Planner vs heatmap | Mutually exclusive | Both recolor map elements — avoid conflicting visual encodings |
| Forecast occupancy (v1) | Traffic profile delta only, no sensor history | Sensor backfill doesn't exist yet. Honest labeling |
| Walking time | Haversine × 1.4 / 83.3 m/min | Good enough for <1km CBD distances. No external routing API needed |
| Min bays per zone | 5 | Zones with <5 bays produce noisy occupancy %. Exclude from heatmap |
| Colour ramp | Green → amber → red (app palette) + blue → amber → red (colourblind alt) | Consistent with existing UI. Accessible option available |

---

## 9. Out of Scope (v1)

| Item | Why deferred |
|------|-------------|
| Live traffic data (TomTom, Google, VicTraffic) | No free public API. Cost + auth complexity |
| Historical sensor backfill for occupancy forecast | Requires weeks of snapshot logging before useful |
| OSRM/Google walking directions for alternatives | Adds external dependency. Haversine sufficient for v1 |
| Multi-destination trip planning | Different feature. Epic 5 is single-destination |
| Push notifications ("your zone just became busy") | Requires notification infrastructure |
| Bayesian/ML pressure model | Insufficient training data. Rank-blend is transparent and defensible |

---

## 10. Success Metrics

| Metric | Target | How to measure |
|--------|--------|---------------|
| Pressure prediction accuracy | >70% agreement between predicted level and actual sensor occupancy tertile | Offline validation on held-out week of sensor data |
| Heatmap toggle adoption | >15% of sessions enable heatmap within 2 weeks | Frontend analytics event on toggle |
| Alternative click-through rate | >25% of users shown alternatives click one | Analytics event on alternative row click |
| Time-to-park improvement (qualitative) | Positive feedback in usability testing | Post-task interview |
| Page load impact | <200ms additional load time with heatmap on | Lighthouse performance audit |

---

## 11. Dependencies & Blockers

| Dependency | Status | Owner | Blocking? |
|-----------|--------|-------|-----------|
| Eventfinda API credentials | ❌ Not obtained | Team | No — feature degrades gracefully. Events = enhancement |
| SCATS traffic data (bronze) | ✅ Fetched (April 2026, 220k rows) | Pipeline | No |
| SCATS site geo (bronze) | ✅ Fetched (344 CBD sites) | Pipeline | No |
| Silver transforms | ✅ Built (profile: 54,936 rows, 327 sites) | Pipeline | No |
| Gold transforms | ❌ Not started | Next step | Yes — blocks backend |
| Zone hull generation | ❌ Not started | Gold pipeline | Yes — blocks frontend choropleth |
| Backend pressure service | ❌ Not started | Phase 2 | Yes — blocks frontend |

---

## 12. File Map (New Files)

```
scripts/
  fetch_epic5_bronze.py          ✅ done
  clean_to_silver_epic5.py       ✅ done
  build_gold_epic5.py            ⬜ Phase 1

backend/app/
  routers/pressure.py            ⬜ Phase 2
  services/pressure_service.py   ⬜ Phase 2
  schemas/pressure.py            ⬜ Phase 2

frontend/src/
  services/apiPressure.js        ⬜ Phase 3
  hooks/usePressure.js           ⬜ Phase 3
  components/map/
    PressureLayer.jsx            ⬜ Phase 3
    PressureToggle.jsx           ⬜ Phase 3
    TimeHorizonSelector.jsx      ⬜ Phase 3
    PressureLegend.jsx           ⬜ Phase 3
  components/pressure/
    ZoneDetailPanel.jsx          ⬜ Phase 3
    DecisionCard.jsx             ⬜ Phase 4
    AlternativeRow.jsx           ⬜ Phase 4

data/gold/
  epic5_zone_bay_counts.parquet  ⬜ Phase 1
  epic5_zone_scats_map.parquet   ⬜ Phase 1
  epic5_zone_hulls.geojson       ⬜ Phase 1
  epic5_traffic_profile_zone.parquet ⬜ Phase 1
```

---

## 13. Estimated Timeline

| Phase | Duration | Can parallelise? |
|-------|----------|-----------------|
| Phase 1: Gold pipeline | 2–3 days | No (blocks Phase 2) |
| Phase 2: Backend API | 2–3 days | No (blocks Phase 3) |
| Phase 3: Frontend heatmap | 3–4 days | Partially (service + hook can start with mock data) |
| Phase 4: Decision card | 2–3 days | Yes (with Phase 5) |
| Phase 5: Polish & QA | 2–3 days | Yes (with Phase 4) |
| Phase 6: Docs & validation | 1 day | Yes |
| **Total** | **12–17 days** | |

---

## 14. Open Questions for Team

1. **Eventfinda credentials** — who will register + provision API key? Timeline?
2. **Zone label source** — `zones_to_segments` has `onstreet/streetfrom/streetto`. Good enough for zone names? Or use another source?
3. **Heatmap vs planner mutual exclusion** — acceptable? Or should they co-exist?
4. **Minimum bays threshold** — 5 bays minimum to show zone on heatmap. Team agrees?
5. **Sensor history backfill for v2** — start logging hourly sensor snapshots now so v2 has training data?
