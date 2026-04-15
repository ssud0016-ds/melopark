import { useState, useCallback, useRef } from 'react'
import {
  normToLatLng,
  haversineMeters,
  SEARCH_RADIUS_M,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
  bayLatLng,
} from '../utils/mapGeo'
import { SNAP_PEEK } from '../components/layout/BottomSheet'

export function useMapState() {
  const [selectedBayId, _setSelectedBayId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [destination, setDestination] = useState(null)
  const [sheetSnap, setSheetSnap] = useState(SNAP_PEEK)
  const [showLimitedBays, setShowLimitedBays] = useState(false)

  const baysRef = useRef([])

  const setSelectedBayId = useCallback(
    (id) => {
      if (id == null) return _setSelectedBayId(null)
      const bay = baysRef.current.find((b) => b.id === id)
      if (bay && !bay.hasRules) return
      _setSelectedBayId(id)
    },
    [],
  )

  const setBaysRef = useCallback((bays) => {
    baysRef.current = bays
  }, [])

  const pickDestination = useCallback((lm) => {
    setDestination(lm)
    _setSelectedBayId(null)
  }, [])

  const clearDestination = useCallback(() => {
    setDestination(null)
    _setSelectedBayId(null)
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
        if (activeFilter === 'hasRules') return b.hasRules === true
        if (activeFilter === 'trap') return b.type === 'trap'
        if (activeFilter === 'timed') return b.bayType === 'Timed'
        if (activeFilter === 'occupied') return b.type === 'occupied'
        return true
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
    sheetSnap,
    setSheetSnap,
    showLimitedBays,
    setShowLimitedBays,
    setBaysRef,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter: DEFAULT_MAP_CENTER,
    defaultMapZoom: DEFAULT_MAP_ZOOM,
    destinationMapZoom: DESTINATION_MAP_ZOOM,
  }
}
