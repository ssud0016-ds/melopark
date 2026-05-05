/**
 * useRouteAnimation.js
 * ====================
 * Fetches a driving route from Google Maps Directions API,
 * draws it on the Leaflet map, and animates an SVG car along it.
 *
 * Usage:
 *   const { startNavigation, clearNavigation, isNavigating } = useRouteAnimation(mapRef, googleApiKey)
 *   startNavigation({ lat: userLat, lng: userLng }, { lat: bayLat, lng: bayLng })
 */
import { useRef, useState, useCallback } from 'react'
import L from 'leaflet'

const CAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="20" viewBox="0 0 40 22">
  <ellipse cx="20" cy="21" rx="14" ry="2" fill="black" opacity="0.15"/>
  <rect x="2" y="10" width="36" height="10" rx="3" fill="#3b82f6"/>
  <path d="M8 10L12 3H28L32 10" fill="#3b82f6" opacity="0.85"/>
  <path d="M13 10L16 4H24L27 10" fill="white" opacity="0.12"/>
  <rect x="13" y="4" width="5" height="5.5" rx="1" fill="#bfdbfe" opacity="0.9"/>
  <rect x="20" y="4" width="5" height="5.5" rx="1" fill="#bfdbfe" opacity="0.9"/>
  <circle cx="10" cy="20" r="3.5" fill="#1f2937"/>
  <circle cx="10" cy="20" r="1.8" fill="#6b7280"/>
  <circle cx="10" cy="20" r="0.8" fill="#9ca3af"/>
  <circle cx="30" cy="20" r="3.5" fill="#1f2937"/>
  <circle cx="30" cy="20" r="1.8" fill="#6b7280"/>
  <circle cx="30" cy="20" r="0.8" fill="#9ca3af"/>
  <rect x="34" y="12" width="4" height="3" rx="1" fill="#fde68a" opacity="0.95"/>
  <rect x="2" y="12" width="2.5" height="3" rx="0.5" fill="#fca5a5" opacity="0.9"/>
  <line x1="20" y1="11" x2="20" y2="19" stroke="white" stroke-width="0.5" opacity="0.3"/>
</svg>
`

function decodePoly(encoded) {
  const poly = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    poly.push([lat / 1e5, lng / 1e5])
  }
  return poly
}

function interpolate(points, t) {
  if (points.length < 2) return points[0]
  const totalSegs = points.length - 1
  const globalT = t * totalSegs
  const seg = Math.min(Math.floor(globalT), totalSegs - 1)
  const segT = globalT - seg
  const a = points[seg], b = points[seg + 1]
  return [a[0] + (b[0] - a[0]) * segT, a[1] + (b[1] - a[1]) * segT]
}

function bearing(a, b) {
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const lat1 = a[0] * Math.PI / 180
  const lat2 = b[0] * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function useRouteAnimation(mapRef, apiKey) {
  const [isNavigating, setIsNavigating] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const layerGroupRef = useRef(null)
  const animFrameRef = useRef(null)
  const carMarkerRef = useRef(null)
  const startTimeRef = useRef(null)
  const routePointsRef = useRef([])
  const DURATION_MS = 8000

  const clearNavigation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (layerGroupRef.current && mapRef.current) {
      mapRef.current.removeLayer(layerGroupRef.current)
    }
    layerGroupRef.current = null
    carMarkerRef.current = null
    startTimeRef.current = null
    routePointsRef.current = []
    setIsNavigating(false)
    setRouteInfo(null)
  }, [mapRef])

  const animateCar = useCallback(() => {
    const points = routePointsRef.current
    if (!points.length || !carMarkerRef.current) return
    const now = Date.now()
    if (!startTimeRef.current) startTimeRef.current = now
    const elapsed = now - startTimeRef.current
    const t = Math.min(elapsed / DURATION_MS, 1)
    const pos = interpolate(points, t)
    const nextPos = interpolate(points, Math.min(t + 0.005, 1))
    const deg = bearing(pos, nextPos)
    carMarkerRef.current.setLatLng(pos)
    const el = carMarkerRef.current.getElement()
    if (el) el.style.transform = `${el.style.transform.split('rotate')[0]} rotate(${deg - 90}deg)`
    if (t < 1) {
      animFrameRef.current = requestAnimationFrame(animateCar)
    } else {
      startTimeRef.current = null
      animFrameRef.current = requestAnimationFrame(animateCar)
    }
  }, [])

  const startNavigation = useCallback(async (origin, destination) => {
    clearNavigation()
    setIsNavigating(true)
    const map = mapRef.current
    if (!map) return

    try {
      // Fetch route from Google Maps Directions API
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${apiKey}`
      
      // Use CORS proxy or backend proxy
      const resp = await fetch(`/api/proxy/directions?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`)
      
      let points
      if (resp.ok) {
        const data = await resp.json()
        const poly = data?.routes?.[0]?.overview_polyline?.points
        points = poly ? decodePoly(poly) : null
        if (data?.routes?.[0]?.legs?.[0]) {
          const leg = data.routes[0].legs[0]
          setRouteInfo({
            distance: leg.distance?.text,
            duration: leg.duration?.text,
            steps: leg.steps?.length || 0
          })
        }
      }

      // Fallback: straight line if API not available
      if (!points) {
        points = [
          [origin.lat, origin.lng],
          [(origin.lat + destination.lat) / 2 + 0.002, (origin.lng + destination.lng) / 2],
          [destination.lat, destination.lng]
        ]
        setRouteInfo({ distance: 'Approx route', duration: 'Est. ~5 min', steps: 0 })
      }

      routePointsRef.current = points

      // Create layer group
      const group = L.layerGroup().addTo(map)
      layerGroupRef.current = group

      // Draw route — shadow + main line
      L.polyline(points, { color: '#1e3a5f', weight: 6, opacity: 0.25, smoothFactor: 1 }).addTo(group)
      L.polyline(points, { color: '#3b82f6', weight: 3.5, opacity: 0.9, dashArray: '8,4', smoothFactor: 1 }).addTo(group)

      // Origin marker
      L.circleMarker([origin.lat, origin.lng], {
        radius: 8, fillColor: '#3b82f6', color: 'white', weight: 2.5, fillOpacity: 1
      }).bindTooltip('You are here', { permanent: false }).addTo(group)

      // Destination P marker
      const pIcon = L.divIcon({
        html: `<div style="width:28px;height:28px;background:#2563eb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg);display:block;text-align:center;color:white;font-weight:900;font-size:13px;line-height:24px">P</span></div>`,
        iconSize: [28, 28], iconAnchor: [14, 28], className: ''
      })
      L.marker([destination.lat, destination.lng], { icon: pIcon })
        .bindTooltip('Parking bay', { permanent: true, direction: 'top', offset: [0, -30] })
        .addTo(group)

      // Car marker
      const carIcon = L.divIcon({
        html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${CAR_SVG}</div>`,
        iconSize: [36, 20], iconAnchor: [18, 10], className: ''
      })
      carMarkerRef.current = L.marker([origin.lat, origin.lng], { icon: carIcon, zIndexOffset: 1000 }).addTo(group)

      // Fit bounds
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 17 })

      // Start animation loop
      startTimeRef.current = null
      animFrameRef.current = requestAnimationFrame(animateCar)

    } catch (err) {
      console.error('Route animation error:', err)
      setIsNavigating(false)
    }
  }, [mapRef, apiKey, clearNavigation, animateCar])

  return { startNavigation, clearNavigation, isNavigating, routeInfo }
}
