import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// ── Colour helpers ────────────────────────────────────────────────────────────
function scoreToColor(score, alpha = 1) {
  const s = Math.max(0, Math.min(100, score))
  let r, g, b
  if (s < 40) {
    const t = s / 40
    r = Math.round(60  + t * (180 - 60))
    g = Math.round(200 + t * (210 - 200))
    b = Math.round(60  + t * (30  - 60))
  } else if (s < 70) {
    const t = (s - 40) / 30
    r = Math.round(180 + t * (255 - 180))
    g = Math.round(210 + t * (150 - 210))
    b = Math.round(30  + t * (20  - 30))
  } else {
    const t = (s - 70) / 30
    r = 255
    g = Math.round(150 + t * (50  - 150))
    b = Math.round(20  + t * (50  - 20))
  }
  return `rgba(${r},${g},${b},${alpha})`
}

function getBorderColor(score, isDark) {
  const s = Math.max(0, Math.min(100, score))
  if (isDark) {
    if (s < 40) return 'rgba(100,220,80,0.8)'
    if (s < 70) return 'rgba(255,180,50,0.8)'
    return 'rgba(255,80,80,0.8)'
  }
  if (s < 40) return 'rgba(30,140,30,0.7)'
  if (s < 70) return 'rgba(190,110,0,0.7)'
  return 'rgba(190,20,20,0.7)'
}

// ── SVG Icons for tooltip ─────────────────────────────────────────────────────
const PARKING_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" rx="2.5" stroke="#3b82f6" stroke-width="1.3"/><path d="M4.5 9.5V3.5h2.8a2.1 2.1 0 0 1 0 4.2H4.5" stroke="#3b82f6" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const OCC_ICON    = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#8b5cf6" stroke-width="1.3"/><path d="M6.5 3.5v3l2 1.2" stroke="#8b5cf6" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const UP_ICON     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 10L10.5 3M10.5 3H6.5M10.5 3V7" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const DOWN_ICON   = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 3L10.5 10M10.5 10H6.5M10.5 10V6" stroke="#22c55e" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const FLAT_ICON   = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5H10.5" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>`

function buildTooltip(zone, zoneId) {
  const score    = zone?.score ?? 0
  const freeBays = zone?.free_bays  ?? '--'
  const totBays  = zone?.total_bays ?? '--'
  const occPct   = Math.round((zone?.components?.occupancy_pct ?? 0) * 100)
  const trend    = zone?.trend ?? 'stable'
  const label    = zone?.label ?? `Zone ${zoneId}`
  const lvl      = zone?.level ?? (score > 70 ? 'high' : score > 40 ? 'medium' : 'low')
  const lvlLabel = lvl === 'high' ? 'Busy' : lvl === 'medium' ? 'Moderate' : 'Quiet'
  const dotColor = scoreToColor(score, 1)
  const trendIcon = trend === 'rising' ? UP_ICON : trend === 'falling' ? DOWN_ICON : FLAT_ICON
  const trendLabel = trend.charAt(0).toUpperCase() + trend.slice(1)

  return (
    `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.5;min-width:195px;padding:2px 0">` +
    `<div style="font-weight:700;font-size:14px;margin-bottom:5px;color:#0f172a">${label}</div>` +
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">` +
    `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor}80"></span>` +
    `<span style="font-weight:700;color:${dotColor}">${lvlLabel}</span>` +
    `<span style="color:#94a3b8;font-size:11px;margin-left:2px">Score: ${Math.round(score)} / 100</span>` +
    `</div>` +
    `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:7px 9px;display:flex;flex-direction:column;gap:4px">` +
    `<div style="display:flex;align-items:center;gap:6px">${PARKING_ICON}<span style="color:#334155;font-size:12px">${freeBays} free of ${totBays} bays</span></div>` +
    `<div style="display:flex;align-items:center;gap:6px">${OCC_ICON}<span style="color:#334155;font-size:12px">${occPct}% occupied</span></div>` +
    `<div style="display:flex;align-items:center;gap:6px">${trendIcon}<span style="color:#334155;font-size:12px">${trendLabel}</span></div>` +
    `</div>` +
    `</div>`
  )
}

// ── Load leaflet.heat dynamically ─────────────────────────────────────────────
function loadHeat() {
  return new Promise((resolve) => {
    if (L.heatLayer) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js'
    script.onload = resolve
    document.head.appendChild(script)
  })
}

