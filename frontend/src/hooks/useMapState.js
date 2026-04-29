import { useState, useCallback, useRef } from 'react'
import {
  haversineMeters,
  SEARCH_RADIUS_M,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DESTINATION_MAP_ZOOM,
  bayLatLng,
  destinationLatLng,
} from '../utils/mapGeo'
import { SNAP_PEEK } from '../components/layout/BottomSheet'

const ACCESSIBILITY_MODE_STORAGE_KEY = 'melopark.accessibility_mode'

function isAccessibilityBay(bay) {
  const raw = String(bay?.bayType || '').trim().toUpperCase()
  // Epic 4: accept both "DIS ONLY" and "DIS" signage tags.
  if (raw === 'DIS ONLY' || raw === 'DIS') return true
  // Backend/API-normalised values often map disability bays as "Disabled".
  if (raw === 'DISABLED' || raw === 'DISABLED PARKING') return true
  return false
}


function extractParkingMinutes(bay) {
  const raw = String(bay?.bayType || '').toUpperCase()
  if (!raw || raw === 'OTHER') return null

  // Match minute formats: "30M", "30 MIN", "30 MINS", "45 MINUTE(S)"
  const minMatch = raw.match(/(\d+)\s*(?:M|MIN|MINS|MINUTE|MINUTES)\b/)
  if (minMatch) {
    const mins = Number(minMatch[1])
    return Number.isFinite(mins) ? mins : null
  }

  // Match hour formats: "1P", "2 H", "3 HR", "4 HOUR(S)"
  const hourMatch = raw.match(/(\d+)\s*(?:P|H|HR|HRS|HOUR|HOURS)\b/)
  if (hourMatch) {
    const hrs = Number(hourMatch[1])
    return Number.isFinite(hrs) ? hrs * 60 : null
  }

  // Match fractional P formats: "1/2P", "1 / 2 P", "1/4P"
  const fracPMatch = raw.match(/(\d+)\s*\/\s*(\d+)\s*P\b/)
  if (fracPMatch) {
    const num = Number(fracPMatch[1])
    const den = Number(fracPMatch[2])
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return Math.round((num / den) * 60)
    }
  }

  // Match common textual halves if they appear in some feeds.
  if (raw.includes('HALF HOUR')) return 30

  return null
}

export function useMapState() {
  const [selectedBayId, _setSelectedBayId] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [destination, setDestination] = useState(null)
  const [sheetSnap, setSheetSnap] = useState(SNAP_PEEK)
  const [showLimitedBays, setShowLimitedBays] = useState(false)
  const [accessibilityMode, _setAccessibilityMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(ACCESSIBILITY_MODE_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const baysRef = useRef([])

  const setAccessibilityMode = useCallback((next) => {
    _setAccessibilityMode((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      const on = Boolean(value)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(ACCESSIBILITY_MODE_STORAGE_KEY, on ? '1' : '0')
        } catch {
          /* ignore quota / private mode */
        }
      }
      return on
    })
  }, [])


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
            const dl = destinationLatLng(destination)
            return haversineMeters(bl.lat, bl.lng, dl.lat, dl.lng) < SEARCH_RADIUS_M
          })
        : bays

      const accessibilityPool = accessibilityMode ? pool.filter(isAccessibilityBay) : pool

      return accessibilityPool.filter((b) => {
        if (activeFilter === 'all') return true
        if (activeFilter === 'available') return b.type === 'available'
        if (activeFilter === 'trap') return b.type === 'trap'
        const mins = extractParkingMinutes(b)
        if (mins == null) return false
        if (activeFilter === 'lt1h') return mins < 60
        if (activeFilter === '1h') return mins === 60
        if (activeFilter === '2h') return mins === 120
        if (activeFilter === '3h') return mins === 180
        if (activeFilter === '4h') return mins === 240
        return true
      })
    },
    [destination, activeFilter, accessibilityMode],
  )

  const getProximityBays = useCallback(
    (bays) => {
      if (!destination) return accessibilityMode ? bays.filter(isAccessibilityBay) : bays
      const inRadius = bays.filter((b) => {
        const bl = bayLatLng(b)
        const dl = destinationLatLng(destination)
        return haversineMeters(bl.lat, bl.lng, dl.lat, dl.lng) < SEARCH_RADIUS_M
      })
      return accessibilityMode ? inRadius.filter(isAccessibilityBay) : inRadius
    },
    [destination, accessibilityMode],
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
    accessibilityMode,
    setAccessibilityMode,
    setBaysRef,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter: DEFAULT_MAP_CENTER,
    defaultMapZoom: DEFAULT_MAP_ZOOM,
    destinationMapZoom: DESTINATION_MAP_ZOOM,
  }
}
