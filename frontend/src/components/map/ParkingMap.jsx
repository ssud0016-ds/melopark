import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import {
  bayLatLng,
  destinationLatLng,
  SEARCH_RADIUS_M,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
  MELBOURNE_MAX_BOUNDS,
  MELBOURNE_MIN_ZOOM,
  MELBOURNE_MAX_ZOOM,
} from '../../utils/mapGeo'
import { bayHeading } from '../../utils/bayLabels'
import BusyNowVectorLayer from '../busyNow/BusyNowVectorLayer'
import BusyNowTrendMarkers from '../busyNow/BusyNowTrendMarkers'
const CLUSTER_ZOOM_CUTOFF = 18

/** Mobile cluster-mode hint (non-interactive). */
export const MOBILE_CLUSTER_ZOOM_HINT = 'Zoom in to view individual bays'

/** Bay-dot fill colours (match map legend): lime / peach / red. */
const VERIFIED_FILL = {
  available: '#a3ec48',
  trap: '#FFB382',
  occupied: '#ed6868',
}
const VERIFIED_FILL_COLOR_BLIND = {
  available: '#3b82f6',
  trap: '#f59e0b',
  occupied: '#374151',
}

export function getStatusFillColor(status, colorBlindMode = false) {
  const palette = colorBlindMode ? VERIFIED_FILL_COLOR_BLIND : VERIFIED_FILL
  if (status === 'caution' || status === 'trap' || status === 'unknown') return palette.trap
  if (status === 'occupied') return palette.occupied
  return palette.available
}

export function getClusterBadgeColors({ available, occupied, trap, total, isDark, colorBlindMode = false }) {
  const a = Number(available) || 0
  const t = Number(total) || 0
  const ratio = t > 0 ? a / t : 0

  let bg, text

  if (colorBlindMode) {
    // Color-blind palette: preserve existing accessible colors
    if (t === 0 || ratio === 0) {
      bg = getStatusFillColor('occupied', true); text = '#f3f4f6'
    } else if (ratio >= 0.40) {
      bg = getStatusFillColor('available', true); text = '#f3f4f6'
    } else if (ratio >= 0.15) {
      bg = getStatusFillColor('caution', true); text = '#512500'
    } else {
      bg = getStatusFillColor('occupied', true); text = '#f3f4f6'
    }
  } else {
    // Semantic status palette: green/amber/red by availability ratio
    if (t === 0) {
      bg = isDark ? '#374151' : '#e2e8f0'; text = isDark ? '#9ca3af' : '#64748b'
    } else if (ratio >= 0.40) {
      bg = '#16a34a'; text = '#ffffff'  // status-good green
    } else if (ratio >= 0.15) {
      bg = '#d97706'; text = '#ffffff'  // status-caution amber
    } else {
      bg = '#dc2626'; text = '#ffffff'  // status-avoid red
    }
  }

  return { bg, text }
}

function markerStatusFromBay(bay, plannerMapActive, verdictByBayId) {
  if (plannerMapActive && verdictByBayId) {
    const pv = verdictByBayId[bay.id]
    if (pv === 'yes') return bay.free === 1 ? 'available' : 'occupied'
    if (pv === 'no') return 'occupied'
    return 'unknown'
  }
  if (bay.type === 'trap') return 'caution'
  if (bay.type === 'occupied') return 'occupied'
  return 'available'
}

export function getBayMarkerPathOptions(status, fillColor, opacity, colorBlindMode = false) {
  void status
  void colorBlindMode
  return {
    color: fillColor,
    fillColor,
    fillOpacity: opacity,
    opacity,
    weight: 0,
  }
}

function verifiedBayFillColor(bay, plannerMapActive, verdictByBayId, colorBlindMode = false) {
  if (plannerMapActive && verdictByBayId) {
    const pv = verdictByBayId[bay.id]
    if (pv === 'yes') {
      // Rules allow: free bays are green; occupied stays red (3-state legend only).
      return getStatusFillColor(bay.free === 1 ? 'available' : 'occupied', colorBlindMode)
    }
    if (pv === 'no') return getStatusFillColor('occupied', colorBlindMode)
    // Strict 3-state legend semantics: unknown maps to occupied/red (conservative).
    return getStatusFillColor('unknown', colorBlindMode)
  }
  const status = bay.type === 'trap' ? 'caution' : bay.type === 'occupied' ? 'occupied' : 'available'
  return getStatusFillColor(status, colorBlindMode)
}

