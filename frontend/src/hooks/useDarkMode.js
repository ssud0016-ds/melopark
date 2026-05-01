import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'melopark-dark-mode'

/**
 * Dark mode state + toggle tuple.
 * @typedef {[boolean, () => void]} UseDarkModeTuple
 */

/**
 * Persists dark mode in localStorage and syncs with system preference
 * when there is no explicit stored user choice.
 *
 * @returns {UseDarkModeTuple}
 */
export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, String(dark))
  }, [dark])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    /** @param {MediaQueryListEvent} e */
    const handler = (e) => {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        setDark(e.matches)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggle = useCallback(() => setDark((d) => !d), [])

  return [dark, toggle]
}
