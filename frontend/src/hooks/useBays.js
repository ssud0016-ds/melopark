import { useState, useEffect, useCallback } from 'react'
import { INITIAL_BAYS } from '../data/mapData'
import { fetchParkingBays } from '../services/apiBays'
import { isApproxCbd } from '../utils/mapGeo'

const POLL_MS = 8_000

const demoBays = () => INITIAL_BAYS.map((b) => ({ ...b, source: 'demo' }))

export function useBays() {
  const [bays, setBays] = useState(demoBays)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usingLiveData, setUsingLiveData] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const raw = await fetchParkingBays()
      const inCbd = raw.filter((b) => isApproxCbd(b.lat, b.lng))
      setBays(inCbd.length ? inCbd : raw)
      setLastUpdated(new Date())
      setError(null)
      setUsingLiveData(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load parking data'
      setError(msg)
      setUsingLiveData((wasLive) => {
        if (!wasLive) setBays(demoBays())
        return wasLive
      })
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const availableBayCount = bays.filter((b) => b.type === 'available').length
  const totalFreeSpots = bays
    .filter((b) => b.type === 'available')
    .reduce((sum, b) => sum + (b.free ?? 0), 0)

  return {
    bays,
    lastUpdated,
    loading,
    error,
    refresh,
    usingLiveData,
    availableBayCount,
    totalFreeSpots,
  }
}
