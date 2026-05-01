import { useState, useEffect, useCallback } from 'react'
import { fetchPressure, fetchZoneHulls, fetchAlternatives } from '../services/apiPressure'

const POLL_MS = 30_000

/**
 * @typedef {Object} PressureZone
 * @property {string} [zone]
 * @property {number} [free_bays]
 * @property {number} [occupied_bays]
 * @property {number} [total_bays]
 * @property {number} [occupancy_rate]
 */

/**
 * @typedef {Object} UsePressureResult
 * @property {PressureZone[]} zones
 * @property {unknown} hulls
 * @property {string} horizon
 * @property {(next: string) => void} setHorizon
 * @property {boolean} loading
 * @property {string | null} error
 * @property {unknown} dataSources
 * @property {() => Promise<void>} refresh
 */

/**
 * @typedef {Object} AlternativesData
 * @property {Object | null} [target]
 * @property {Object[]} [alternatives]
 */

/**
 * Poll pressure data while enabled.
 * @param {boolean} [enabled=false]
 * @returns {UsePressureResult}
 */
export function usePressure(enabled = false) {
  const [zones, setZones] = useState([])
  const [hulls, setHulls] = useState(null)
  const [horizon, setHorizon] = useState('now')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dataSources, setDataSources] = useState(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const data = await fetchPressure(null, horizon)
      setZones(data.zones || [])
      setDataSources(data.data_sources || null)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [enabled, horizon])

  useEffect(() => {
    if (!enabled) { setZones([]); return }
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || hulls) return
    fetchZoneHulls()
      .then(setHulls)
      .catch((e) => console.warn('Zone hulls load failed:', e.message))
  }, [enabled, hulls])

  return { zones, hulls, horizon, setHorizon, loading, error, dataSources, refresh }
}

/**
 * Fetch pressure alternatives for a location.
 * @param {number | null | undefined} lat
 * @param {number | null | undefined} lon
 * @param {string | null} [at=null]
 * @param {boolean} [enabled=false]
 * @returns {{ data: AlternativesData | null, loading: boolean }}
 */
export function useAlternatives(lat, lon, at = null, enabled = false) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || lat == null || lon == null) { setData(null); return }
    let cancelled = false
    setLoading(true)
    fetchAlternatives(lat, lon, at)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [lat, lon, at, enabled])

  return { data, loading }
}
