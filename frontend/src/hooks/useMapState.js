import { useState, useCallback } from 'react'
import {
  normToLatLng,
  haversineMeters,
  SEARCH_RADIUS_M,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
  bayLatLng,
} from '../utils/mapGeo'

export function useMapState() {
  const [selectedBayId, setSelectedBayId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [destination, setDestination] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const pickDestination = useCallback((lm) => {
    setDestination(lm)
    setSelectedBayId(null)
  }, [])

  const clearDestination = useCallback(() => {
    setDestination(null)
    setSelectedBayId(null)
  }, [])

  const getVisibleBays = useCallback(
    (bays) => {
      const pool = destination
        ? bays.filter((b) => {
            const bl = bayLatLng(b)
            const dl = normToLatLng(destination.x, destination.y)
            return haversineMeters(bl.lat, bl.lng, dl.lat, dl.lng) < SEARCH_RADIUS_M
          })
        : bays

      return pool.filter((b) => {
        if (activeFilter === 'all') return true
        if (activeFilter === 'available') return b.type === 'available'
        if (activeFilter === 'trap') return b.type === 'trap'
        return b.limitType === activeFilter
      })
    },
    [destination, activeFilter],
  )

  const getProximityBays = useCallback(
    (bays) => {
      if (!destination) return bays
      return bays.filter((b) => {
        const bl = bayLatLng(b)
        const dl = normToLatLng(destination.x, destination.y)
        return haversineMeters(bl.lat, bl.lng, dl.lat, dl.lng) < SEARCH_RADIUS_M
      })
    },
    [destination],
  )

  return {
    selectedBayId,
    setSelectedBayId,
    activeFilter,
    setActiveFilter,
    destination,
    pickDestination,
    clearDestination,
    sheetOpen,
    setSheetOpen,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter: DEFAULT_MAP_CENTER,
    defaultMapZoom: DEFAULT_MAP_ZOOM,
    destinationMapZoom: DESTINATION_MAP_ZOOM,
  }
}
