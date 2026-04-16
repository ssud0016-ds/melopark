import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Marker,
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
} from '../../utils/mapGeo'
import { bayHeading } from '../../utils/bayLabels'

const CLUSTER_ZOOM_CUTOFF = 18

/** Verified-dot fill colours (match map legend): green / orange / red */
const VERIFIED_FILL = {
  available: '#a3ec48',
  trap: '#FFB382',
  occupied: '#ed6868',
}

function verifiedBayFillColor(bay, plannerMapActive, verdictByBayId) {
  if (plannerMapActive && verdictByBayId) {
    const pv = verdictByBayId[bay.id]
    if (pv === 'yes') return VERIFIED_FILL.available
    if (pv === 'no') return VERIFIED_FILL.occupied
    return '#9ca3af'
  }
  const t = bay.type === 'trap' ? 'trap' : bay.type === 'occupied' ? 'occupied' : 'available'
  return VERIFIED_FILL[t] || VERIFIED_FILL.available
}

function bayPopupStatusWord(bay) {
  return bay.free === 1 ? 'Free' : 'Occupied'
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

  const destLatLng = destination ? destinationLatLng(destination) : null

  const { verifiedBays, limitedBays } = useMemo(() => {
    const byType = activeFilter === 'all' ? bays : visibleBays
    const inRange = destination
      ? byType.filter((b) => proximityBays.some((p) => p.id === b.id))
      : byType
    return {
      verifiedBays: inRange.filter((b) => b.hasRules),
      limitedBays: inRange.filter((b) => !b.hasRules),
    }
  }, [activeFilter, bays, visibleBays, destination, proximityBays])

  const baysForClustering = useMemo(() => {
    const live = verifiedBays.filter((b) => b.source === 'live')
    const verifiedCore = live.length ? live : verifiedBays
    if (!showLimitedBays) return verifiedCore
    return [...verifiedCore, ...limitedBays]
  }, [verifiedBays, limitedBays, showLimitedBays])

  const clustered = useMemo(() => {
    if (zoomLevel >= CLUSTER_ZOOM_CUTOFF) return []
    const cellSize = INTERSECTION_CELL_DEG * Math.pow(2, CLUSTER_ZOOM_CUTOFF - 1 - zoomLevel)
    const groups = new Map()

    baysForClustering.forEach((bay) => {
      const ll = bayLatLng(bay)
      const inRadius = !destination || proximityBays.some((p) => p.id === bay.id)
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
      } else {
        groups.set(key, {
          key,
          sampleLat: ll.lat,
          sampleLng: ll.lng,
          total: 1,
          available: bay.type === 'available' ? 1 : 0,
          occupied: bay.type === 'occupied' ? 1 : 0,
          trap: bay.type === 'trap' ? 1 : 0,
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
    }))
  }, [baysForClustering, zoomLevel, destination, proximityBays])

  const clusterIcon = (available, occupied, trap, total) => {
    const a = Number(available) || 0
    const t = Number(total) || 0
    const label = `${a}/${t}`
    const labelLen = label.length
    let bg = isDark ? '#35338c' : '#dce8ff'
    let text = isDark ? '#f4f6ff' : '#35338c'
    if (total > 0 && available === total) bg = '#a3ec48'
    else if (total > 0 && occupied === total) bg = '#ed6868'
    else if (total > 0 && trap === total) bg = '#FF7F50'

    if (bg === '#a3ec48') text = '#3f5618'
    else if (bg === '#FF7F50') text = '#8f3f22'
    else if (bg === '#ed6868') text = '#611d1d'
    const ring = '#ffffff'

    const fontSize = labelLen >= 10 ? 7 : labelLen >= 8 ? 8 : labelLen >= 6 ? 9 : 11
    return L.divIcon({
      className: 'mp-cluster-icon',
      html: `<div style="
        box-sizing:border-box;width:42px;height:42px;border-radius:999px;
        background:${bg};border:2px solid ${ring};
        display:flex;align-items:center;justify-content:center;
        color:${text};font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:${fontSize}px;line-height:1;
        letter-spacing:-0.1px;white-space:nowrap;overflow:hidden;text-align:center;
        box-shadow:0 2px 10px rgba(0,0,0,0.2);
      ">${label}</div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
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
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={
            isDark
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          }
          subdomains="abcd"
          maxZoom={20}
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
        <MapEmptyClick onEmptyClick={() => onBayClick(null)} />

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
                    {c.available} free of {c.total} bays
                  </strong>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Tap cluster to zoom into bays
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {showLimitedBays && limitedBays.map((bay) => {
          const ll = bayLatLng(bay)
          const lowZoomFade = zoomLevel < CLUSTER_ZOOM_CUTOFF ? 0.15 : 0.35
          return (
            <CircleMarker
              key={`ltd-${bay.id}`}
              center={[ll.lat, ll.lng]}
              radius={3}
              interactive={false}
              pathOptions={{
                color: 'transparent',
                fillColor: isDark ? '#9ca3af' : '#9ca3af',
                fillOpacity: lowZoomFade,
                weight: 0,
              }}
            />
          )
        })}

        {zoomLevel >= CLUSTER_ZOOM_CUTOFF && verifiedBays.map((bay) => {
          const ll = bayLatLng(bay)
          const inFilter = visibleBays.some((v) => v.id === bay.id)
          const inRadius = !destination || proximityBays.some((p) => p.id === bay.id)
          let opacity = 1
          if (!inRadius) opacity = 0.12
          else if (!inFilter) opacity = 0.22
          const selected = bay.id === selectedBayId
          const fillColor = verifiedBayFillColor(bay, plannerMapActive, verdictByBayId)
          const markerRadius = isMobile ? 11 : 9
          const selectedRadius = isMobile ? 15 : 13
          return (
            <CircleMarker
              key={bay.id}
              center={[ll.lat, ll.lng]}
              radius={selected ? selectedRadius : markerRadius}
              pathOptions={{
                color: fillColor,
                fillColor,
                fillOpacity: opacity,
                opacity,
                weight: 0,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e)
                  onBayClick(bay)
                },
              }}
            >
              <Popup>
                <div className="min-w-[120px] text-xs leading-snug">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{bayHeading(bay)}</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-400">
                    Status: {bayPopupStatusWord(bay)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {destination && destLatLng && destIcon && (
          <Marker position={[destLatLng.lat, destLatLng.lng]} icon={destIcon} interactive={false} />
        )}

        {zoomLevel < CLUSTER_ZOOM_CUTOFF && (
          <div
            className="pointer-events-none absolute z-[450] rounded-full border border-brand bg-white/95 px-3 py-1 text-xs font-semibold text-brand shadow-card dark:border-brand-300/70 dark:bg-surface-dark-secondary/95 dark:text-brand-100"
            style={
              isMobile
                ? {
                    left: '14px',
                    right: '220px',
                    bottom: '86px',
                    maxWidth: 'calc(100% - 234px)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
                : {
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: destination ? '96px' : '18px',
                    width: 'max-content',
                    maxWidth: 'calc(100% - 440px)',
                    whiteSpace: 'nowrap',
                  }
            }
          >
            Zoom in to select individual bays
          </div>
        )}
      </MapContainer>
    </div>
  )
}
