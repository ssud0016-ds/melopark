import { useState, useEffect } from 'react'

/**
 * Debounces planner param updates (300ms). Clears immediately when raw becomes null.
 *
 * @typedef {Object} PlannerParams
 * @property {string} arrivalIso
 * @property {number} durationMins
 *
 * @param {PlannerParams | null} rawPlanner
 * @param {number} [delayMs=300]
 * @returns {PlannerParams | null}
 */
export function useDebouncedPlannerParams(rawPlanner, delayMs = 300) {
  const [debounced, setDebounced] = useState(null)

  useEffect(() => {
    if (rawPlanner === null) {
      setDebounced(null)
      return
    }
    const t = setTimeout(() => setDebounced(rawPlanner), delayMs)
    return () => clearTimeout(t)
  }, [rawPlanner?.arrivalIso, rawPlanner?.durationMins, rawPlanner === null, delayMs])

  return debounced
}
