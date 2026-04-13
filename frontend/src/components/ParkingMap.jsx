import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

// Melbourne CBD centre
const MELBOURNE_CBD = { lat: -37.8136, lng: 144.9631 }

// Marker colours based on status
const STATUS_COLOURS = {
  free: '#22c55e',     // green
  occupied: '#ef4444', // red
  unknown: '#9ca3af',  // grey
}

// Blue pin icon for the searched destination (uses a CSS div, no image assets needed)
const destinationIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 18px; height: 18px;
      background: #2563eb;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #2563eb, 0 3px 8px rgba(0,0,0,0.35);
    "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
})

/**
 * Recenter and zoom the map when the target position changes.
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
 *   sensors     - array of bay objects from useSensors hook
 *   destination - { lat, lng, name } from a successful search, or null
 *   onBayClick  - callback when user clicks a bay marker
 */
export default function ParkingMap({ sensors = [], destination, onBayClick }) {
  const mapCentre = destination || MELBOURNE_CBD

  return (
    <MapContainer
      center={[mapCentre.lat, mapCentre.lng]}
      zoom={16}
      minZoom={14}
      maxZoom={19}
      className="w-full h-full rounded-lg"
      tap={true}
      touchZoom={true}
      dragging={true}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {destination && <MapRecentre lat={destination.lat} lng={destination.lng} />}

      {/* 400 m search radius ring */}
      {destination && (
        <Circle
          center={[destination.lat, destination.lng]}
          radius={400}
          pathOptions={{
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 0.06,
            weight: 1.5,
            dashArray: '6 4',
          }}
        />
      )}

      {/* Destination pin */}
      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold text-blue-700">Destination</p>
              <p className="text-gray-600 mt-0.5 max-w-[200px]">{destination.name}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Parking bay markers */}
      {sensors.map((sensor) => {
        const colour = STATUS_COLOURS[sensor.status] || STATUS_COLOURS.unknown

        return (
          <CircleMarker
            key={sensor.bay_id}
            center={[sensor.lat, sensor.lng]}
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
                <p className={sensor.status === 'free' ? 'text-green-600' : 'text-red-600'}>
                  {sensor.status === 'free' ? 'Available' : sensor.status === 'occupied' ? 'Occupied' : 'Unknown'}
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
