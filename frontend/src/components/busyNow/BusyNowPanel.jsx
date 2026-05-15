import { useEffect, useRef, useState } from 'react'
import { fetchAlternatives } from '../../services/apiPressure'
import { getStatusFillColor } from '../map/ParkingMap'

const CHANCE_TEXT = {
  low: 'Good chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  unknown: 'No live estimate',
}

function splitStreetName(name) {
  if (!name) return { main: name, cross: null }
  const m = name.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/)
  return m ? { main: m[1].trim(), cross: m[2].trim() } : { main: name, cross: null }
}

function displayLabel(label) {
  if (/^Zone \d+$/.test(label || '')) return `Nearby · ${label}`
  return label
}

const LEVEL_RANK = { low: 0, medium: 1, high: 2, unknown: 3 }

function levelToTone(level) {
  if (level === 'high') return 'occupied'
  if (level === 'medium') return 'caution'
  if (level === 'low') return 'available'
  return 'unknown'
}

function SourcePills({ manifest }) {
  const [ageSec, setAgeSec] = useState(() =>
    manifest?.generated_at
      ? Math.round((Date.now() - new Date(manifest.generated_at)) / 1000)
      : 0
  )
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!manifest?.generated_at) return
    const tick = () =>
      setAgeSec(Math.round((Date.now() - new Date(manifest.generated_at)) / 1000))
    tick()
    intervalRef.current = setInterval(tick, 10_000)
    return () => clearInterval(intervalRef.current)
  }, [manifest?.generated_at])

  if (!manifest) return null

  const activeCount = manifest.events?.active_count ?? 0

  const pills = [
    { key: 'sensors', label: `Live bays · ${ageSec}s ago` },
    { key: 'traffic_profile', label: 'SCATS · historical' },
    { key: 'events', label: `Events · ${activeCount} active` },
  ]
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {pills.map((p) => (
        <span
          key={p.key}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-600 dark:bg-gray-700/60 dark:text-gray-300"
        >
          <span className="h-1 w-1 rounded-full bg-emerald-500" aria-hidden />
          {p.label}
        </span>
      ))}
    </div>
  )
}


function AlternativeRow({ alt, onClick, colorBlindMode, selected = false, mobileSheet = false }) {
  const tone = levelToTone(alt.level)
  const dot = getStatusFillColor(tone, colorBlindMode)
  const pct = Math.round((alt.pressure || 0) * 100)
  const chance = CHANCE_TEXT[alt.level] || 'No live estimate'
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick?.(alt)}
        aria-label={`${alt.label || `Zone ${alt.zone_id}`} — ${chance}, ${alt.free_bays} bays free, ${alt.walk_distance_m}m away`}
        className={`flex w-full items-center gap-2 rounded-lg border px-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer ${
          mobileSheet ? 'min-h-[52px] py-2' : 'py-1.5'
        } ${
          selected
            ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 dark:border-emerald-600 dark:bg-emerald-950/40 dark:ring-emerald-900'
            : 'border-gray-200/70 bg-white hover:bg-slate-50 dark:border-gray-600 dark:bg-surface-dark dark:hover:bg-surface-dark-secondary'
        }`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {(() => {
            const { main, cross } = splitStreetName(displayLabel(alt.label || `Zone ${alt.zone_id}`))
            return (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">{main}</span>
                  {selected && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" aria-hidden>
                      Selected
                    </span>
                  )}
                </div>
                {cross && (
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{cross}</div>
                )}
              </>
            )
          })()}
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            <span>{chance} · {alt.free_bays} bays free</span>
            <span className="shrink-0">{alt.walk_distance_m} m away</span>
          </div>
        </div>
      </button>
    </li>
  )
}

