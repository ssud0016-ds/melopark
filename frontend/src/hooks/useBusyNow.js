import { useEffect, useRef, useState } from 'react'
import { fetchPressureManifest } from '../services/apiPressure'

const POLL_MS = 60_000

/**
 * Polls the pressure manifest while `enabled` is true.
 * Returns `{ manifest, status, error }`.
 *   status: 'idle' | 'loading' | 'ready' | 'error'
 */
export function useBusyNow(enabled) {
  const [manifest, setManifest] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    if (!enabled) {
      setStatus('idle')
      return () => {
        cancelledRef.current = true
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }

    setStatus((s) => (s === 'idle' ? 'loading' : s))

    const tick = async () => {
      try {
        const m = await fetchPressureManifest({ force: true })
        if (cancelledRef.current) return
        setManifest(m)
        setStatus('ready')
        setError(null)
      } catch (e) {
        if (cancelledRef.current) return
        setError(e)
        setStatus('error')
      } finally {
        if (!cancelledRef.current) {
          timerRef.current = setTimeout(tick, POLL_MS)
        }
      }
    }
    tick()

    return () => {
      cancelledRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled])

  return { manifest, status, error }
}
