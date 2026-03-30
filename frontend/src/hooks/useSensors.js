import { useState, useEffect, useCallback } from 'react'
import { getSensors } from '../services/api'

const POLL_INTERVAL = 60_000 // refresh every 60 seconds

/**
 * Hook that polls live sensor data and returns it.
 *
 * @param {Object} filter - optional { lat, lon, radius }
 * @returns {{ sensors, loading, error, refresh }}
 */
export function useSensors(filter = {}) {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await getSensors(filter)
      setSensors(result.data || [])
    } catch (err) {
      console.error('Failed to fetch sensors:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter.lat, filter.lon, filter.radius])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  return { sensors, loading, error, refresh }
}
