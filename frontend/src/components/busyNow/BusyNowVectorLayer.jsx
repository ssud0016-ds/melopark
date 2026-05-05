import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import './loadVectorGrid' // must precede leaflet.vectorgrid import
import L from 'leaflet'
import 'leaflet.vectorgrid'
import { getStatusFillColor } from '../map/ParkingMap'
import { buildTileUrlTemplate } from '../../services/apiPressure'
import { haversineMeters, SEARCH_RADIUS_M } from '../../utils/mapGeo'

/**
 * Mounts a Leaflet.VectorGrid.Protobuf layer for segment pressure tiles.
 *
 * Lifecycle (Phase 3 — A13):
 *   - Mount once when manifest first becomes available; unmount only on toggle off.
 *   - `manifest.minute_bucket` change → `setUrl(...)` only (no remount → no flicker).
 *   - `destination` / `dimRadiusM` / `colorBlindMode` / `mapThemeDark` change → `redraw()` only.
 *
 * Dimming (Phase 2 — A9, B1):
 *   When `destination` is set, segments whose midpoint (`mid_lat`/`mid_lon`,
 *   pre-baked into MVT props) lies > `dimRadiusM` from the destination drop
 *   to `opacity: 0.25`. Otherwise full `0.85`.
 */

export function styleSegment(props, { colorBlindMode = false, destination = null, dimRadiusM = SEARCH_RADIUS_M } = {}) {
  const { level = 'unknown', total = 0, mid_lat, mid_lon } = props || {}
  // B6 — zero-bay segments get a fixed mid-opacity to signal no coverage data.
  const totalNum = Number(total)
  let color
  let opacity = 0.85
  if (level === 'high') color = getStatusFillColor('occupied', colorBlindMode)
  else if (level === 'medium') color = getStatusFillColor('caution', colorBlindMode)
  else if (level === 'low') color = getStatusFillColor('available', colorBlindMode)
  else {
    color = colorBlindMode ? '#9ca3af' : '#cbd5e1'
    opacity = 0.35
  }
  // Zero-bay override: regardless of level, render at 0.5 to signal no bay data.
  if (totalNum === 0 && level !== 'unknown') {
    opacity = 0.5
  }
  // Destination-distance dimming (Phase 2 — A9 / B1). Skip when level is unknown
  // because that already renders dim grey at 0.35.
  if (
    destination &&
    typeof mid_lat === 'number' &&
    typeof mid_lon === 'number' &&
    typeof destination.lat === 'number' &&
    typeof destination.lng === 'number' &&
    level !== 'unknown'
  ) {
    const d = haversineMeters(mid_lat, mid_lon, destination.lat, destination.lng)
    if (d > dimRadiusM) opacity = 0.25
  }
  const weight = total >= 20 ? 6 : total >= 10 ? 4 : 3
  const dashArray = level === 'high' && colorBlindMode ? '6,4' : null
  return { color, weight, opacity, dashArray, lineCap: 'round', lineJoin: 'round' }
}

