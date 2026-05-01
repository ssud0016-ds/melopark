/**
 * PressureLayer.jsx
 * =================
 * Epic 5 -- Parking Pressure Heatmap Visualisation
 * FIT5120 TE31  MeloPark  Monash University
 *
 * HOW COLOURS ARE DERIVED FROM REAL DATA
 * ---------------------------------------
 * The backend pressure_service.py computes a composite score per zone:
 *
 *   score = (traffic_weight * 0.50)       <- SCATS April 2026 volume profile
 *         + (sensor_occupancy * 0.30)     <- Live CoM bay sensor (occupied/total)
 *         + (event_risk      * 0.20)      <- Eventfinda next-30-days crowd score
 *
 *   score 0-100 maps to:
 *     0-39   -> GREEN  (quiet, plenty of parking)
 *     40-69  -> ORANGE (moderate, some bays available)
 *     70-100 -> RED    (busy, limited parking)
 *
 * Colour palette: ColorBrewer RdYlGn (WCAG 2.1 AA accessible contrast ratios)
 *
 * SCORE FIELD NAMES (defensive -- API may use any of these):
 *   zone.score | zone.pressure_score | zone.components.score
 *   zone.level (low/medium/high) used as fallback when score is missing
 *
 * FEATURES
 * --------
 *   - Smooth leaflet.heat heatmap blobs (no hard polygon boundaries)
 *   - Transparent zone polygons for hover tooltip + click only
 *   - Breathing animation on live view (busy zones pulse)
 *   - Yesterday 24h playback panel (top-right, opens as popup)
 *   - Street name filter (bottom centre)
 *   - All data-based, no synthetic values
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// ── Score resolver ─────────────────────────────────────────────────────────────
// Tries every known field name the backend might use
function resolveScore(zone) {
  if (!zone) return null
  const s =
    zone.score ??
    zone.pressure_score ??
    zone.components?.score ??
    zone.components?.pressure_score ??
    null

  if (s !== null && s !== undefined) {
    const n = Number(s)
    if (!isNaN(n)) return Math.max(0, Math.min(100, n))
  }

  // Fallback: derive from level string
  const lvl = (zone.level ?? '').toLowerCase()
  if (lvl === 'high')   return 80
  if (lvl === 'medium') return 55
  if (lvl === 'low')    return 20
  return null
}

// ── Level label + colour derived consistently from score ──────────────────────
function levelFromScore(score) {
  if (score === null) return { label: 'No data', color: '#94a3b8', level: 'unknown' }
  if (score >= 70)    return { label: 'Busy',     color: '#dc2626', level: 'high'   }
  if (score >= 40)    return { label: 'Moderate', color: '#ea580c', level: 'medium' }
  return                     { label: 'Quiet',    color: '#16a34a', level: 'low'    }
}

// ── WCAG-accessible heatmap colour scale 0-100 ────────────────────────────────
// ColorBrewer RdYlGn: green(0) -> yellow(50) -> red(100)
function scoreToRgba(score, alpha = 1) {
  if (score === null) return `rgba(148,163,184,${alpha})`
  const s = Math.max(0, Math.min(100, score))
  let r, g, b
  if (s < 25) {
    const t = s / 25
    r = Math.round(26  + t * (102 - 26))
    g = Math.round(152 + t * (189 - 152))
    b = Math.round(80  + t * (99  - 80))
  } else if (s < 50) {
    const t = (s - 25) / 25
    r = Math.round(102 + t * (217 - 102))
    g = Math.round(189 + t * (239 - 189))
    b = Math.round(99  + t * (139 - 99))
  } else if (s < 75) {
    const t = (s - 50) / 25
    r = Math.round(217 + t * (253 - 217))
    g = Math.round(239 + t * (174 - 239))
    b = Math.round(139 + t * (97  - 139))
  } else {
    const t = (s - 75) / 25
    r = Math.round(253 + t * (215 - 253))
    g = Math.round(174 + t * (48  - 174))
    b = Math.round(97  + t * (39  - 97))
  }
  return `rgba(${r},${g},${b},${alpha})`
}

// ── SVG icons (no emojis) ─────────────────────────────────────────────────────
const IC_PARK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="11" height="11" rx="2.5" stroke="#3b82f6" stroke-width="1.3"/><path d="M4.5 9.5V3.5h2.8a2.1 2.1 0 0 1 0 4.2H4.5" stroke="#3b82f6" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const IC_OCC  = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6.5" cy="6.5" r="5.5" stroke="#7c3aed" stroke-width="1.3"/><path d="M6.5 3.5v3l2 1.2" stroke="#7c3aed" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const IC_UP   = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 10L10.5 3M10.5 3H6.5M10.5 3V7" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const IC_DOWN = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 3L10.5 10M10.5 10H6.5M10.5 10V6" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const IC_FLAT = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6.5H10.5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>`
const IC_PLAY = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2.5l10 5.5-10 5.5V2.5z" fill="currentColor"/></svg>`
const IC_PAUS = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>`
const IC_RESET= `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7A4.5 4.5 0 1 0 7 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.5 4v3.5H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const IC_LIVE = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" fill="#22c55e"/><circle cx="5" cy="5" r="2" fill="white"/></svg>`
const IC_SRCH = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="#94a3b8" stroke-width="1.4"/><path d="M10 10l2.5 2.5" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>`
const IC_CLOS = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`

// ── Tooltip HTML ───────────────────────────────────────────────────────────────
function buildTooltip(zone, zoneId) {
  const score    = resolveScore(zone)
  const { label: lvlLabel, color: lvlColor } = levelFromScore(score)
  const scoreStr = score !== null ? `${Math.round(score)}/100` : 'N/A'
  const free     = zone?.free_bays  ?? zone?.free  ?? '--'
  const total    = zone?.total_bays ?? zone?.total  ?? '--'
  const occRaw   = zone?.components?.occupancy_pct ?? zone?.occupancy_pct ?? null
  const occ      = occRaw !== null ? `${Math.round(Number(occRaw) * 100)}%` : '--'
  const trend    = zone?.trend ?? 'stable'
  const label    = zone?.label ?? zone?.zone_label ?? `Zone ${zoneId}`
  const trendIc  = trend === 'rising' ? IC_UP : trend === 'falling' ? IC_DOWN : IC_FLAT
  const trendTxt = trend.charAt(0).toUpperCase() + trend.slice(1)

  return (
    `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.5;min-width:210px;padding:2px 0">` +
      `<div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#0f172a;border-bottom:2px solid ${lvlColor}30;padding-bottom:5px">${label}</div>` +
      `<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">` +
        `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${lvlColor};box-shadow:0 0 6px ${lvlColor}60;flex-shrink:0"></span>` +
        `<span style="font-weight:700;color:${lvlColor};font-size:13px">${lvlLabel}</span>` +
        `<span style="color:#94a3b8;font-size:11px;margin-left:auto">Score: ${scoreStr}</span>` +
      `</div>` +
      `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:5px">` +
        `<div style="display:flex;align-items:center;gap:6px">${IC_PARK}<span style="color:#334155;font-size:12px">${free} free of ${total} bays</span></div>` +
        `<div style="display:flex;align-items:center;gap:6px">${IC_OCC}<span style="color:#334155;font-size:12px">${occ} occupied</span></div>` +
        `<div style="display:flex;align-items:center;gap:6px">${trendIc}<span style="color:#334155;font-size:12px">${trendTxt}</span></div>` +
      `</div>` +
    `</div>`
  )
}

// ── Load leaflet.heat from CDN ─────────────────────────────────────────────────
let _heatPromise = null
function ensureHeat() {
  if (typeof L !== 'undefined' && L.heatLayer) return Promise.resolve()
  if (_heatPromise) return _heatPromise
  _heatPromise = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js'
    s.onload = () => { _heatPromise = null; resolve() }
    s.onerror = () => { _heatPromise = null; resolve() }
    document.head.appendChild(s)
  })
  return _heatPromise
}

// ── Centroid of GeoJSON feature ───────────────────────────────────────────────
function centroid(feature) {
  const coords = feature.geometry?.coordinates
  if (!coords) return null
  const flat = []
  const flatten = (c) => (typeof c[0] === 'number' ? flat.push(c) : c.forEach(flatten))
  flatten(coords)
  if (!flat.length) return null
  return [
    flat.reduce((s, p) => s + p[1], 0) / flat.length,
    flat.reduce((s, p) => s + p[0], 0) / flat.length,
  ]
}

// ── Build zone lookup from zones array ────────────────────────────────────────
function buildZoneMap(zones) {
  const m = new Map()
  if (!zones?.length) return m
  zones.forEach((z) => {
    ;[z.zone_id, z.zone_number, z.id, z.zone].forEach((k) => {
      if (k != null) { m.set(k, z); m.set(String(k), z) }
    })
  })
  return m
}

// ── Heatmap point list ─────────────────────────────────────────────────────────
function buildHeatPoints(hulls, zoneMap, pulseBoost = 0) {
  const pts = []
  if (!hulls?.features) return pts
  hulls.features.forEach((f) => {
    const zoneId = f.properties?.zone_number ?? f.properties?.zone_id ?? f.properties?.id ?? f.properties?.zone
    const zone   = zoneMap.get(zoneId) ?? zoneMap.get(String(zoneId))
    const score  = resolveScore(zone)
    const c      = centroid(f)
    if (!c || score === null) return
    const boost = score >= 70 ? pulseBoost * 0.10 : 0
    pts.push([c[0], c[1], Math.min(1, score / 100 + boost)])
  })
  return pts
}

// ── Melbourne-time hours for yesterday ───────────────────────────────────────
function yesterdayHours() {
  const melOffset = 10 * 3600000
  const now       = new Date(Date.now() + melOffset)
  const yday      = new Date(now)
  yday.setUTCDate(yday.getUTCDate() - 1)
  yday.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: 24 }, (_, h) => {
    const t = new Date(yday.getTime() + h * 3600000)
    const iso = t.toISOString().replace('Z', '+10:00')
    return { label: `${String(h).padStart(2, '0')}:00`, iso }
  })
}

const HOURS = yesterdayHours()

// ── Base API URL ───────────────────────────────────────────────────────────────
function apiBase() {
  try { return (import.meta.env?.VITE_API_URL ?? '').replace(/\/$/, '') }
  catch { return '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PressureLayer({ hulls, zones, isDark, onZoneClick }) {
  const map        = useMap()
  const heatRef    = useRef(null)
  const geoRef     = useRef(null)
  const animRef    = useRef(null)

  // Playback
  const [showPlayback, setShowPlayback] = useState(false)
  const [playing,      setPlaying]      = useState(false)
  const [playIdx,      setPlayIdx]      = useState(0)
  const [playZones,    setPlayZones]    = useState(null)
  const [fetching,     setFetching]     = useState(false)

  // Street filter
  const [inputVal,  setInputVal]  = useState('')
  const [filterStr, setFilterStr] = useState('')

  // ── Fetch one hour of pressure data ────────────────────────────────────────
  const fetchHour = useCallback(async (idx) => {
    try {
      const iso  = HOURS[idx].iso
      const resp = await fetch(`${apiBase()}/api/pressure?at=${encodeURIComponent(iso)}&horizon=now`)
      if (!resp.ok) return null
      const data = await resp.json()
      return data.zones ?? null
    } catch { return null }
  }, [])

  // ── Playback ticker ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || !showPlayback) return
    const go = async () => {
      setFetching(true)
      const data = await fetchHour(playIdx)
      if (data) setPlayZones(data)
      setFetching(false)
      setPlayIdx((i) => (i + 1) % 24)
    }
    const id = setInterval(go, 1200)
    return () => clearInterval(id)
  }, [playing, playIdx, showPlayback, fetchHour])

  // Reset playZones when hiding playback
  useEffect(() => { if (!showPlayback) { setPlayZones(null); setPlaying(false) } }, [showPlayback])

  // ── Render heatmap + zone polygons ─────────────────────────────────────────
  useEffect(() => {
    if (!hulls) return
    const activeZones = playZones ?? zones ?? []
    const zoneMap     = buildZoneMap(activeZones)
    const filterLow   = filterStr.toLowerCase().trim()

    ensureHeat().then(() => {
      if (!L.heatLayer) { console.warn('leaflet.heat failed to load'); return }

      // Clear previous
      if (animRef.current)  { cancelAnimationFrame(animRef.current); animRef.current = null }
      if (heatRef.current)  { map.removeLayer(heatRef.current);  heatRef.current = null }
      if (geoRef.current)   { map.removeLayer(geoRef.current);   geoRef.current  = null }

      // ── Heatmap layer ───────────────────────────────────────────────────────
      const heat = L.heatLayer(buildHeatPoints(hulls, zoneMap, 0), {
        radius:     68,
        blur:       52,
        maxZoom:    18,
        max:        1.0,
        minOpacity: 0.25,
        gradient: {
          0.00: 'rgba(22,163,74,0)',     // transparent (no data)
          0.15: 'rgba(22,163,74,0.65)', // green
          0.35: 'rgba(101,163,63,0.80)',// lime
          0.50: 'rgba(202,211,89,0.88)',// yellow-green
          0.62: 'rgba(250,204,21,0.92)',// yellow
          0.74: 'rgba(234,88,12,0.96)', // orange
          0.86: 'rgba(220,38,38,0.98)', // red
          1.00: 'rgba(127,29,29,1)',    // deep red
        },
      })
      heat.addTo(map)
      heatRef.current = heat

      // ── Invisible zone polygons for interaction ─────────────────────────────
      const lyrRefs = []

      const geo = L.geoJSON(hulls, {
        style: () => ({ fillOpacity: 0, color: 'transparent', weight: 0, opacity: 0 }),
        onEachFeature: (feature, lyr) => {
          const zoneId = feature.properties?.zone_number ?? feature.properties?.zone_id ?? feature.properties?.id ?? feature.properties?.zone
          const zone   = zoneMap.get(zoneId) ?? zoneMap.get(String(zoneId))
          const score  = resolveScore(zone)
          const { color: lvlColor } = levelFromScore(score)
          const label  = (zone?.label ?? zone?.zone_label ?? String(zoneId)).toLowerCase()
          const matches = !filterLow || label.includes(filterLow)

          lyrRefs.push({ lyr, zone, score, matches })

          if (!matches) return

          lyr.bindTooltip(
            zone ? buildTooltip(zone, zoneId) : `<div style="font-size:13px;font-weight:600">Zone ${zoneId}</div>`,
            { sticky: true, className: 'pressure-tooltip', opacity: 0.98, offset: [0, -8] }
          )
          lyr.on('mouseover', function () {
            this.setStyle({ fillColor: lvlColor, fillOpacity: 0.22, color: lvlColor, weight: 2.5, opacity: 0.85 })
            this.bringToFront()
          })
          lyr.on('mouseout', function () {
            this.setStyle({ fillOpacity: 0, color: 'transparent', weight: 0, opacity: 0 })
          })
          lyr.on('click', () => { if (onZoneClick && zone) onZoneClick(zone) })
        },
      })
      geo.addTo(map)
      geoRef.current = geo

      // ── Fly to filtered zones ───────────────────────────────────────────────
      if (filterLow && hulls.features) {
        const matching = hulls.features.filter((f) => {
          const zid = f.properties?.zone_number ?? f.properties?.zone_id ?? f.properties?.id
          const z   = zoneMap.get(zid) ?? zoneMap.get(String(zid))
          return (z?.label ?? z?.zone_label ?? '').toLowerCase().includes(filterLow)
        })
        if (matching.length) {
          try {
            const b = L.geoJSON({ type: 'FeatureCollection', features: matching }).getBounds()
            if (b.isValid()) map.fitBounds(b, { padding: [80, 80], maxZoom: 17 })
          } catch (_) {}
        }
      }

      // ── Breathing animation (live only) ────────────────────────────────────
      if (!playZones) {
        let tick = 0
        const animate = () => {
          tick++
          const pulse  = 0.5 + 0.5 * Math.sin(tick * 0.035)
          const radius = 64 + pulse * 10
          const blur   = 48 + pulse * 10
          if (heatRef.current) {
            heatRef.current.setLatLngs(buildHeatPoints(hulls, zoneMap, pulse))
            if (heatRef.current.setOptions) heatRef.current.setOptions({ radius, blur })
            heatRef.current.redraw()
          }
          animRef.current = requestAnimationFrame(animate)
        }
        animRef.current = requestAnimationFrame(animate)
      }
    })

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null }
      if (geoRef.current)  { map.removeLayer(geoRef.current);  geoRef.current  = null }
    }
  }, [hulls, zones, isDark, map, onZoneClick, playZones, filterStr])

  // ── UI PANELS (rendered via portal-style absolute divs) ───────────────────
  return (
    <>
      {/* ── Street Filter — bottom centre ───────────────────────────────────── */}
      <div
        className="pointer-events-auto"
        style={{ position: 'absolute', bottom: '86px', left: '50%', transform: 'translateX(-50%)', zIndex: 500 }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200/70 bg-white/96 px-3.5 py-2 shadow-xl backdrop-blur-md dark:border-gray-700/60 dark:bg-slate-900/96">
          <span dangerouslySetInnerHTML={{ __html: IC_SRCH }} />
          <input
            className="w-48 bg-transparent text-[12px] text-gray-700 placeholder-gray-400 outline-none dark:text-gray-200"
            placeholder="Filter by street name..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  setFilterStr(inputVal)
              if (e.key === 'Escape') { setInputVal(''); setFilterStr('') }
            }}
          />
          {inputVal && (
            <button
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => { setInputVal(''); setFilterStr('') }}
              dangerouslySetInnerHTML={{ __html: IC_CLOS }}
            />
          )}
          {filterStr && <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ON</span>}
        </div>
      </div>

      {/* ── Yesterday's Demand button — top right ───────────────────────────── */}
      <div
        className="pointer-events-auto"
        style={{ position: 'absolute', top: '60px', right: '14px', zIndex: 510 }}
      >
        <button
          className={[
            'flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold shadow-lg backdrop-blur-sm transition-all',
            showPlayback
              ? 'border-blue-400 bg-blue-500 text-white shadow-blue-200 dark:shadow-blue-900/40'
              : 'border-gray-200/70 bg-white/95 text-gray-700 hover:bg-gray-50 dark:border-gray-700/60 dark:bg-slate-900/95 dark:text-gray-200',
          ].join(' ')}
          onClick={() => setShowPlayback((v) => !v)}
          title="Yesterday's demand playback"
        >
          {/* Clock SVG */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7.5 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Yesterday
        </button>

        {/* ── Playback popup panel ──────────────────────────────────────────── */}
        {showPlayback && (
          <div className="absolute right-0 top-12 w-80 rounded-2xl border border-gray-200/60 bg-white/98 shadow-2xl backdrop-blur-md dark:border-gray-700/50 dark:bg-slate-900/98 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Yesterday&apos;s Demand</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Replay 24h parking pressure</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setShowPlayback(false)}
                dangerouslySetInnerHTML={{ __html: IC_CLOS }}
              />
            </div>

            {/* Time display */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[22px] font-bold tabular-nums text-gray-800 dark:text-gray-100">
                  {HOURS[playIdx]?.label}
                </span>
                <div className="flex items-center gap-2">
                  {fetching && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                  )}
                  {!playing && !playZones && (
                    <span className="flex items-center gap-1 text-[11px] text-green-600 font-semibold">
                      <span dangerouslySetInnerHTML={{ __html: IC_LIVE }} />
                      Live
                    </span>
                  )}
                  {playZones && (
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      REPLAY
                    </span>
                  )}
                </div>
              </div>

              {/* Timeline scrubber */}
              <input
                type="range"
                min={0}
                max={23}
                value={playIdx}
                className="w-full h-2 accent-blue-500 cursor-pointer"
                onChange={async (e) => {
                  const idx = Number(e.target.value)
                  setPlayIdx(idx)
                  setPlaying(false)
                  setFetching(true)
                  const data = await fetchHour(idx)
                  if (data) setPlayZones(data)
                  setFetching(false)
                }}
              />

              {/* Hour axis labels */}
              <div className="flex justify-between mt-1 text-[9px] text-gray-400 select-none">
                <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${(playIdx / 23) * 100}%`,
                    background: 'linear-gradient(to right, #16a34a, #eab308, #dc2626)',
                  }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 px-4 pb-4 pt-2">
              {/* Reset */}
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-300"
                onClick={() => { setPlayIdx(0); setPlaying(false); setPlayZones(null) }}
                title="Reset to midnight"
                dangerouslySetInnerHTML={{ __html: IC_RESET }}
              />

              {/* Play / Pause */}
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
                style={{ background: playing ? '#dc2626' : '#2563eb' }}
                onClick={() => setPlaying((v) => !v)}
                title={playing ? 'Pause' : 'Play 24h replay'}
              >
                <span
                  className="text-white"
                  dangerouslySetInnerHTML={{ __html: playing ? IC_PAUS : IC_PLAY }}
                />
              </button>

              {/* Return to live */}
              <button
                className="flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-semibold text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-300"
                onClick={() => { setPlaying(false); setPlayIdx(0); setPlayZones(null) }}
                title="Return to live view"
              >
                <span dangerouslySetInnerHTML={{ __html: IC_LIVE }} />
                Live
              </button>
            </div>

            {/* Data source note */}
            <div className="border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Data: SCATS traffic + CoM sensors + Eventfinda events
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
