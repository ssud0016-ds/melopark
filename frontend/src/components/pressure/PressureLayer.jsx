import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const LEVEL_COLORS = {
  low: '#a3ec48',
  medium: '#FFB382',
  high: '#ed6868',
}

const LEVEL_COLORS_DARK = {
  low: '#6bbf2a',
  medium: '#e08a50',
  high: '#d44',
}

function getStyle(feature, zoneMap, isDark) {
  const zoneId = feature.properties?.zone_number
  const zone = zoneMap.get(zoneId)
  const level = zone?.level || 'low'
  const colors = isDark ? LEVEL_COLORS_DARK : LEVEL_COLORS
  return {
    fillColor: colors[level] || colors.low,
    fillOpacity: 0.55,
    color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
    weight: 1,
    opacity: 0.8,
  }
}

export default function PressureLayer({ hulls, zones, isDark, onZoneClick }) {
  const map = useMap()

  useEffect(() => {
    if (!hulls || !zones?.length) return

    const zoneMap = new Map(zones.map((z) => [z.zone_id, z]))

    const layer = L.geoJSON(hulls, {
      style: (feature) => getStyle(feature, zoneMap, isDark),
      onEachFeature: (feature, lyr) => {
        const zoneId = feature.properties?.zone_number
        const zone = zoneMap.get(zoneId)
        const colors = isDark ? LEVEL_COLORS_DARK : LEVEL_COLORS
        const baseStyle = getStyle(feature, zoneMap, isDark)

        lyr.on('mouseover', () => {
          lyr.setStyle({ ...baseStyle, fillOpacity: 0.75, weight: 2.5 })
        })
        lyr.on('mouseout', () => {
          lyr.setStyle(baseStyle)
        })

        if (zone) {
          const occPct = Math.round((zone.components?.occupancy_pct || 0) * 100)
          lyr.bindTooltip(
            `<div style="font-size:12px;line-height:1.4">` +
            `<strong style="display:block;margin-bottom:2px">${zone.label}</strong>` +
            `<span style="color:${colors[zone.level]};font-weight:600">${zone.level.charAt(0).toUpperCase() + zone.level.slice(1)}</span>` +
            ` · ${zone.free_bays} free / ${zone.total_bays} bays` +
            `<br/><span style="color:#888;font-size:11px">${occPct}% occupied · ${zone.trend}</span>` +
            `</div>`,
            { sticky: true, className: 'pressure-tooltip', opacity: 0.95 }
          )
        }
        lyr.on('click', () => {
          if (onZoneClick && zone) onZoneClick(zone)
        })
      },
    })

    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [hulls, zones, isDark, map, onZoneClick])

  return null
}