function QuietStreetChip({ seg, onClick, selected = false, featured = false, mobileSheet = false }) {
  const chance = CHANCE_TEXT[seg.level] || 'No live estimate'
  const hasLiveBays = seg.has_live_bays !== false
  const coverage = !hasLiveBays ? 'No live bay coverage' : seg.total < 4 ? 'Limited live data' : 'Live bays'
  const trendReason = seg.trend === 'up' ? 'pressure rising' : seg.trend === 'down' ? 'pressure falling' : 'pressure steady'
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (seg.mid_lat == null || seg.mid_lon == null) return
          onClick?.({ ...seg, lat: seg.mid_lat, lng: seg.mid_lon })
        }}
        aria-label={`${seg.street_name} — ${chance}, ${coverage}`}
        className={`flex w-full items-start gap-2 rounded-lg border px-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer ${
          mobileSheet ? 'min-h-[52px] py-2' : 'py-1.5'
        } ${
          selected
            ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 dark:border-emerald-600 dark:bg-emerald-950/40 dark:ring-emerald-900'
            : 'border-gray-200/70 bg-white hover:bg-slate-50 dark:border-gray-600 dark:bg-surface-dark dark:hover:bg-surface-dark-secondary'
        }`}
      >
        <div className="min-w-0 flex-1">
          {(() => {
            const { main, cross } = splitStreetName(seg.street_name)
            return (
              <>
                <div className={`flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100 leading-tight ${featured ? 'text-sm' : 'text-xs'}`}>
                  {main}
                  {selected && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Selected</span>
                  )}
                </div>
                {cross && (
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{cross}</div>
                )}
              </>
            )
          })()}
          <div className={`mt-0.5 text-gray-500 dark:text-gray-400 ${featured ? 'text-xs' : 'text-[11px]'}`}>
            {[
              chance,
              hasLiveBays ? `${seg.free}/${seg.total} bays free` : null,
              seg.walk_distance_m != null ? `${seg.walk_distance_m} m away` : null,
              coverage,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </button>
    </li>
  )
}