export default function BusyNowVectorLayer({
  manifest,
  colorBlindMode = false,
  destination = null,
  dimRadiusM = SEARCH_RADIUS_M,
  /** Leaflet dark/light map basemap — triggers canvas redraw when theme flips. */
  mapThemeDark = false,
  onSegmentClick,
}) {
  const map = useMap()
  const layerRef = useRef(null)
  // Latest style-input refs so the closure inside vectorTileLayerStyles always
  // sees the current values without rebuilding the layer.
  const styleStateRef = useRef({ colorBlindMode, destination, dimRadiusM })
  styleStateRef.current = { colorBlindMode, destination, dimRadiusM }

  const onClickRef = useRef(onSegmentClick)
  onClickRef.current = onSegmentClick

  const movingRef = useRef(false)
  const pendingUrlRef = useRef(null)
  const pendingRedrawRef = useRef(false)

  // A2 — guard so only the very first vectorGrid load event fires the perf mark.
  const paintFiredRef = useRef(false)

  // Mount once when manifest becomes available; unmount only on toggle off
  // (i.e. when manifest goes back to null/undefined). Subsequent manifest
  // refreshes flow through the dedicated setUrl effect below.
  const tileVersion = manifest?.data_version ?? manifest?.minute_bucket ?? null
  const haveManifest = Boolean(manifest)

  useEffect(() => {
    if (!map?.on || !map?.off) return
    const markMoving = () => {
      movingRef.current = true
    }
    const applyPending = () => {
      movingRef.current = false
      const layer = layerRef.current
      const pendingUrl = pendingUrlRef.current
      if (layer && pendingUrl && typeof layer.setUrl === 'function') {
        layer.setUrl(pendingUrl)
        pendingUrlRef.current = null
      }
      if (layer && pendingRedrawRef.current && typeof layer.redraw === 'function') {
        pendingRedrawRef.current = false
        layer.redraw()
      }
    }
    map.on('movestart', markMoving)
    map.on('zoomstart', markMoving)
    map.on('moveend', applyPending)
    map.on('zoomend', applyPending)
    return () => {
      map.off('movestart', markMoving)
      map.off('zoomstart', markMoving)
      map.off('moveend', applyPending)
      map.off('zoomend', applyPending)
    }
  }, [map])

  useEffect(() => {
    if (!haveManifest || !L.vectorGrid?.protobuf) return
    const url = buildTileUrlTemplate(manifest)
    if (!url) return

    // Reset paint guard each time the layer is freshly mounted.
    paintFiredRef.current = false

    // Leaflet markerPane (z=600) sits above overlayPane (z=400); bay markers intercept clicks first.
    const layer = L.vectorGrid.protobuf(url, {
      interactive: true,
      rendererFactory: L.canvas.tile,
      minZoom: manifest.min_zoom ?? 13,
      maxNativeZoom: manifest.max_zoom ?? 19,
      maxZoom: 22,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: false,
      attribution: manifest.attribution,
      vectorTileLayerStyles: {
        pressure: (props) => styleSegment(props, styleStateRef.current),
      },
      getFeatureId: (f) => f.properties.id,
    })

    layer.on('click', (e) => {
      const props = e.layer?.properties
      if (props && onClickRef.current) {
        onClickRef.current(props, e.latlng)
      }
      L.DomEvent.stop(e)
    })

    // A2 — first-paint performance mark on the first load event.
    layer.on('load', () => {
      if (paintFiredRef.current) return
      paintFiredRef.current = true
      performance.mark('busynow:paint')
      try {
        performance.measure('busynow:first-paint', 'busynow:on', 'busynow:paint')
      } catch (_e) {
        // 'busynow:on' mark may not exist if the layer mounted without a toggle
        // (e.g. server-side render or test environment).
      }
    })

    layer.addTo(map)
    layerRef.current = layer
    return () => {
      try {
        map.removeLayer(layer)
      } catch (_e) {}
      layerRef.current = null
    }
    // Mount/unmount only on toggle (haveManifest flip). manifest object identity
    // changes each refresh tick — those flow through setUrl effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haveManifest, map])

  // Re-bind tile URL when minute_bucket changes (manifest refresh tick).
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !manifest) return
    const url = buildTileUrlTemplate(manifest)
    if (!url) return
    if (typeof layer.setUrl === 'function') {
      if (movingRef.current) {
        pendingUrlRef.current = url
      } else {
        layer.setUrl(url)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileVersion])

  // Re-style on destination / dimRadius / colorBlind / basemap theme change. No fetch.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || typeof layer.redraw !== 'function') return
    if (movingRef.current) {
      pendingRedrawRef.current = true
      return
    }
    layer.redraw()
  }, [destination, dimRadiusM, colorBlindMode, mapThemeDark])

  return null
}
