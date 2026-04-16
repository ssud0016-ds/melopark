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
import { BAY_COLORS } from '../../data/mapData'
import {
  normToLatLng,
  bayLatLng,
  SEARCH_RADIUS_M,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
} from '../../utils/mapGeo'

const CLUSTER_ZOOM_CUTOFF = 18
const INTERSECTION_CELL_DEG = 0.0012

function FlyToController({ destination, defaultCenter, defaultZoom, destZoom }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (destination) {
      const ll = normToLatLng(destination.x, destination.y)
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

  const destLatLng = destination ? normToLatLng(destination.x, destination.y) : null

  const renderedBays = useMemo(() => {
    // For any active filter other than "all", render only filtered bays.
    // This keeps clustered and non-clustered views consistent.
    return activeFilter === 'all' ? bays : visibleBays
  }, [activeFilter, bays, visibleBays])

  const baysForClustering = useMemo(() => {
    const live = renderedBays.filter((b) => b.source === 'live')
    return live.length ? live : renderedBays
  }, [renderedBays])

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
    const label = `${available}/${total}`
    const labelLen = label.length
    let bg = isDark ? '#35338c' : '#dce8ff'
    let text = isDark ? '#f4f6ff' : '#35338c'
    if (total > 0 && available === total) bg = '#a3ec48'
    else if (total > 0 && occupied === total) bg = '#ed6868'
    else if (total > 0 && trap === total) bg = '#FF7F50'

    if (bg === '#a3ec48') text = '#3f5618'
    else if (bg === '#FF7F50') text = '#8f3f22'
    else if (bg === '#ed6868') text = '#611d1d'
    const ring = activeFilter === 'timed' || activeFilter === 'hasRules' ? '#FFD700' : '#ffffff'

    const fontSize = labelLen >= 10 ? 7 : labelLen >= 8 ? 8 : labelLen >= 6 ? 9 : 11
    return L.divIcon({
      className: 'mp-cluster-icon',
      html: `<div style="
        width:42px;height:42px;border-radius:999px;
        background:${bg};border:2px solid ${ring};
        display:flex;align-items:center;justify-content:center;
        color:${text};font:700 ${fontSize}px/1 Inter,system-ui,sans-serif;
        letter-spacing:-0.1px;white-space:nowrap;overflow:hidden;
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
        <MapZoomTracker onZoomChange={setZoomLevel} />
        <MapEmptyClick onEmptyClick={() => onBayClick(null)} />

        {destination && destLatLng && (
          <Circle
            center={[destLatLng.lat, destLatLng.lng]}
            radius={SEARCH_RADIUS_M}
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

        {zoomLevel >= CLUSTER_ZOOM_CUTOFF && renderedBays.map((bay) => {
          const ll = bayLatLng(bay)
          const inFilter = visibleBays.some((v) => v.id === bay.id)
          const inRadius = !destination || proximityBays.some((p) => p.id === bay.id)
          let opacity = 1
          if (!inRadius) opacity = 0.12
          else if (!inFilter) opacity = 0.22
          const cols = BAY_COLORS[bay.type] || BAY_COLORS.available
          const selected = bay.id === selectedBayId
          const hasRules = bay.hasRules
          const baseRadius = hasRules ? 9 : 6
          const markerRadius = isMobile ? baseRadius + 2 : baseRadius
          const selectedRadius = isMobile ? 15 : 13
          return (
            <CircleMarker
              key={bay.id}
              center={[ll.lat, ll.lng]}
              radius={selected ? selectedRadius : markerRadius}
              pathOptions={{
                color: hasRules ? '#FFD700' : '#ffffff',
                fillColor: cols.border,
                fillOpacity: opacity,
                opacity,
                weight: selected ? 3 : hasRules ? 2.5 : 1.5,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e)
                  onBayClick(bay)
                },
              }}
            >
              <Popup>
                <div className="min-w-[120px]">
                  <strong>#{bay.id}</strong> {bay.name}
                  <br />
                  <span className="text-gray-700 dark:text-gray-300">
                    {bay.free}/{bay.spots} spots free
                  </span>
                  {hasRules && (
                    <>
                      <br />
                      <span style={{ color: '#35338c', fontWeight: 600, fontSize: '11px' }}>
                        ✓ Restriction rules available
                      </span>
                    </>
                  )}
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
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: '86px',
                    maxWidth: 'calc(100% - 28px)',
                    whiteSpace: 'nowrap',
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
            Zoom in to view and select individual bays
          </div>
        )}
      </MapContainer>
    </div>
  )
}
