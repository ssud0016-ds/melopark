import { useState, useCallback, useRef, useEffect } from 'react'
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

/**
 * @typedef {Object} MapBay
 * @property {string | number} id
 * @property {string} [type]
 * @property {string | null | undefined} [bayType]
 * @property {number | null} [durationMins]
 * @property {string} [limitType]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {number} [x]
 * @property {number} [y]
 * @property {boolean} [allowDetail]
 */

/**
 * @typedef {Object} Destination
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {number} [x]
 * @property {number} [y]
 */

/**
 * @typedef {'all' | 'available' | 'trap' | 'lt1h' | '15min' | '30min' | '1h' | '2h' | '3h' | '4h' | 'custom'} ActiveFilter
 */

/**
 * @callback AccessibilityModeUpdater
 * @param {boolean} prev
 * @returns {boolean}
 */

/**
 * @typedef {Object} UseMapStateResult
 * @property {string | number | null} selectedBayId
 * @property {(id: string | number | null) => void} setSelectedBayId
 * @property {'all' | 'available' | 'trap'} statusFilter
 * @property {(next: 'all' | 'available' | 'trap') => void} setStatusFilter
 * @property {string | null} durationFilter
 * @property {(next: string | null) => void} setDurationFilter
 * @property {Destination | null} destination
 * @property {(lm: Destination) => void} pickDestination
 * @property {() => void} clearDestination
 * @property {number} sheetSnap
 * @property {(next: number) => void} setSheetSnap
 * @property {boolean} showLimitedBays
 * @property {(next: boolean) => void} setShowLimitedBays
 * @property {boolean} accessibilityMode
 * @property {(next: boolean | AccessibilityModeUpdater) => void} setAccessibilityMode
 * @property {(bays: MapBay[]) => void} setBaysRef
 * @property {(bays: MapBay[]) => MapBay[]} getVisibleBays
 * @property {(bays: MapBay[]) => MapBay[]} getProximityBays
 * @property {[number, number]} defaultMapCenter
 * @property {number} defaultMapZoom
 * @property {number} destinationMapZoom
 */

/**
 * @param {MapBay} bay
 * @returns {boolean}
 */
function isAccessibilityBay(bay) {
  const raw = String(bay?.bayType || '').trim().toUpperCase()
  // Epic 4: accept both "DIS ONLY" and "DIS" signage tags.
  if (raw === 'DIS ONLY' || raw === 'DIS') return true
  // Backend/API-normalised values often map disability bays as "Disabled".
  if (raw === 'DISABLED' || raw === 'DISABLED PARKING') return true
  return false
}



export function useMapState() {
  const [selectedBayId, _setSelectedBayId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'available' | 'trap'
  const [durationFilter, setDurationFilter] = useState(null) // null | '15min' | '30min' | '1h' | '2h' | '3h' | '4h' | 'custom'
  const [customDuration, setCustomDuration] = useState(60)
  const [filterTime, setFilterTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [filterDate, setFilterDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [durationBayIds, setDurationBayIds] = useState(null) // Set<string> | null
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

  /**
   * @param {boolean | AccessibilityModeUpdater} next
   */
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
    /**
     * @param {string | number | null} id
     */
    (id) => {
      if (id == null) return _setSelectedBayId(null)
      const bay = baysRef.current.find((b) => b.id === id)
      // Detail sheet always allowed for live bays (allowDetail); hasRules is display-only.
      if (bay && bay.allowDetail === false) return
      _setSelectedBayId(id)
    },
    [],
  )

  /**
   * @param {MapBay[]} bays
   */
  const setBaysRef = useCallback((bays) => {
    baysRef.current = bays
  }, [])

  /**
   * @param {Destination} lm
   */
  const pickDestination = useCallback((lm) => {
    setDestination(lm)
    _setSelectedBayId(null)
  }, [])

  const clearDestination = useCallback(() => {
    setDestination(null)
    _setSelectedBayId(null)
  }, [])

  const _FILTER_TO_MINS = { '15min': 15, '30min': 30, '1h': 60, '2h': 120, '3h': 180, '4h': 240 }

  useEffect(() => {
    if (!durationFilter) {
      setDurationBayIds(null)
      return
    }
    const neededMins = durationFilter === 'custom' ? customDuration : _FILTER_TO_MINS[durationFilter]
    if (!neededMins) return
    const controller = new AbortController()
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const day = new Date(filterDate + 'T00:00:00').getDay() // derive 0=Sun…6=Sat from the date
    const params = new URLSearchParams({ needed_mins: neededMins, arrival_time: filterTime, day })
    fetch(`${base}/api/parking/filter?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setDurationBayIds(new Set(data.bay_ids || [])))
      .catch(() => {})
    return () => controller.abort()
  }, [durationFilter, customDuration, filterTime, filterDate])

  const getVisibleBays = useCallback(
    /**
     * @param {MapBay[]} bays
     * @returns {MapBay[]}
     */
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
        // Status filter
        if (statusFilter === 'available' && b.type !== 'available') return false
        if (statusFilter === 'trap' && b.type !== 'trap') return false
        // Duration filter
        if (durationFilter) {
          if (durationBayIds === null) return true // still loading
          if (!durationBayIds.has(String(b.id))) return false
        }
        return true
      })
    },
    [destination, statusFilter, durationFilter, accessibilityMode, durationBayIds],
  )

  const getProximityBays = useCallback(
    /**
     * @param {MapBay[]} bays
     * @returns {MapBay[]}
     */
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

  /** @type {UseMapStateResult} */
  return {
    selectedBayId,
    setSelectedBayId,
    statusFilter,
    setStatusFilter,
    durationFilter,
    setDurationFilter,
    customDuration,
    setCustomDuration,
    filterTime,
    setFilterTime,
    filterDate,
    setFilterDate,
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
