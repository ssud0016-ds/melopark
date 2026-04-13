import { useState, useEffect, useCallback } from 'react'
import { getParkingBays } from '../services/api'

const POLL_INTERVAL = 60_000 // refresh every 60 seconds

/**
 * Hook that polls live parking bay data from /api/parking and returns it.
 *
 * @returns {{ sensors, loading, error, refresh }}
 */
export function useSensors() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await getParkingBays()
      // /api/parking returns a flat array directly
      setSensors(Array.isArray(result) ? result : [])
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

  return { sensors, loading, error, refresh }
}
