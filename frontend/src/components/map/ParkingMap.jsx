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

function destinationDivIcon(name) {
  const esc = String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
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
  selectedBayId,
  destination,
  onBayClick,
  onMapReady,
  defaultCenter = DEFAULT_MAP_CENTER,
  defaultZoom = DEFAULT_MAP_ZOOM,
  destZoom = DESTINATION_MAP_ZOOM,
}) {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
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

        {bays.map((bay) => {
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
          return (
            <CircleMarker
              key={bay.id}
              center={[ll.lat, ll.lng]}
              radius={selected ? 13 : baseRadius}
              pathOptions={{
                color: hasRules ? '#35338c' : '#ffffff',
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
                      <span style={{color:'#35338c',fontWeight:600,fontSize:'11px'}}>
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
      </MapContainer>
    </div>
  )
}