export default function PressureLayer({ hulls, zones, isDark, onZoneClick }) {
  const map        = useMap()
  const heatRef    = useRef(null)
  const zoneRef    = useRef(null)
  const animRef    = useRef(null)
  const tickRef    = useRef(0)

  useEffect(() => {
    if (!hulls || !zones?.length) return

    // Build zone lookup
    const zoneMap = new Map()
    zones.forEach((z) => {
      ;[z.zone_id, z.zone_number, z.id].forEach((key) => {
        if (key != null) {
          zoneMap.set(key, z)
          zoneMap.set(String(key), z)
        }
      })
    })

    // Compute centroid of each GeoJSON feature
    function centroid(feature) {
      const coords = feature.geometry?.coordinates
      if (!coords) return null
      const flat = []
      function flatten(c) {
        if (typeof c[0] === 'number') flat.push(c)
        else c.forEach(flatten)
      }
      flatten(coords)
      if (!flat.length) return null
      const lat = flat.reduce((s, p) => s + p[1], 0) / flat.length
      const lng = flat.reduce((s, p) => s + p[0], 0) / flat.length
      return [lat, lng]
    }

    // Build heatmap points: [lat, lng, intensity]
    const heatPoints = []
    hulls.features?.forEach((f) => {
      const zoneId = f.properties?.zone_number ?? f.properties?.zone_id ?? f.properties?.id
      const zone   = zoneMap.get(zoneId) ?? zoneMap.get(String(zoneId))
      const score  = zone?.score ?? (zone?.level === 'high' ? 85 : zone?.level === 'medium' ? 55 : 20)
      const c      = centroid(f)
      if (c) heatPoints.push([c[0], c[1], score / 100])
    })

    // ── Heatmap layer ─────────────────────────────────────────────────────────
    loadHeat().then(() => {
      if (heatRef.current) map.removeLayer(heatRef.current)

      const heat = L.heatLayer(heatPoints, {
        radius:    55,
        blur:      40,
        maxZoom:   17,
        max:       1.0,
        minOpacity: 0.35,
        gradient: {
          0.0:  '#0000ff',   // blue  (very quiet -- rare edge)
          0.25: '#00cc44',   // green (quiet)
          0.45: '#aaee00',   // yellow-green
          0.60: '#ffdd00',   // yellow
          0.75: '#ff8800',   // orange
          0.90: '#ff3300',   // red-orange
          1.0:  '#cc0000',   // deep red (very busy)
        },
      })
      heat.addTo(map)
      heatRef.current = heat

      // ── Zone polygon overlay (transparent, for interaction) ───────────────
      const featureLayers = []

      const geoLayer = L.geoJSON(hulls, {
        style: (feature) => {
          const zoneId = feature.properties?.zone_number ?? feature.properties?.zone_id ?? feature.properties?.id
          const zone   = zoneMap.get(zoneId) ?? zoneMap.get(String(zoneId))
          const score  = zone?.score ?? 20
          return {
            fillColor:   scoreToColor(score, 0.08),
            fillOpacity: 0.08,
            color:       getBorderColor(score, isDark),
            weight:      1.2,
            opacity:     0.6,
          }
        },
        onEachFeature: (feature, lyr) => {
          const zoneId = feature.properties?.zone_number ?? feature.properties?.zone_id ?? feature.properties?.id
          const zone   = zoneMap.get(zoneId) ?? zoneMap.get(String(zoneId))
          const score  = zone?.score ?? 20

          featureLayers.push({ lyr, zone, score })

          lyr.bindTooltip(
            zone ? buildTooltip(zone, zoneId) : `<div style="font-size:13px">Zone ${zoneId}</div>`,
            { sticky: true, className: 'pressure-tooltip', opacity: 0.98, offset: [0, -6] }
          )

          lyr.on('mouseover', function () {
            this.setStyle({
              fillOpacity: 0.35,
              weight:      2.5,
              fillColor:   scoreToColor(score, 0.35),
              color:       getBorderColor(score, isDark),
            })
            this.bringToFront()
          })
          lyr.on('mouseout', function () {
            this.setStyle({
              fillColor:   scoreToColor(score, 0.08),
              fillOpacity: 0.08,
              color:       getBorderColor(score, isDark),
              weight:      1.2,
              opacity:     0.6,
            })
          })
          lyr.on('click', () => {
            if (onZoneClick && zone) onZoneClick(zone)
          })
        },
      })

      geoLayer.addTo(map)
      zoneRef.current = geoLayer

      // ── Animated heatmap pulse ────────────────────────────────────────────
      // Varies the radius and opacity to give a breathing effect
      let tick = 0
      const animate = () => {
        tick++
        const pulse  = 0.5 + 0.5 * Math.sin(tick * 0.04)
        const radius = 50 + pulse * 12
        const blur   = 36 + pulse * 10

        if (heatRef.current && heatRef.current.setOptions) {
          heatRef.current.setOptions({ radius, blur })
          heatRef.current.redraw()
        }

        animRef.current = requestAnimationFrame(animate)
      }
      animRef.current = requestAnimationFrame(animate)
    })

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (heatRef.current)  { map.removeLayer(heatRef.current);  heatRef.current = null }
      if (zoneRef.current)  { map.removeLayer(zoneRef.current);  zoneRef.current = null }
    }
  }, [hulls, zones, isDark, map, onZoneClick])

  return null
}
