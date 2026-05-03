import { useEffect, useRef, useState } from 'react'
import { fetchAlternatives } from '../../services/apiPressure'
import { getStatusFillColor } from '../map/ParkingMap'

const CHANCE_TEXT = {
  low: 'Good chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  unknown: 'No live estimate',
}

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
    intervalRef.current = setInterval(tick, 1000)
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
    <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">
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

function PressureBar({ pct, color }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700/60">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  )
}

function AlternativeRow({ alt, onClick, colorBlindMode }) {
  const tone = levelToTone(alt.level)
  const dot = getStatusFillColor(tone, colorBlindMode)
  const pct = Math.round((alt.pressure || 0) * 100)
  const chance = CHANCE_TEXT[alt.level] || 'No live estimate'
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick?.(alt)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200/70 bg-white px-2 py-1.5 text-left transition-colors hover:bg-slate-50 dark:border-gray-600 dark:bg-surface-dark dark:hover:bg-surface-dark-secondary"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[12px] font-semibold text-gray-900 dark:text-gray-100">
              Try {alt.label || `Zone ${alt.zone_id}`}
            </span>
            <span className="shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {alt.walk_distance_m} m away
            </span>
          </div>
          <PressureBar pct={pct} color={dot} />
          <div className="mt-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
            {chance} · {alt.free_bays} bays free
          </div>
        </div>
      </button>
    </li>
  )
}

function QuietStreetChip({ seg, onClick }) {
  const chance = CHANCE_TEXT[seg.level] || 'No live estimate'
  const hasLiveBays = seg.has_live_bays !== false
  const coverage = !hasLiveBays ? 'No live bay coverage' : seg.total < 4 ? 'Limited live data' : 'Live bays'
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick?.({ lat: seg.mid_lat, lng: seg.mid_lon })}
        className="flex w-full items-start gap-2 rounded-lg border border-gray-200/70 bg-white px-2 py-1.5 text-left transition-colors hover:bg-slate-50 dark:border-gray-600 dark:bg-surface-dark dark:hover:bg-surface-dark-secondary"
      >
        <div className="min-w-0 flex-1 text-[11px] text-gray-700 dark:text-gray-200">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{seg.street_name}</span>
          {' · '}
          <span>{chance}</span>
          {hasLiveBays && (
            <>
              {' · '}
              <span>{seg.free}/{seg.total} bays free</span>
            </>
          )}
          {' · '}
          <span>{coverage}</span>
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
}) {
  const [altData, setAltData] = useState(null)
  const [altError, setAltError] = useState(null)

  useEffect(() => {
    if (!destination?.lat || !destination?.lng) {
      setAltData(null)
      return
    }
    const ctrl = new AbortController()
    fetchAlternatives({ lat: destination.lat, lon: destination.lng, signal: ctrl.signal })
      .then((d) => setAltData(d))
      .catch((e) => {
        if (e.name !== 'AbortError') setAltError(e)
      })
    return () => ctrl.abort()
  }, [destination?.lat, destination?.lng])

  const isReady = status === 'ready'
  const inDestMode = !!destination?.lat && !!destination?.lng

  return (
    <div className="w-[280px] rounded-xl border border-gray-200/60 bg-white/95 p-2.5 shadow-card backdrop-blur-sm dark:border-gray-700 dark:bg-surface-dark-secondary/95">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {inDestMode ? 'Around your destination' : 'Parking chance'}
        </span>
        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
          {status === 'loading' ? 'loading…' : status === 'error' ? 'error' : 'live'}
        </span>
      </div>

      {!isReady && status === 'loading' && (
        <div className="px-1 py-2 text-[11px] text-gray-500 dark:text-gray-400">
          Loading parking chance data…
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
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Quietest nearby
          </div>
          <ul className="flex flex-col gap-1">
            {quietStreets.map((seg) => (
              <QuietStreetChip
                key={seg.segment_id}
                seg={seg}
                onClick={onStreetClick}
              />
            ))}
          </ul>
        </div>
      )}

      {isReady && inDestMode && altData && (
        <>
          {altData.target_zone && (
            <div className="mb-2 rounded-lg border border-gray-200/70 bg-slate-50 px-2 py-1.5 dark:border-gray-600 dark:bg-surface-dark">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Target area
              </div>
              <div className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">
                {altData.target_zone.label}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-700 dark:text-gray-200">
                {CHANCE_TEXT[altData.target_zone.level] || 'No live estimate'} ·{' '}
                {altData.target_zone.free_bays}/{altData.target_zone.total_bays} bays free
              </div>
              <PressureBar
                pct={Math.round((altData.target_zone.pressure || 0) * 100)}
                color={getStatusFillColor(levelToTone(altData.target_zone.level), colorBlindMode)}
              />
            </div>
          )}
          {altData.alternatives?.length > 0 ? (
            <>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Better nearby options
              </div>
              <ul className="flex flex-col gap-1.5">
                {altData.alternatives.map((alt) => (
                  <AlternativeRow
                    key={alt.zone_id}
                    alt={alt}
                    onClick={onAlternativeClick}
                    colorBlindMode={colorBlindMode}
                  />
                ))}
              </ul>
            </>
          ) : (
            <div className="px-1 py-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              No better parking options within 800 m.
            </div>
          )}
          {altError && (
            <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
              Alternatives unavailable.
            </div>
          )}
        </>
      )}

      <SourcePills manifest={manifest} />
    </div>
  )
}
