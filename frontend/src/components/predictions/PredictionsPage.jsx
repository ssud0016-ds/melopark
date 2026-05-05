/**
 * PredictionsPage.jsx  — Epic 6 Predictive Parking Intelligence
 *
 * Design reference: Google Maps "Popular times" + Apple Maps look-ahead.
 * - Bar chart per hour (like Google's popular times widget)
 * - Top free / busiest zones ranked cards
 * - Zone detail with 6h bar chart when selected
 * - Live alternatives when destination chosen
 * - All SVG icons, no emojis, professional tone
 */

import { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Clock:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  Pin:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  Chart:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Warning:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Check:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Car:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/><path d="M5 12h14"/></svg>,
  Walk:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><circle cx="13" cy="4" r="1.5"/><path d="M9 20l1-4 3 2 2-8"/><path d="M6.5 13.5L9 12l3.5 2"/><path d="M15 20l-1-4"/></svg>,
  Calendar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Refresh:  ({ spin = false }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Right:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6"/></svg>,
  Event:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
}

// ─── Level config ─────────────────────────────────────────────────────────────
const LEVEL = {
  low:      { label: 'Low',       colour: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  moderate: { label: 'Moderate',  colour: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  high:     { label: 'High',      colour: '#f97316', bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  critical: { label: 'Very busy', colour: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
}
const LEVEL_ORDER = { low: 0, moderate: 1, high: 2, critical: 3 }
const HOURS = [0,1,2,3,4,5,6]
const HOUR_LABELS = ['Now','+1h','+2h','+3h','+4h','+5h','+6h']

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ─── Popular times bar chart (Google-style) ───────────────────────────────────
function PopularTimesChart({ data, selectedHour, onHourClick, accentColour = '#3b82f6' }) {
  if (!data || !data.length) return null
  const max = Math.max(...data.map(d => d.occ), 0.01)
  // Normalize so differences are always visible — like Google maps
  const barHeight = v => 0.15 + (v / max) * 0.85

  return (
    <div className="select-none">
      <div className="flex items-end gap-1.5" style={{ height: 64 }}>
        {data.map((d, i) => {
          const h = barHeight(d.occ)
          const cfg = LEVEL[d.level] || LEVEL.low
          const isNow = i === 0
          const isSel = i === selectedHour
          const colour = isSel ? cfg.colour : isNow ? accentColour : '#e5e7eb'
          return (
            <button key={i} onClick={() => onHourClick?.(i)}
              className="relative flex-1 flex flex-col items-center justify-end group"
              style={{ height: 64 }}
              title={`${HOUR_LABELS[i]}: ${Math.round(d.occ * 100)}%`}>
              {isSel && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white z-10 pointer-events-none"
                  style={{ backgroundColor: cfg.colour }}>
                  {Math.round(d.occ * 100)}%
                </div>
              )}
              <div className="w-full rounded-t-sm transition-all duration-200 group-hover:opacity-80"
                style={{ height: `${Math.round(h * 64)}px`, backgroundColor: colour }} />
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {HOUR_LABELS.map((l, i) => (
          <button key={i} onClick={() => onHourClick?.(i)}
            className={`flex-1 text-center text-[10px] transition-colors leading-none py-0.5 rounded ${
              selectedHour === i
                ? 'font-bold text-gray-900 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function OccBar({ pct, level }) {
  const cfg = LEVEL[level] || LEVEL.low
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: cfg.colour }} />
      </div>
      <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: cfg.colour }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

function Badge({ level }) {
  const cfg = LEVEL[level] || LEVEL.low
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border shrink-0"
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionHead({ icon: IconComp, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
        <IconComp />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Skeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" style={{ flex: 1, maxWidth: `${55+i*9}%` }} />
          <div className="w-10 h-3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PredictionsPage() {
  const [warnings, setWarnings]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [lastFetched, setLastFetched]   = useState(null)
  const [destination, setDestination]   = useState('')
  const [arrivalTime, setArrivalTime]   = useState('')
  const [alternatives, setAlternatives] = useState(null)
  const [altLoading, setAltLoading]     = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedHour, setSelectedHour] = useState(0)

  const fetchWarnings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/api/forecasts/warnings?hours=6')
      setWarnings(data.warnings || [])
      setLastFetched(new Date())
      setError(null)
    } catch {
      setError('Unable to load forecast data. Check the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWarnings()
    const id = setInterval(fetchWarnings, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchWarnings])

  // Derived data
  const currentZones = useMemo(() => {
    const m = {}
    for (const w of warnings) {
      if (w.hours_from_now !== 0) continue
      const p = m[w.zone]
      if (!p || LEVEL_ORDER[w.warning_level] > LEVEL_ORDER[p.warning_level]) m[w.zone] = w
    }
    return Object.values(m)
  }, [warnings])

  const topFree   = useMemo(() => [...currentZones].sort((a,b) => a.predicted_occupancy - b.predicted_occupancy).slice(0,8), [currentZones])
  const busiest   = useMemo(() => [...currentZones].sort((a,b) => b.predicted_occupancy - a.predicted_occupancy).slice(0,5), [currentZones])
  const allSorted = useMemo(() => [...currentZones].sort((a,b) => a.zone.localeCompare(b.zone)), [currentZones])

  const activeEvts = useMemo(() => {
    const seen = new Set(); const out = []
    for (const w of warnings) {
      if (w.hours_from_now > 2 || !w.events_nearby || w.events_nearby === 'None') continue
      if (!seen.has(w.events_nearby)) { seen.add(w.events_nearby); out.push(w) }
    }
    return out
  }, [warnings])

  const cbdChart = useMemo(() => HOURS.map(h => {
    const sl = warnings.filter(w => w.hours_from_now === h)
    if (!sl.length) return { h, occ: 0.5, level: 'moderate' }
    const avg = sl.reduce((s,w) => s + w.predicted_occupancy, 0) / sl.length
    const lv  = sl.reduce((b,w) => LEVEL_ORDER[w.warning_level] > LEVEL_ORDER[b] ? w.warning_level : b, 'low')
    return { h, occ: avg, level: lv }
  }), [warnings])

  const zoneChart = useMemo(() => {
    if (!selectedZone) return []
    return HOURS.map(h => {
      const w = warnings.find(x => x.zone === selectedZone && x.hours_from_now === h)
      return { h, occ: w?.predicted_occupancy ?? 0, level: w?.warning_level ?? 'low', event: w?.events_nearby !== 'None' ? w?.events_nearby : null }
    })
  }, [selectedZone, warnings])

  const worstLevel = useMemo(() =>
    currentZones.reduce((b,w) => LEVEL_ORDER[w.warning_level] > LEVEL_ORDER[b] ? w.warning_level : b, 'low')
  , [currentZones])

  // Fetch alternatives when destination changes
  useEffect(() => {
    if (!destination) { setAlternatives(null); return }
    const zone = currentZones.find(z => z.zone === destination)
    if (!zone?.zone_lat) return
    let cancelled = false
    setAltLoading(true)
    const atParam = arrivalTime ? `&at=${encodeURIComponent(arrivalTime)}` : ''
    apiFetch(`/api/forecasts/alternatives?lat=${zone.zone_lat}&lon=${zone.zone_lon}${atParam}`)
      .then(d => { if (!cancelled) setAlternatives(d) })
      .catch(() => { if (!cancelled) setAlternatives(null) })
      .finally(() => { if (!cancelled) setAltLoading(false) })
    return () => { cancelled = true }
  }, [destination, arrivalTime, currentZones])

  const handleZoneSelect = zone => { setSelectedZone(zone); setDestination(zone) }

  const selData = selectedZone && zoneChart.length ? zoneChart[selectedHour] : null
  const selCfg  = selData ? (LEVEL[selData.level] || LEVEL.low) : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Sticky inputs */}
      <div className="sticky top-16 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Icon.Pin /></span>
            <select value={destination} onChange={e => handleZoneSelect(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
              <option value="">Where are you parking?</option>
              {allSorted.map(z => <option key={z.zone} value={z.zone}>{z.zone}</option>)}
            </select>
          </div>
          <div className="relative sm:w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Icon.Calendar /></span>
            <input type="datetime-local" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={fetchWarnings} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 shrink-0">
            <Icon.Refresh spin={loading} />
            {lastFetched ? lastFetched.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' }) : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-4 flex items-center gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-sm text-red-700 dark:text-red-400">
          <Icon.Warning />{error}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* CBD overview + events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between gap-3 mb-5">
              <SectionHead icon={Icon.Chart} title="Demand forecast — next 6 hours" subtitle="Average predicted occupancy across all CBD zones" />
              <Badge level={worstLevel} />
            </div>
            {loading ? (
              <div className="h-16 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <PopularTimesChart data={cbdChart} selectedHour={selectedHour} onHourClick={setSelectedHour} />
                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center gap-4 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2 rounded-sm bg-blue-400 inline-block" />Current hour</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2 rounded-sm bg-gray-200 inline-block" />Forecast</span>
                  <span className="ml-auto">Click any bar to inspect that hour</span>
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionHead icon={Icon.Event} title="Active events" subtitle="Events affecting parking nearby" />
            {loading ? <Skeleton rows={3} /> : !activeEvts.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-300 dark:text-gray-600">
                <div className="text-emerald-400"><Icon.Check /></div>
                <span className="text-xs text-gray-400">No active events detected</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeEvts.slice(0,5).map((w,i) => (
                  <button key={i} onClick={() => handleZoneSelect(w.zone)}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-colors">
                    <div className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor:'#fffbeb', color:'#b45309' }}>
                      <Icon.Warning />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate leading-snug">{w.events_nearby}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5 leading-snug">{w.zone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Selected zone detail */}
        {selectedZone && zoneChart.length > 0 && (
          <Card>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
                  <Icon.Pin />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedZone}</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Predicted demand over the next 6 hours</p>
                </div>
              </div>
              {selData && <Badge level={selData.level} />}
            </div>

            <PopularTimesChart data={zoneChart} selectedHour={selectedHour} onHourClick={setSelectedHour}
              accentColour={selCfg?.colour || '#3b82f6'} />

            {/* Hour grid */}
            <div className="mt-5 grid grid-cols-7 gap-1.5">
              {zoneChart.map((d, i) => {
                const cfg = LEVEL[d.level] || LEVEL.low
                const isSel = i === selectedHour
                return (
                  <button key={i} onClick={() => setSelectedHour(i)}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all"
                    style={isSel
                      ? { backgroundColor: cfg.bg, borderColor: cfg.border }
                      : { backgroundColor: 'transparent', borderColor: 'transparent' }}>
                    <span className="text-[9px] font-medium" style={isSel ? { color: cfg.text } : { color: '#9ca3af' }}>{HOUR_LABELS[i]}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: isSel ? cfg.colour : '#6b7280' }}>
                      {Math.round(d.occ * 100)}%
                    </span>
                    {d.event && <span style={{ color:'#f59e0b' }}><Icon.Warning /></span>}
                  </button>
                )
              })}
            </div>

            {selData?.event && (
              <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium"
                style={{ backgroundColor:'#fffbeb', borderColor:'#fde68a', color:'#b45309' }}>
                <Icon.Warning />Event nearby: {selData.event}
              </div>
            )}
          </Card>
        )}

        {/* Alternatives */}
        {destination && (
          <Card>
            <SectionHead icon={Icon.Car}
              title={`Alternatives near ${destination}`}
              subtitle="Ranked by availability score — lower occupancy + shorter walk" />
            {altLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                Finding quieter areas nearby…
              </div>
            ) : !alternatives ? (
              <p className="text-sm text-gray-400 py-2">Select a destination to see alternatives.</p>
            ) : !alternatives.alternatives?.length ? (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <span className="text-emerald-500 shrink-0"><Icon.Check /></span>
                <p className="text-sm text-gray-500">No quieter alternatives found within 800m.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alternatives.target_zone && (() => {
                  const cfg = LEVEL[alternatives.target_zone.pressure_level] || LEVEL.low
                  return (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border mb-3"
                      style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
                      <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: cfg.colour }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium mb-0.5" style={{ color: cfg.text }}>Your destination</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{alternatives.target_zone.zone}</p>
                        <div className="mt-1"><OccBar pct={alternatives.target_zone.predicted_occ} level={alternatives.target_zone.pressure_level} /></div>
                      </div>
                    </div>
                  )
                })()}
                {alternatives.alternatives.map((alt, i) => {
                  const cfg = LEVEL[alt.pressure_level] || LEVEL.low
                  return (
                    <button key={i} onClick={() => handleZoneSelect(alt.zone)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left hover:shadow-sm group transition-all"
                      style={{ backgroundColor:'white', borderColor: cfg.border }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ backgroundColor: cfg.colour }}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{alt.zone}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <OccBar pct={alt.predicted_occ} level={alt.pressure_level} />
                          <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                            <Icon.Walk />{alt.walk_minutes} min
                          </span>
                        </div>
                      </div>
                      <span className="text-gray-200 group-hover:text-gray-400 transition-colors shrink-0"><Icon.Right /></span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {/* Best / Busiest */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <SectionHead icon={Icon.Check} title="Best availability now" subtitle="Lowest predicted occupancy" />
            {loading ? <Skeleton /> : !topFree.length ? <p className="text-sm text-gray-400">No data</p> : (
              <div className="space-y-0.5">
                {topFree.map((z, i) => (
                  <button key={z.zone} onClick={() => handleZoneSelect(z.zone)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors group border ${
                      selectedZone === z.zone
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className="text-[10px] font-bold text-gray-300 w-4 tabular-nums text-right shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate leading-tight">{z.zone}</p>
                      <div className="mt-0.5"><OccBar pct={z.predicted_occupancy} level={z.warning_level} /></div>
                    </div>
                    <span className="text-gray-200 group-hover:text-gray-400 transition-colors shrink-0"><Icon.Right /></span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHead icon={Icon.Warning} title="Busiest areas now" subtitle="Highest predicted demand" />
            {loading ? <Skeleton rows={5} /> : !busiest.length ? <p className="text-sm text-gray-400">No data</p> : (
              <div className="space-y-0.5">
                {busiest.map((z, i) => (
                  <button key={z.zone} onClick={() => handleZoneSelect(z.zone)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors group border ${
                      selectedZone === z.zone
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className="text-[10px] font-bold text-gray-300 w-4 tabular-nums text-right shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate leading-tight">{z.zone}</p>
                      <div className="mt-0.5"><OccBar pct={z.predicted_occupancy} level={z.warning_level} /></div>
                    </div>
                    <Badge level={z.warning_level} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Full zone table */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <SectionHead icon={Icon.Chart}
              title={`All zones — ${selectedHour === 0 ? 'now' : `in ${selectedHour}h`}`}
              subtitle={`${warnings.filter(w => w.hours_from_now === selectedHour).length} zones`} />
            <div className="flex items-center gap-1 flex-wrap">
              {HOUR_LABELS.map((l,i) => (
                <button key={i} onClick={() => setSelectedHour(i)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    selectedHour === i
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {loading ? <Skeleton rows={8} /> : (
            <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Zone</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-36">Occupancy</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/40">
                  {warnings
                    .filter(w => w.hours_from_now === selectedHour)
                    .sort((a,b) => b.predicted_occupancy - a.predicted_occupancy)
                    .map(w => {
                      const cfg = LEVEL[w.warning_level] || LEVEL.low
                      return (
                        <tr key={w.zone} onClick={() => handleZoneSelect(w.zone)}
                          className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 ${selectedZone === w.zone ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.colour }} />
                              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate max-w-xs">{w.zone}</span>
                              {w.events_nearby && w.events_nearby !== 'None' && (
                                <span className="text-amber-400 shrink-0" title={w.events_nearby}><Icon.Warning /></span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width:`${Math.round(w.predicted_occupancy*100)}%`, backgroundColor: cfg.colour }} />
                              </div>
                              <span className="text-xs font-bold tabular-nums" style={{ color: cfg.colour }}>
                                {Math.round(w.predicted_occupancy*100)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right"><Badge level={w.warning_level} /></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center pb-4">
          Melbourne CBD · SCATS traffic signal data · City of Melbourne open data · XGBoost predictive model
        </p>
      </div>
    </div>
  )
}
