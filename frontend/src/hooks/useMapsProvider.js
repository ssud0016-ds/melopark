import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'melopark-maps-provider'
const VALID = new Set(['google', 'apple', 'web'])

/**
 * Persists preferred maps provider in localStorage.
 * Mirrors useDarkMode pattern.
 *
 * @typedef {'google' | 'apple' | 'web'} MapsProvider
 * @returns {{
 *   provider: MapsProvider | null,
 *   setProvider: (p: MapsProvider) => void,
 *   clearProvider: () => void,
 * }}
 */
export function useMapsProvider() {
  const [provider, setProviderState] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      return stored && VALID.has(stored) ? stored : null
    } catch {
      return null
    }
  })

  // Cross-tab sync.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e) => {
      if (e.key !== STORAGE_KEY) return
      const next = e.newValue && VALID.has(e.newValue) ? e.newValue : null
      setProviderState(next)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const setProvider = useCallback((p) => {
    if (!VALID.has(p)) return
    setProviderState(p)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, p)
      }
    } catch {
      /* localStorage unavailable; in-memory only */
    }
  }, [])

  const clearProvider = useCallback(() => {
    setProviderState(null)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* swallow */
    }
  }, [])

  return { provider, setProvider, clearProvider }
}

export const MAPS_PROVIDER_STORAGE_KEY = STORAGE_KEY
