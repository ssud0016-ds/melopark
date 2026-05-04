/**
 * useParkingForecast.js
 * =====================
 * React hook for Epic 6 Predictive Parking Intelligence.
 *
 * Polls /api/forecasts/warnings every 5 minutes.
 * Fetches /api/forecasts/alternatives when a destination is set.
 *
 * Usage in MapPage.jsx:
 *   const forecast = useParkingForecast({ destination, plannerArrivalIso })
 *   // forecast.warnings   -- US 6.1 zone warnings
 *   // forecast.alternatives -- US 6.2 alternative zones
 *   // forecast.loading    -- boolean
 *   // forecast.worstLevel -- 'low' | 'moderate' | 'high' | 'critical'
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchForecastWarnings,
  fetchForecastAlternatives,
} from '../services/apiForecasts'

const POLL_MS = 5 * 60 * 1000   // 5 minutes

const LEVEL_ORDER = { low: 0, moderate: 1, high: 2, critical: 3 }

/**
 * @param {object} opts
 * @param {object|null}  opts.destination       -- { lat, lng, name } or null
 * @param {string|null}  opts.plannerArrivalIso -- ISO datetime or null (= now)
 * @param {boolean}      opts.enabled           -- set false to pause polling
 * @param {number}       opts.hoursAhead        -- warning window (default 6)
 */
export function useParkingForecast({
  destination = null,
  plannerArrivalIso = null,
  enabled = true,
  hoursAhead = 6,
} = {}) {
  const [warnings, setWarnings] = useState([])
  const [alternatives, setAlternatives] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // --- US 6.1: Poll peak-time warnings ---
  const refreshWarnings = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await fetchForecastWarnings(hoursAhead)
      setWarnings(data.warnings || [])
      setError(null)
    } catch (e) {
      // Silently fail: warnings are non-critical, don't block the map
      setError(e.message)
    }
  }, [enabled, hoursAhead])

  useEffect(() => {
    if (!enabled) { setWarnings([]); return }
    refreshWarnings()
    const id = setInterval(refreshWarnings, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, refreshWarnings])

  // --- US 6.2: Fetch alternatives when destination or arrival changes ---
  useEffect(() => {
    if (!enabled || !destination?.lat || !destination?.lng) {
      setAlternatives(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchForecastAlternatives(
      destination.lat,
      destination.lng,
      plannerArrivalIso || null,
    )
      .then((data) => { if (!cancelled) setAlternatives(data) })
      .catch(() => { if (!cancelled) setAlternatives(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled, destination?.lat, destination?.lng, plannerArrivalIso])

  // Derived: worst warning level across all zones in the next 1 hour
  const worstLevel = useMemo(() => {
    const now = warnings.filter((w) => w.hours_from_now <= 1)
    if (!now.length) return 'low'
    return now.reduce((best, w) => {
      return (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[best] || 0)
        ? w.warning_level
        : best
    }, 'low')
  }, [warnings])

  // Unique zones with their worst warning in the next hoursAhead window
  const zoneWarnings = useMemo(() => {
    const byZone = {}
    for (const w of warnings) {
      const prev = byZone[w.zone]
      if (!prev || (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[prev.warning_level] || 0)) {
        byZone[w.zone] = w
      }
    }
    return Object.values(byZone).sort(
      (a, b) => (LEVEL_ORDER[b.warning_level] || 0) - (LEVEL_ORDER[a.warning_level] || 0),
    )
  }, [warnings])

  return {
    warnings,
    zoneWarnings,
    worstLevel,
    alternatives,
    loading,
    error,
    refresh: refreshWarnings,
  }
}
