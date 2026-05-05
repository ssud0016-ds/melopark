import { useState, useEffect, useCallback, useMemo } from 'react'

const POLL_MS = 5 * 60 * 1000
const LEVEL_ORDER = { low: 0, moderate: 1, high: 2, critical: 3 }

async function fetchForecastWarnings(hours = 6) {
  const resp = await fetch('/api/forecasts/warnings?hours=' + hours)
  if (!resp.ok) throw new Error('Forecast warnings API ' + resp.status)
  return resp.json()
}

async function fetchForecastAlternatives(lat, lon, at) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) })
  if (at) params.set('at', at)
  const resp = await fetch('/api/forecasts/alternatives?' + params)
  if (!resp.ok) throw new Error('Forecast alternatives API ' + resp.status)
  return resp.json()
}

export function useParkingForecast({ destination = null, plannerArrivalIso = null, enabled = true, hoursAhead = 6 } = {}) {
  const [warnings, setWarnings] = useState([])
  const [alternatives, setAlternatives] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refreshWarnings = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await fetchForecastWarnings(hoursAhead)
      setWarnings(data.warnings || [])
      setError(null)
    } catch (e) { setError(e.message) }
  }, [enabled, hoursAhead])

  useEffect(() => {
    if (!enabled) { setWarnings([]); return }
    refreshWarnings()
    const id = setInterval(refreshWarnings, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, refreshWarnings])

  useEffect(() => {
    if (!enabled || !destination || !destination.lat || !destination.lng) { setAlternatives(null); return }
    let cancelled = false
    setLoading(true)
    fetchForecastAlternatives(destination.lat, destination.lng, plannerArrivalIso || null)
      .then((data) => { if (!cancelled) setAlternatives(data) })
      .catch(() => { if (!cancelled) setAlternatives(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled, destination && destination.lat, destination && destination.lng, plannerArrivalIso])

  const worstLevel = useMemo(() => {
    const now = warnings.filter((w) => w.hours_from_now <= 1)
    if (!now.length) return 'low'
    return now.reduce((best, w) =>
      (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[best] || 0) ? w.warning_level : best, 'low')
  }, [warnings])

  const zoneWarnings = useMemo(() => {
    const byZone = {}
    for (const w of warnings) {
      const prev = byZone[w.zone]
      if (!prev || (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[prev.warning_level] || 0)) byZone[w.zone] = w
    }
    return Object.values(byZone).sort((a, b) =>
      (LEVEL_ORDER[b.warning_level] || 0) - (LEVEL_ORDER[a.warning_level] || 0))
  }, [warnings])

  return { warnings, zoneWarnings, worstLevel, alternatives, loading, error, refresh: refreshWarnings }
}
