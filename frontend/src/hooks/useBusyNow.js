import { useEffect, useRef, useState } from 'react'
import { fetchPressureManifest } from '../services/apiPressure'

const POLL_MS = 60_000
const MANIFEST_TIMEOUT_MS = 10_000
const ERR_BACKOFF_START_MS = 10_000
const ERR_BACKOFF_MAX_MS = 120_000

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
  const errBackoffMsRef = useRef(POLL_MS)

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
      let nextDelay = POLL_MS
      const ctrl = new AbortController()
      const timeoutId = window.setTimeout(() => ctrl.abort(), MANIFEST_TIMEOUT_MS)
      try {
        // Use client TTL in apiPressure (MANIFEST_TTL_MS) so polls do not
        // bypass cache and hammer /tiles/manifest.json on production.
        const m = await fetchPressureManifest({ force: false, signal: ctrl.signal })
        if (cancelledRef.current) return
        setManifest(m)
        setStatus('ready')
        setError(null)
        errBackoffMsRef.current = POLL_MS
        nextDelay = POLL_MS
      } catch (e) {
        if (cancelledRef.current) return
        const timedOut = e?.name === 'AbortError'
        setError(timedOut ? new Error('Manifest request timed out') : e)
        setStatus('error')
        const prev = errBackoffMsRef.current
        const bump =
          prev === POLL_MS ? ERR_BACKOFF_START_MS : Math.min(prev * 2, ERR_BACKOFF_MAX_MS)
        errBackoffMsRef.current = bump
        nextDelay = bump
      } finally {
        window.clearTimeout(timeoutId)
        if (!cancelledRef.current) {
          timerRef.current = window.setTimeout(tick, nextDelay)
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
