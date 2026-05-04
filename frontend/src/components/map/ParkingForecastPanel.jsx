/**
 * ParkingForecastPanel.jsx
 * ========================
 * Epic 6 -- Predictive Parking Intelligence UI panel.
 *
 * Shows under the search bar on the map.
 *
 * US 6.1 -- Zone warning banner: colour-coded by worst level,
 *           expandable to show all zones and their predicted occupancy.
 *
 * US 6.2 -- Alternative zone cards: shown when a destination is set
 *           and the target zone has moderate/high/critical pressure.
 *
 * Props:
 *   zoneWarnings   {array}    -- from useParkingForecast().zoneWarnings
 *   worstLevel     {string}   -- 'low' | 'moderate' | 'high' | 'critical'
 *   alternatives   {object}   -- { target_zone, alternatives[] } or null
 *   loading        {boolean}
 *   onZoneClick    {function} -- (zone) => flyTo zone centre
 *   isMobile       {boolean}
 */

import { useState, useMemo } from 'react'

const LEVEL_CONFIG = {
  low:      { bar: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-900/30',   border: 'border-green-200 dark:border-green-700',  text: 'text-green-800 dark:text-green-200',  dot: 'bg-green-500',  label: 'Good availability' },
  moderate: { bar: 'bg-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/30',   border: 'border-amber-200 dark:border-amber-700',  text: 'text-amber-800 dark:text-amber-200',  dot: 'bg-amber-400',  label: 'Filling up' },
  high:     { bar: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-200', dot: 'bg-orange-500', label: 'High demand' },
  critical: { bar: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-900/30',       border: 'border-red-200 dark:border-red-700',      text: 'text-red-800 dark:text-red-200',      dot: 'bg-red-500',    label: 'Very busy — plan ahead' },
}

const LEVEL_ORDER = { low: 0, moderate: 1, high: 2, critical: 3 }

const HOUR_CHIPS = [
  { value: 0, label: 'Now' },
  { value: 1, label: '1h' },
  { value: 2, label: '2h' },
  { value: 3, label: '3h' },
  { value: 4, label: '4h' },
  { value: 5, label: '5h' },
  { value: 6, label: '6h' },
]

function WarningDot({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.low
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} aria-hidden />
}

function OccBar({ pct, level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.low
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  )
}

function ZoneRow({ zone, onClick }) {
  const lvl = zone.warning_level || 'low'
  const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.low
  const pct = zone.predicted_occupancy || 0

  return (
    <button
      type="button"
      onClick={() => onClick?.({ ...zone, centroid_lat: zone.zone_lat, centroid_lon: zone.zone_lon })}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/60 dark:hover:bg-gray-800"
    >
      <WarningDot level={lvl} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
        {zone.zone}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16">
          <OccBar pct={pct} level={lvl} />
        </div>
        <span className={`w-8 text-right text-[10px] font-bold ${cfg.text}`}>
          {Math.round(pct * 100)}%
        </span>
      </div>
    </button>
  )
}

function AlternativeCard({ alt, onClick }) {
  const lvl = alt.pressure_level || 'low'
  const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.low
  const pct = alt.predicted_occ || 0

  return (
    <button
      type="button"
      onClick={() => onClick?.({ centroid_lat: alt.zone_lat, centroid_lon: alt.zone_lon, label: alt.zone })}
      className="flex w-full items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      <WarningDot level={lvl} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">{alt.zone}</div>
        <OccBar pct={pct} level={lvl} />
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-[10px] font-bold ${cfg.text}`}>{Math.round(pct * 100)}% busy</div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400">~{alt.walk_minutes} min walk</div>
      </div>
    </button>
  )
}

export default function ParkingForecastPanel({
  zoneWarnings = [],
  warnings = [],
  worstLevel = 'low',
  alternatives = null,
  loading = false,
  onZoneClick,
  isMobile = false,
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectedHour, setSelectedHour] = useState(0)

  // Filter warnings for selected hour and recompute zone list
  const filteredZoneWarnings = useMemo(() => {
    const source = selectedHour === 0 ? zoneWarnings : (() => {
      const byZone = {}
      for (const w of warnings) {
        if (w.hours_from_now !== selectedHour) continue
        const prev = byZone[w.zone]
        if (!prev || (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[prev.warning_level] || 0)) {
          byZone[w.zone] = w
        }
      }
      return Object.values(byZone).sort(
        (a, b) => (LEVEL_ORDER[b.warning_level] || 0) - (LEVEL_ORDER[a.warning_level] || 0)
      )
    })()
    return source
  }, [selectedHour, zoneWarnings, warnings])

  const filteredWorstLevel = useMemo(() => {
    if (!filteredZoneWarnings.length) return 'low'
    return filteredZoneWarnings.reduce((best, w) => {
      return (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[best] || 0) ? w.warning_level : best
    }, 'low')
  }, [filteredZoneWarnings])

  const displayWorst = selectedHour === 0 ? worstLevel : filteredWorstLevel
  const worstCfg = LEVEL_CONFIG[displayWorst] || LEVEL_CONFIG.low

  const hasWarnings = filteredZoneWarnings.length > 0
  const hasAlternatives = alternatives?.alternatives?.length > 0
  const hasTarget = alternatives?.target_zone != null
  const showAltSection = hasTarget && (
    LEVEL_ORDER[alternatives?.target_zone?.pressure_level] >= LEVEL_ORDER['moderate'] || hasAlternatives
  )

  if (!hasWarnings && !hasAlternatives && !loading) return null

  const chipBase = 'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer'
  const chipActive = `${worstCfg.dot.replace('bg-', 'bg-')} text-white`

  return (
    <div
      className={`rounded-xl border shadow-card-lg backdrop-blur-sm ${worstCfg.bg} ${worstCfg.border} pointer-events-auto ${isMobile ? 'text-[11px]' : 'text-xs'}`}
      role="region"
      aria-label="Parking forecast panel"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <WarningDot level={displayWorst} />
        <span className={`flex-1 text-xs font-semibold ${worstCfg.text}`}>
          {loading
            ? 'Updating forecast...'
            : displayWorst === 'low'
            ? `Good parking availability${selectedHour > 0 ? ` in ${selectedHour}h` : ' predicted'}`
            : `${worstCfg.label}${selectedHour > 0 ? ` in ${selectedHour}h` : ' predicted in CBD'}`}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''} ${worstCfg.text}`} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-200/60 px-2 pb-2 pt-1.5 dark:border-gray-700/50">

          {/* Hour chips */}
          <div className="mb-2 flex items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {HOUR_CHIPS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedHour(value)}
                className={`shrink-0 ${chipBase} ${
                  selectedHour === value
                    ? `${worstCfg.dot} text-white shadow-sm`
                    : 'bg-white/60 text-gray-600 hover:bg-white dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Zone warnings */}
          {hasWarnings && (
            <div className="mb-2">
              <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Zone forecast{selectedHour === 0 ? ' · now' : ` · in ${selectedHour}h`}
              </div>
              <div className="flex flex-col">
                {filteredZoneWarnings.map((z) => (
                  <ZoneRow key={z.zone} zone={z} onClick={onZoneClick} />
                ))}
              </div>
            </div>
          )}

          {/* Event warning */}
          {filteredZoneWarnings.some((z) => z.event_risk_level === 'high' || z.event_risk_level === 'medium') && (
            <div className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 dark:bg-amber-900/25">
              <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                Event activity detected nearby — expect higher demand
              </div>
            </div>
          )}

          {/* Alternatives */}
          {showAltSection && (
            <div>
              <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Try instead
              </div>
              {hasTarget && (
                <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1 dark:bg-gray-900/30">
                  <WarningDot level={alternatives.target_zone.pressure_level || 'low'} />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-gray-700 dark:text-gray-300">
                    Your destination zone ({alternatives.target_zone.zone}):{' '}
                    <span className="font-semibold">{Math.round((alternatives.target_zone.predicted_occ || 0) * 100)}% busy</span>
                  </span>
                </div>
              )}
              {hasAlternatives ? (
                <div className="flex flex-col gap-1">
                  {alternatives.alternatives.map((alt) => (
                    <AlternativeCard key={alt.zone} alt={alt} onClick={onZoneClick} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-white/60 px-2 py-1.5 text-[10px] text-gray-600 dark:bg-gray-900/30 dark:text-gray-400">
                  No quieter alternatives found within walking distance.
                </div>
              )}
            </div>
          )}

          <div className="mt-1.5 px-1 text-[9px] text-gray-400 dark:text-gray-500">
            Based on historical SCATS traffic patterns + event data
          </div>
        </div>
      )}
    </div>
  )
}