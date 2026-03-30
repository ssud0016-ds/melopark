import { useState } from 'react'
import { translateRestriction } from '../services/api'

/**
 * Hook for the restriction translator (Epic 2).
 *
 * Call translate(bayId) when a user taps a bay.
 * Returns the plain English verdict.
 */
export function useRestrictionTranslator() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function translate(bayId, options = {}) {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await translateRestriction(bayId, options)
      setResult(data)
    } catch (err) {
      console.error('Failed to translate restriction:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setResult(null)
    setError(null)
  }

  return { result, loading, error, translate, clear }
}
