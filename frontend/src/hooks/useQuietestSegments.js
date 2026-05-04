import { useEffect, useRef, useState } from 'react'
import { fetchQuietestSegments } from '../services/apiPressure'

const DEBOUNCE_MS = 500

/**
 * Fetches the quietest street segments within the current map viewport.
 *
 * @param {{ bounds: object|null, enabled: boolean }} options
 *   bounds - Leaflet-style bounds object { west, south, east, north }
 *   enabled - skip fetch entirely when false (e.g. destination is set)
 * @returns {{ segments: Array, loading: boolean }}
 */
export function useQuietestSegments({ bounds, enabled }) {
  const [segments, setSegments] = useState([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!enabled || !bounds) {
      setSegments([])
      setLoading(false)
      return
    }

    // Debounce 500 ms before firing the fetch
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setLoading(true)
      fetchQuietestSegments(bounds, 150, { signal: ctrl.signal })
        .then((data) => {
          if (ctrl.signal.aborted) return
          setSegments(Array.isArray(data) ? data : [])
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setSegments([])
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [bounds, enabled])

  return { segments, loading }
}