/** Sensor-only bays: colour from occupancy only (same palette as verified legend). */
function sensorOccupancyFillColor(bay, colorBlindMode = false) {
  const status = bay.type === 'trap' ? 'caution' : bay.type === 'occupied' ? 'occupied' : 'available'
  return getStatusFillColor(status, colorBlindMode)
}

function isAccessibilityBay(bay) {
  const raw = String(bay?.bayType || '').trim().toUpperCase()
  return raw === 'DIS ONLY' || raw === 'DIS' || raw === 'DISABLED' || raw === 'DISABLED PARKING'
}

function makeWheelchairDivIcon(fillColor, diameter, opacity = 1) {
  const r = diameter / 2
  // Material Design "accessible" icon — person with raised arms (universal accessibility symbol)
  const html = `<svg width="${diameter}" height="${diameter}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <circle cx="12" cy="12" r="12" fill="${fillColor}" opacity="${opacity}"/>
    <path fill="white" d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
  </svg>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [diameter, diameter],
    iconAnchor: [r, r],
    popupAnchor: [0, -r],
  })
}

function bayPopupCopy(bay, verdictByBayId) {
  const sensor = bay.free === 1 ? 'Free' : bay.free === 0 ? 'Taken' : 'Unknown'
  const pv = verdictByBayId?.[bay.id]
  if (pv === 'yes') return `${sensor}, rules allow`
  if (pv === 'no') return `${sensor}, rules block`
  return sensor
}
const INTERSECTION_CELL_DEG = 0.0012

function FlyToController({ destination, defaultCenter, defaultZoom, destZoom }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (destination) {
      const ll = destinationLatLng(destination)
      map.flyTo([ll.lat, ll.lng], destZoom, { duration: 0.75 })
    } else if (prev.current) {
      map.flyTo(defaultCenter, defaultZoom, { duration: 0.75 })
    }
    prev.current = destination
  }, [destination, defaultCenter, defaultZoom, destZoom, map])
  return null
}

function MapReadyNotifier({ onReady }) {
  const map = useMap()
  useEffect(() => {
    onReady?.(map)
    return () => onReady?.(null)
  }, [map, onReady])
  return null
}

function MapEmptyClick({ onEmptyClick }) {
  useMapEvents({
    click(e) {
      if (e.originalEvent?.target?.closest?.('.leaflet-marker-icon')) return
      if (e.originalEvent?.target?.closest?.('.leaflet-interactive')) return
      onEmptyClick?.()
    },
  })
  return null
}

function MapZoomTracker({ onZoomChange }) {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom())
    },
  })
  useEffect(() => {
    onZoomChange(map.getZoom())
  }, [map, onZoomChange])
  return null
}

function MapBoundsNotifier({ onBoundsChange }) {
  const map = useMap()
  useEffect(() => {
    if (!onBoundsChange) return
    const report = () => {
      const b = map.getBounds()
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      })
    }
    report()
    map.on('moveend', report)
    map.on('zoomend', report)
    return () => {
      map.off('moveend', report)
      map.off('zoomend', report)
    }
  }, [map, onBoundsChange])
  return null
}

/**
 * Inner helper that bridges react-leaflet context (useMap) into BusyNowTrendMarkers.
 * Tracks viewport bounds internally so BusyNowTrendMarkers gets fresh bounds on
 * every moveend/zoomend without adding state to ParkingMap.
 */
function TrendMarkersController({ busyNow, quietSegments, colorBlindMode }) {
  const map = useMap()
  return (
    <BusyNowTrendMarkers
      map={map}
      busyNow={busyNow}
      quietSegments={quietSegments}
      colorBlindMode={colorBlindMode}
    />
  )
}

function destinationDivIcon(name) {
  const esc = String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\"/g, '&quot;')
  return L.divIcon({
    className: 'mp-dest-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:180px;margin-left:-90px;margin-top:-44px;text-align:center;pointer-events:none;">
      <span style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))">📍</span>
      <span style="margin-top:2px;background:#35338c;color:#fff;font:700 11px Inter,system-ui,sans-serif;padding:4px 10px;border-radius:8px;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${esc}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Distinct alt-zone marker (Phase 2 — A11). Diamond glyph + amber chip so it's
 *  visually separable from the primary destination pin above. */
function altPinDivIcon(pin) {
  const name = pin?.name || 'Less busy option'
  const subtitle = pin?.subtitle || 'Selected less busy parking option'
  const esc = String(name || 'Alternative zone')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\"/g, '&quot;')
  const subEsc = String(subtitle)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\"/g, '&quot;')
  return L.divIcon({
    className: 'mp-alt-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;transform:translate(-50%,-100%);padding-bottom:4px;" aria-label="${esc}">
      <div style="width:36px;height:36px;background:#047857;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(4,120,87,0.45),0 0 0 3px #fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.18));">
        <span style="font-size:15px;line-height:1;color:#fff;">◆</span>
      </div>
      <div style="width:1px;height:8px;background:#047857;opacity:0.6;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

export default function ParkingMap({
  bays,
  visibleBays,
  proximityBays,
  activeFilter,
  selectedBayId,
  destination,
  onBayClick,
  onMapReady,
  onBoundsChange = null,
  plannerMapActive = false,
  verdictByBayId = null,
  showLimitedBays = false,
  defaultCenter = DEFAULT_MAP_CENTER,
  defaultZoom = DEFAULT_MAP_ZOOM,
  destZoom = DESTINATION_MAP_ZOOM,
  isMobile = false,
  hideHint = false,
  busyNow = false,
  busyNowManifest = null,
  busyNowQuietSegments = undefined,
  onSegmentClick = null,
  colorBlindMode = false,
  altPinPos = null,
  onMapEmptyClick = null,
  dimRadiusM = SEARCH_RADIUS_M,
  accessibilityBayIds = null,
}) {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  const [zoomLevel, setZoomLevel] = useState(defaultZoom)
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const destIcon = useMemo(
    () => (destination ? destinationDivIcon(destination.name) : null),
    [destination],
  )

  const altIcon = useMemo(
    () => (altPinPos ? altPinDivIcon(altPinPos) : null),
    [altPinPos],
  )

  const destLatLng = destination ? destinationLatLng(destination) : null
  const proximityBayIdSet = useMemo(
    () => new Set(proximityBays.map((p) => p.id)),
    [proximityBays],
  )
  const visibleBayIdSet = useMemo(
    () => new Set(visibleBays.map((v) => v.id)),
    [visibleBays],
  )

  const { verifiedBays, limitedBays } = useMemo(() => {
    // hasRules === parking has_restriction_data. limited = no CoM row in cache.
    // Always render from already-filtered visibleBays so mode-level filtering
    // (e.g. accessibility mode) cannot be bypassed by "All bays".
    const byType = visibleBays
    const inRange = destination
      ? byType.filter((b) => proximityBayIdSet.has(b.id))
      : byType
    return {
      verifiedBays: inRange.filter((b) => b.hasRules),
      limitedBays: inRange.filter((b) => !b.hasRules),
    }
  }, [visibleBays, destination, proximityBayIdSet])

  const baysForClustering = useMemo(() => {
    const live = verifiedBays.filter((b) => b.source === 'live')
    const verifiedCore = live.length ? live : verifiedBays
    if (showLimitedBays) return verifiedCore
    return [...verifiedCore, ...limitedBays]
  }, [verifiedBays, limitedBays, showLimitedBays])

  const clustered = useMemo(() => {
    if (zoomLevel >= CLUSTER_ZOOM_CUTOFF) return []
    const cellSize = INTERSECTION_CELL_DEG * Math.pow(2, CLUSTER_ZOOM_CUTOFF - 1 - zoomLevel)
    const groups = new Map()

    baysForClustering.forEach((bay) => {
      const ll = bayLatLng(bay)
      const inRadius = !destination || proximityBayIdSet.has(bay.id)
      if (!inRadius) return

      const gx = Math.floor(ll.lat / cellSize)
      const gy = Math.floor(ll.lng / cellSize)
      const key = `${gx}:${gy}`
      const prev = groups.get(key)
      if (prev) {
        prev.total += 1
        if (bay.type === 'available') prev.available += 1
        if (bay.type === 'occupied') prev.occupied += 1
        if (bay.type === 'trap') prev.trap += 1
        if (!prev.name && bay.name) prev.name = bay.name
      } else {
        groups.set(key, {
          key,
          sampleLat: ll.lat,
          sampleLng: ll.lng,
          total: 1,
          available: bay.type === 'available' ? 1 : 0,
          occupied: bay.type === 'occupied' ? 1 : 0,
          trap: bay.type === 'trap' ? 1 : 0,
          name: bay.name || null,
        })
      }
    })

    return Array.from(groups.values()).map((g) => ({
      key: g.key,
      lat: g.sampleLat,
      lng: g.sampleLng,
      total: g.total,
      available: g.available,
      occupied: g.occupied,
      trap: g.trap,
      name: g.name,
    }))
  }, [baysForClustering, zoomLevel, destination, proximityBayIdSet])

  const clusterIcon = (available, occupied, trap, total) => {
    const a = Number(available) || 0
    const t = Number(total) || 0
    const label = String(a)
    const { bg, text } = getClusterBadgeColors({
      available,
      occupied,
      trap,
      total,
      isDark,
      colorBlindMode,
    })

    const isOccupied = a === 0
    const size = isOccupied ? 34 : 42
    const border = isOccupied ? '2px solid rgba(0,0,0,0.12)' : '2px solid #ffffff'
    const fontSize = label.length >= 3 ? 11 : label.length === 2 ? 13 : 15
    return L.divIcon({
      className: 'mp-cluster-icon',
      html: `<div style="
        box-sizing:border-box;width:${size}px;height:${size}px;border-radius:999px;
        background:${bg};border:${border};
        display:flex;align-items:center;justify-content:center;
        color:${text};font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:${fontSize}px;line-height:1;
        letter-spacing:-0.1px;white-space:nowrap;overflow:hidden;text-align:center;
        box-shadow:0 2px 10px rgba(0,0,0,0.2);
      ">${label}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      title: `${a} free of ${t} bays`,
    })
  }

  return (
    <div className="absolute inset-0 z-[1]">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom
        zoomControl={false}
        minZoom={MELBOURNE_MIN_ZOOM}
        maxZoom={MELBOURNE_MAX_ZOOM}
        maxBounds={MELBOURNE_MAX_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        {/* No key by theme: remounting TileLayer breaks Leaflet canvas tile renderer
            used by BusyNowVectorGrid — segments go blank until full map remount. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={
            isDark
              ? 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          }
          subdomains="abcd"
          maxZoom={MELBOURNE_MAX_ZOOM}
        />

        <FlyToController
          destination={destination}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          destZoom={destZoom}
        />
        <MapReadyNotifier onReady={onMapReady} />
        <MapBoundsNotifier onBoundsChange={onBoundsChange} />
        <MapZoomTracker onZoomChange={setZoomLevel} />
        <MapEmptyClick
          onEmptyClick={() => {
            onBayClick(null)
            onMapEmptyClick?.()
          }}
        />

        {destination && destLatLng && (
          <Circle
            center={[destLatLng.lat, destLatLng.lng]}
            radius={SEARCH_RADIUS_M}
            interactive={false}
            pathOptions={{
              color: 'rgba(53,51,140,0.75)',
              fillColor: '#35338c',
              fillOpacity: 0.07,
              weight: 2,
              dashArray: '8 6',
            }}
          />
        )}

        {busyNow && busyNowManifest && (
          <BusyNowVectorLayer
            manifest={busyNowManifest}
            colorBlindMode={colorBlindMode}
            destination={destination ? destinationLatLng(destination) : null}
            dimRadiusM={dimRadiusM}
            mapThemeDark={isDark}
            onSegmentClick={onSegmentClick}
          />
        )}

        {busyNow && (
          <TrendMarkersController
            busyNow={busyNow}
            quietSegments={busyNowQuietSegments}
            colorBlindMode={colorBlindMode}
          />
        )}

        {zoomLevel < CLUSTER_ZOOM_CUTOFF &&
          clustered.map((c) => (
            <Marker
              key={`cluster-${c.key}`}
              position={[c.lat, c.lng]}
              icon={clusterIcon(c.available, c.occupied, c.trap, c.total)}
              title={`${c.available} free of ${c.total} bays`}
              eventHandlers={{
                click: (e) => {
                  const m = e.target?._map
                  if (m) m.setView([c.lat, c.lng], Math.min(19, zoomLevel + 2))
                },
              }}
            >
              <Popup>
                <div className="min-w-[130px]">
                  <strong>
                    {c.available}/{c.total} available parking spots
                  </strong>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Counts are available/total for this zoom level.
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                    Tap cluster to zoom into bays.
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Sensor-only bays: same zoom threshold as verified dots — low zoom uses clusters only (fewer, larger); high zoom shows many smaller dots. */}
        {!showLimitedBays &&
          zoomLevel >= CLUSTER_ZOOM_CUTOFF &&
          limitedBays.map((bay) => {
            const ll = bayLatLng(bay)
            const inFilter = visibleBayIdSet.has(bay.id)
            const inRadius = !destination || proximityBayIdSet.has(bay.id)
            let opacity = 1
            if (!inRadius) opacity = 0.12
            else if (!inFilter) opacity = 0.22
            const fillColor = sensorOccupancyFillColor(bay, colorBlindMode)
            const markerStatus = markerStatusFromBay(bay, false, null)
            /* Same radius as verified dots for hit target; tier is colour-only (sensor vs planner/verified palette). */
            const markerRadius = isMobile ? 11 : 9
            const selected = bay.id === selectedBayId
            const selectedRadius = isMobile ? 15 : 13
            const radius = selected ? selectedRadius : markerRadius
            const isDisability = isAccessibilityBay(bay) || (accessibilityBayIds?.has(String(bay.id)) ?? false)
            const eventHandlers = {
              click: (e) => { L.DomEvent.stopPropagation(e); onBayClick(bay) },
            }
            const popup = (
              <Popup>
                <div className="min-w-[120px] text-xs leading-snug">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    Bay #{bay.id} {bay.name ? `\u00b7 ${bay.name}` : ''}
                  </div>
                  <div className="mt-1 text-gray-600 dark:text-gray-400">
                    {bayPopupCopy(bay, verdictByBayId)}
                  </div>
                </div>
              </Popup>
            )
            if (isDisability) {
              return (
                <Marker
                  key={`ltd-${bay.id}`}
                  position={[ll.lat, ll.lng]}
                  icon={makeWheelchairDivIcon(fillColor, radius * 2, opacity)}
                  eventHandlers={eventHandlers}
                >
                  {popup}
                </Marker>
              )
            }
            return (
              <CircleMarker
                key={`ltd-${bay.id}`}
                center={[ll.lat, ll.lng]}
                radius={radius}
                pathOptions={getBayMarkerPathOptions(markerStatus, fillColor, opacity, colorBlindMode)}
                eventHandlers={eventHandlers}
              >
                {popup}
              </CircleMarker>
            )
          })}

        {zoomLevel >= CLUSTER_ZOOM_CUTOFF && verifiedBays.map((bay) => {
          const ll = bayLatLng(bay)
          const inFilter = visibleBayIdSet.has(bay.id)
          const inRadius = !destination || proximityBayIdSet.has(bay.id)
          let opacity = 1
          if (!inRadius) opacity = 0.12
          else if (!inFilter) opacity = 0.22
          const selected = bay.id === selectedBayId
          const markerStatus = markerStatusFromBay(bay, plannerMapActive, verdictByBayId)
          const fillColor = verifiedBayFillColor(bay, plannerMapActive, verdictByBayId, colorBlindMode)
          const markerRadius = isMobile ? 11 : 9
          const selectedRadius = isMobile ? 15 : 13
          const radius = selected ? selectedRadius : markerRadius
          const isDisability = isAccessibilityBay(bay)
          const eventHandlers = {
            click: (e) => { L.DomEvent.stopPropagation(e); onBayClick(bay) },
          }
          const popup = (
            <Popup>
              <div className="min-w-[120px] text-xs leading-snug">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  Bay #{bay.id} {bay.name ? `\u00b7 ${bay.name}` : ''}
                </div>
                <div className="mt-1 text-gray-600 dark:text-gray-400">
                  {bayPopupCopy(bay, verdictByBayId)}
                </div>
              </div>
            </Popup>
          )
          if (isDisability) {
            return (
              <Marker
                key={bay.id}
                position={[ll.lat, ll.lng]}
                icon={makeWheelchairDivIcon(fillColor, radius * 2, opacity)}
                eventHandlers={eventHandlers}
              >
                {popup}
              </Marker>
            )
          }
          return (
            <CircleMarker
              key={bay.id}
              center={[ll.lat, ll.lng]}
              radius={radius}
              pathOptions={getBayMarkerPathOptions(markerStatus, fillColor, opacity, colorBlindMode)}
              eventHandlers={eventHandlers}
            >
              {popup}
            </CircleMarker>
          )
        })}

        {destination && destLatLng && destIcon && (
          <Marker position={[destLatLng.lat, destLatLng.lng]} icon={destIcon} interactive={false} />
        )}

        {destination && destLatLng && altPinPos && (
          <Polyline
            positions={[
              [destLatLng.lat, destLatLng.lng],
              [altPinPos.lat, altPinPos.lng],
            ]}
            interactive={false}
            pathOptions={{
              color: '#047857',
              opacity: 0.75,
              weight: 3,
              dashArray: '8 8',
            }}
          />
        )}

        {altPinPos && altIcon && (
          <>
            <Circle
              center={[altPinPos.lat, altPinPos.lng]}
              radius={140}
              interactive={false}
              pathOptions={{
                color: '#047857',
                fillColor: '#10b981',
                fillOpacity: 0.07,
                weight: 1.5,
                opacity: 0.35,
                dashArray: '5 6',
              }}
            />
            <Marker
              position={[altPinPos.lat, altPinPos.lng]}
              icon={altIcon}
              interactive={false}
              data-testid="alt-pin-marker"
            >
              <Popup>{altPinPos.name}</Popup>
            </Marker>
          </>
        )}

        {zoomLevel < CLUSTER_ZOOM_CUTOFF && !hideHint && (
          <div
            className="pointer-events-none absolute z-[450] rounded-xl border border-brand bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand shadow-card text-center dark:border-brand-300/70 dark:bg-surface-dark-secondary/95 dark:text-brand-100"
            style={
              isMobile
                ? {
                    left: '14px',
                    bottom: destination ? '108px' : '86px',
                    width: 'max-content',
                    maxWidth: 'calc(100% - 144px)',
                    whiteSpace: showLimitedBays ? 'nowrap' : 'normal',
                    overflow: showLimitedBays ? 'hidden' : 'visible',
                    textOverflow: showLimitedBays ? 'ellipsis' : 'clip',
                  }
                : selectedBayId
                ? {
                    left: 'calc(50% - 190px)',
                    transform: 'translateX(-50%)',
                    bottom: '18px',
                    width: 'max-content',
                    maxWidth: 'calc(100% - 440px)',
                  }
                : {
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: '18px',
                    width: 'max-content',
                    maxWidth: 'calc(100% - 440px)',
                    whiteSpace: showLimitedBays ? 'nowrap' : 'normal',
                  }
            }
          >
            <div>{isMobile ? MOBILE_CLUSTER_ZOOM_HINT : 'Zoom in to see individual parking bays.'}</div>
            {!isMobile && (
              <div className="mt-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                Cluster numbers show available/total bays.
              </div>
            )}
          </div>
        )}
      </MapContainer>
    </div>
  )
}