export default function BusyNowPanel({
  manifest,
  status,
  destination,
  onAlternativeClick,
  colorBlindMode = false,
  quietStreets = [],
  onStreetClick,
  selectedSuggestion = null,
  pressureModeNote = 'Parking chance: live now',
  isPlanning = false,
  mobileSheet = false,
}) {
  const [altData, setAltData] = useState(null)
  const [altError, setAltError] = useState(null)
  const [altLoading, setAltLoading] = useState(false)
  const [altRetryKey, setAltRetryKey] = useState(0)
  const [showSources, setShowSources] = useState(false)

  useEffect(() => {
    if (!destination?.lat || !destination?.lng) {
      setAltData(null)
      setAltError(null)
      setAltLoading(false)
      return
    }
    const ctrl = new AbortController()
    setAltLoading(true)
    setAltError(null)
    fetchAlternatives({ lat: destination.lat, lon: destination.lng, signal: ctrl.signal })
      .then((d) => {
        setAltData(d)
        setAltError(null)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setAltError(e)
          setAltData(null)
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setAltLoading(false)
      })
    return () => ctrl.abort()
  }, [destination?.lat, destination?.lng, altRetryKey])

  const isReady = status === 'ready'
  const inDestMode = !!destination?.lat && !!destination?.lng
  const targetIsBusy = altData?.target_zone
    ? ['high', 'medium'].includes(altData.target_zone.level)
    : false
  const selectedZoneId = selectedSuggestion?.source === 'alternative'
    ? selectedSuggestion.zoneId
    : null
  const selectedSegmentId = selectedSuggestion?.source === 'quiet-street'
    ? selectedSuggestion.segmentId
    : null
  const betterAlternatives = (() => {
    if (!targetIsBusy) return []
    const target = altData?.target_zone
    const targetRank = LEVEL_RANK[target?.level] ?? 3
    const targetPressure = Number(target?.pressure ?? 1)
    return (Array.isArray(altData?.alternatives) ? altData.alternatives : [])
      .filter((alt) => {
        const rank = LEVEL_RANK[alt.level] ?? 3
        const pressure = Number(alt.pressure ?? 1)
        return rank < targetRank || pressure < targetPressure
      })
      .sort((a, b) => {
        const rankDiff = (LEVEL_RANK[a.level] ?? 3) - (LEVEL_RANK[b.level] ?? 3)
        if (rankDiff !== 0) return rankDiff
        const pressureDiff = Number(a.pressure ?? 1) - Number(b.pressure ?? 1)
        if (pressureDiff !== 0) return pressureDiff
        return Number(a.walk_distance_m ?? 9999) - Number(b.walk_distance_m ?? 9999)
      })
      .slice(0, 3)
  })()
  return (
    <div className={mobileSheet
      ? 'w-full rounded-xl bg-transparent'
      : 'w-[280px] rounded-xl border border-gray-200/60 bg-white/95 p-2.5 shadow-card backdrop-blur-sm dark:border-gray-700 dark:bg-surface-dark-secondary/95'
    }>
      {!mobileSheet && (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {inDestMode ? 'Around your destination' : 'Parking chance'}
          </span>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {status === 'loading' ? 'loading...' : status === 'error' ? 'error' : 'live'}
          </span>
        </div>
      )}
      <div className={`mb-1.5 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isPlanning
          ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
          : 'bg-slate-100 text-gray-600 dark:bg-gray-700/70 dark:text-gray-200'
      }`}>
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${isPlanning ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse-dot'}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">
          {isPlanning ? pressureModeNote.replace('Parking chance: live now · ', '') : 'Live'}
        </span>
      </div>

      {!isReady && status === 'loading' && (
        <div className="px-1 py-2 text-[11px] text-gray-500 dark:text-gray-400">
          Loading parking chance data...
        </div>
      )}
      {status === 'error' && (
        <div className="px-1 py-2 text-[11px] text-rose-600 dark:text-rose-400">
          Could not load pressure data.
        </div>
      )}

      {isReady && !inDestMode && quietStreets.length === 0 && (
        <div className="px-1 py-1.5 text-[11px] text-gray-600 dark:text-gray-300">
          Pick a destination to compare nearby parking streets. Green = good chance, amber = getting busy, red = hard to park.
        </div>
      )}

      {isReady && !inDestMode && quietStreets.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Better parking options
          </div>
          <ul className="flex flex-col gap-1.5">
            {quietStreets.map((seg, index) => (
              <QuietStreetChip
                key={seg.segment_id}
                seg={seg}
                onClick={onStreetClick}
                selected={selectedSegmentId != null && String(selectedSegmentId) === String(seg.segment_id)}
                featured={mobileSheet && index === 0}
                mobileSheet={mobileSheet}
              />
            ))}
          </ul>
        </div>
      )}

      {isReady && inDestMode && (
        <>
          {altLoading && (
            <div className="px-1 py-2 text-[11px] text-gray-500 dark:text-gray-400">
              Loading alternatives...
            </div>
          )}
          {altError && !altLoading && (
            <div className="mt-1 flex flex-col gap-1 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2 py-1.5 dark:border-rose-800/50 dark:bg-rose-950/30">
              <div className="text-[10px] text-rose-700 dark:text-rose-300">
                Alternatives unavailable. Check connection and try again.
              </div>
              <button
                type="button"
                onClick={() => setAltRetryKey((k) => k + 1)}
                className="self-start rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-800 hover:bg-rose-50 dark:border-rose-600 dark:bg-surface-dark dark:text-rose-200 dark:hover:bg-surface-dark-secondary"
              >
                Retry
              </button>
            </div>
          )}
          {altData && !altLoading && (
            <>
              {altData?.fallback_mode === 'segment_pressure' && (
                <div className="mb-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                  Alternatives using live street model fallback.
                </div>
              )}
              {altData.target_zone && (
                <p className="mb-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {`Destination: ${splitStreetName(altData.target_zone.label).main} · ${CHANCE_TEXT[altData.target_zone.level] || 'No live estimate'} · ${altData.target_zone.free_bays}/${altData.target_zone.total_bays} bays free`}
                </p>
              )}
              {targetIsBusy && betterAlternatives.length > 0 ? (
                <>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Better nearby options
                  </div>
                  <ul className="flex flex-col gap-1 max-h-[180px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {betterAlternatives.map((alt) => (
                      <AlternativeRow
                        key={alt.zone_id}
                        alt={alt}
                        onClick={onAlternativeClick}
                        colorBlindMode={colorBlindMode}
                        selected={selectedZoneId != null && String(selectedZoneId) === String(alt.zone_id)}
                        mobileSheet={mobileSheet}
                      />
                    ))}
                  </ul>
                </>
              ) : targetIsBusy ? (
                <div className="px-1 py-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  No better parking options within 800 m.
                </div>
              ) : (
                <div className="px-1 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  Destination area looks okay. Alternatives appear when this area gets busy.
                </div>
              )}
            </>
          )}
        </>
      )}

      {manifest && (
        <div className="mt-2 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">
          <button
            type="button"
            onClick={() => setShowSources((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-1 rounded"
          >
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-300 text-[9px] font-bold dark:border-gray-600" aria-hidden>i</span>
            Data sources
            <span aria-hidden className="ml-0.5 text-gray-300">{showSources ? '↑' : '↓'}</span>
          </button>
          {showSources && <SourcePills manifest={manifest} />}
        </div>
      )}
    </div>
  )
}
