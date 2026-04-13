import { useState, useEffect, useCallback } from 'react'
import { getParkingBays } from '../services/api'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Hook that polls live parking bay data from /api/parking every 5 minutes.
 *
 * @returns {{ sensors, loading, error, lastUpdated, refresh }}
 */
export function useSensors() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refresh = useCallback(async () => {
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
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  return { sensors, loading, error, lastUpdated, refresh }
}
