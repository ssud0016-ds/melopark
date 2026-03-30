import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'

// Melbourne CBD centre
const MELBOURNE_CBD = { lat: -37.8136, lng: 144.9631 }

// Marker colours based on status
const STATUS_COLOURS = {
  Unoccupied: '#22c55e', // green
  Present: '#ef4444',     // red
  stale: '#9ca3af',       // grey
}

/**
 * Recenter the map when the target position changes.
 */
function MapRecentre({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 17, { duration: 1 })
    }
  }, [lat, lng, map])
  return null
}

/**
 * Main parking map component.
 *
 * Props:
 *   sensors - array of sensor objects from useSensors hook
 *   centre - { lat, lng } to centre the map on (e.g. search result)
 *   onBayClick - callback when user clicks a bay marker, receives sensor object
 */
export default function ParkingMap({ sensors = [], centre, onBayClick }) {
  const mapCentre = centre || MELBOURNE_CBD

  return (
    <MapContainer
      center={[mapCentre.lat, mapCentre.lng]}
      zoom={16}
      minZoom={14}
      maxZoom={19}
      className="w-full h-full rounded-lg"
      // Mobile friendly settings
      tap={true}
      touchZoom={true}
      dragging={true}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {centre && <MapRecentre lat={centre.lat} lng={centre.lng} />}

      {sensors.map((sensor) => {
        const colour = sensor.is_stale
          ? STATUS_COLOURS.stale
          : STATUS_COLOURS[sensor.status] || STATUS_COLOURS.stale

        return (
          <CircleMarker
            key={sensor.bay_id || sensor.marker_id}
            center={[sensor.lat, sensor.lon]}
            radius={6}
            pathOptions={{
              color: colour,
              fillColor: colour,
              fillOpacity: 0.8,
              weight: 1,
            }}
            eventHandlers={{
              click: () => onBayClick?.(sensor),
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Bay {sensor.bay_id}</p>
                <p className={sensor.status === 'Unoccupied' ? 'text-green-600' : 'text-red-600'}>
                  {sensor.is_stale ? 'Status uncertain' : sensor.status}
                </p>
                <p className="text-gray-500 text-xs mt-1">Tap for parking rules</p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
