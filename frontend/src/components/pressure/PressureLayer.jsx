import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const COLORS = {
  light: { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' },
  dark:  { low: '#4ade80', medium: '#fbbf24', high: '#f87171' },
}

function zoneRadius(totalBays) {
  return Math.max(9, Math.min(22, Math.sqrt(totalBays || 1) * 3))
}

export default function PressureLayer({ zones, isDark, onZoneClick, selectedZoneId }) {
  const map = useMap()

  useEffect(() => {
    if (!zones?.length) return

    const palette = isDark ? COLORS.dark : COLORS.light
    const markers = []

    zones.forEach((zone) => {
      if (!zone.centroid_lat || !zone.centroid_lon) return

      const color = palette[zone.level] || palette.low
      const r = zoneRadius(zone.total_bays)
      const isSelected = zone.zone_id === selectedZoneId

      const marker = L.circleMarker([zone.centroid_lat, zone.centroid_lon], {
        radius: isSelected ? r + 4 : r,
        fillColor: color,
        fillOpacity: isSelected ? 1 : 0.78,
        color: isSelected ? '#fff' : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)'),
        weight: isSelected ? 3 : 1.5,
        pane: 'markerPane',
      })

      const occPct = Math.round((zone.components?.occupancy_pct || 0) * 100)
      const levelLabel = zone.level.charAt(0).toUpperCase() + zone.level.slice(1)
      marker.bindTooltip(
        `<div style="font-size:12px;line-height:1.5;min-width:160px">` +
        `<strong style="display:block;margin-bottom:3px;font-size:13px">${zone.label}</strong>` +
        `<span style="color:${color};font-weight:700">${levelLabel}</span>` +
        ` · ${zone.free_bays} free / ${zone.total_bays} bays` +
        `<div style="color:#888;font-size:11px;margin-top:2px">${occPct}% occupied · ${zone.trend}</div>` +
        `</div>`,
        { sticky: true, className: 'pressure-tooltip', opacity: 0.98 }
      )

      marker.on('mouseover', () => {
        marker.setStyle({ fillOpacity: 1, weight: isSelected ? 3 : 2.5, radius: r + 3 })
      })
      marker.on('mouseout', () => {
        marker.setStyle({ fillOpacity: isSelected ? 1 : 0.78, weight: isSelected ? 3 : 1.5, radius: isSelected ? r + 4 : r })
      })
      marker.on('click', () => onZoneClick?.(zone))

      marker.addTo(map)
      markers.push(marker)
    })

    return () => markers.forEach((m) => map.removeLayer(m))
  }, [zones, isDark, map, onZoneClick, selectedZoneId])

  return null
}
