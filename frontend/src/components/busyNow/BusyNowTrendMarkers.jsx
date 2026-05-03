import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { fetchQuietestSegments } from '../../services/apiPressure'

const TREND_ZOOM_MIN = 16
const MAX_MARKERS = 50

/**
 * Renders tiny trend-arrow DivMarkers at zoom >= 16.
 *
 * Accepts:
 *   map      — raw Leaflet map instance (from mapRef or useMap())
 *   busyNow  — boolean; when falsy the component does nothing
 *   bounds   — { west, south, east, north } viewport from onBoundsChange
 *
 * Markers are created with L.divIcon and stored in a ref array so they can be
 * cleared cleanly on every re-render (zoom change or bounds change).
 * Sparse filter: only segments where segment_id % 3 === 0 (max 50 markers).
 */
export default function BusyNowTrendMarkers({ map, busyNow, bounds }) {
  const markersRef = useRef([])
  // Keep a ref to the latest abort controller so concurrent fetches cancel cleanly.
  const abortRef = useRef(null)

  useEffect(() => {
    if (!busyNow || !map) return

    function clearMarkers() {
      markersRef.current.forEach((m) => {
        try { map.removeLayer(m) } catch (_e) {}
      })
      markersRef.current = []
    }

    function renderMarkersForBounds(b) {
      // Cancel any in-flight fetch.
      if (abortRef.current) {
        abortRef.current.abort()
      }

      clearMarkers()

      const zoom = map.getZoom()
      if (zoom < TREND_ZOOM_MIN || !b) return

      const controller = new AbortController()
      abortRef.current = controller

      fetchQuietestSegments(b, 150, { signal: controller.signal })
        .then((segments) => {
          clearMarkers()

          // Sparse filter: every segment whose id % 3 === 0; cap at MAX_MARKERS.
          const sparse = (Array.isArray(segments) ? segments : [])
            .filter((seg) => seg.trend && Number(seg.segment_id) % 3 === 0)
            .slice(0, MAX_MARKERS)

          sparse.forEach((seg) => {
            if (
              typeof seg.mid_lat !== 'number' ||
              typeof seg.mid_lon !== 'number'
            ) return

            let arrow = '→'
            let ariaLabel = 'steady'
            if (seg.trend === 'up') { arrow = '↑'; ariaLabel = 'rising' }
            else if (seg.trend === 'down') { arrow = '↓'; ariaLabel = 'falling' }

            const icon = L.divIcon({
              className: 'busy-trend-marker',
              html: `<div aria-label="${ariaLabel}" role="img" style="font-size:12px;line-height:1;user-select:none;">${arrow}</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })

            const marker = L.marker([seg.mid_lat, seg.mid_lon], {
              icon,
              interactive: false,
            }).addTo(map)

            markersRef.current.push(marker)
          })
        })
        .catch(() => {
          // AbortError on cleanup is expected; ignore all errors silently.
        })
    }

    // Initial render for current bounds.
    renderMarkersForBounds(bounds)

    // Re-render on map move/zoom.
    function handleViewChange() {
      const b = map.getBounds()
      renderMarkersForBounds({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      })
    }

    map.on('zoomend', handleViewChange)
    map.on('moveend', handleViewChange)

    return () => {
      map.off('zoomend', handleViewChange)
      map.off('moveend', handleViewChange)
      if (abortRef.current) abortRef.current.abort()
      clearMarkers()
    }
  }, [map, busyNow, bounds])

  return null
}
