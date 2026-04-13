import { useState, useEffect, useCallback, useRef } from 'react'
import { getParkingBays } from '../services/api'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Hook that polls live parking bay data from /api/parking every 5 minutes.
 *
 * In-flight protection: if a refresh is already running, subsequent calls
 * are silently skipped until the current one completes. This prevents
 * overlapping requests (e.g. from React StrictMode double-mount or a slow
 * network response followed by the next poll tick).
 *
 * @returns {{ sensors, loading, error, lastUpdated, refresh }}
 */
export function useSensors() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Tracks whether a /api/parking request is already in progress.
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return   // skip — previous request still running
    inFlightRef.current = true
    try {
      setError(null)
      const result = await getParkingBays()
      setSensors(Array.isArray(result) ? result : [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch parking bays:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  return { sensors, loading, error, lastUpdated, refresh }
}
