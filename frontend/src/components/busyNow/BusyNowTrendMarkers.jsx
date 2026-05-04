import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { fetchQuietestSegments } from '../../services/apiPressure'

const TREND_ZOOM_MIN = 16
const MAX_MARKERS = 50
const FETCH_DEBOUNCE_MS = 800

/**
 * Trend arrows at zoom >= 16. Uses parent-fetched `quietSegments` when provided
 * (same data as useQuietestSegments limit=150); otherwise debounced fetch.
 */
export default function BusyNowTrendMarkers({
  map,
  busyNow,
  quietSegments = undefined,
  colorBlindMode = false,
}) {
  const markersRef = useRef([])
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!busyNow || !map) return

    const arrowColor = colorBlindMode ? '#f59e0b' : '#374151'

    function clearMarkers() {
      markersRef.current.forEach((m) => {
        try {
          map.removeLayer(m)
        } catch (_e) {}
      })
      markersRef.current = []
    }

    function renderFromSegments(segments) {
      clearMarkers()
      const zoom = map.getZoom()
      if (zoom < TREND_ZOOM_MIN) return

      const sparse = (Array.isArray(segments) ? segments : [])
        .filter((seg) => seg.trend && Number(seg.segment_id) % 3 === 0)
        .slice(0, MAX_MARKERS)

      sparse.forEach((seg) => {
        if (typeof seg.mid_lat !== 'number' || typeof seg.mid_lon !== 'number') return

        let arrow = '→'
        let ariaLabel = 'steady'
        if (seg.trend === 'up') {
          arrow = '↑'
          ariaLabel = 'rising'
        } else if (seg.trend === 'down') {
          arrow = '↓'
          ariaLabel = 'falling'
        }

        const icon = L.divIcon({
          className: 'busy-trend-marker',
          html: `<div aria-label="${ariaLabel}" role="img" style="font-size:12px;line-height:1;user-select:none;color:${arrowColor}">${arrow}</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        const marker = L.marker([seg.mid_lat, seg.mid_lon], {
          icon,
          interactive: false,
        }).addTo(map)

        markersRef.current.push(marker)
      })
    }

    function runFetchForBounds(b) {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      fetchQuietestSegments(b, 150, { signal: controller.signal })
        .then((segments) => {
          renderFromSegments(segments)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
        })
    }

    function handleViewChange() {
      const b = map.getBounds()
      const bb = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      }

      if (Array.isArray(quietSegments)) {
        renderFromSegments(quietSegments)
        return
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        const zoom = map.getZoom()
        if (zoom < TREND_ZOOM_MIN || !bb) {
          clearMarkers()
          return
        }
        runFetchForBounds(bb)
      }, FETCH_DEBOUNCE_MS)
    }

    handleViewChange()

    map.on('zoomend', handleViewChange)
    map.on('moveend', handleViewChange)

    return () => {
      map.off('zoomend', handleViewChange)
      map.off('moveend', handleViewChange)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
      clearMarkers()
    }
  }, [map, busyNow, quietSegments, colorBlindMode])

  return null
}
