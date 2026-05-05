/**
 * ParkingForecastPanel.jsx
 * ========================
 * Epic 6 -- Predictive Parking Intelligence UI panel.
 *
 * Props:
 *   zoneWarnings   {array}    -- from useParkingForecast().zoneWarnings
 *   warnings       {array}    -- raw warnings for sparklines + hourly filter
 *   worstLevel     {string}   -- 'low' | 'moderate' | 'high' | 'critical'
 *   alternatives   {object}   -- { target_zone, alternatives[] } or null
 *   loading        {boolean}
 *   onZoneClick    {function} -- (zone) => flyTo zone centre
 *   isMobile       {boolean}
 */

import { useState, useMemo, useEffect } from 'react'

const LEVEL_CONFIG = {
  low:      { bar: 'bg-emerald-500', bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20',   border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500', glow: '#10b981', label: 'Good availability', emoji: '🟢' },
  moderate: { bar: 'bg-amber-400',   bg: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20',    border: 'border-amber-200 dark:border-amber-700',   text: 'text-amber-800 dark:text-amber-200',   dot: 'bg-amber-400',   glow: '#f59e0b', label: 'Filling up',       emoji: '🟡' },
  high:     { bar: 'bg-orange-500',  bg: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/20',        border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-200', dot: 'bg-orange-500',  glow: '#f97316', label: 'High demand',      emoji: '🟠' },
  critical: { bar: 'bg-red-500',     bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20',            border: 'border-red-200 dark:border-red-700',       text: 'text-red-800 dark:text-red-200',       dot: 'bg-red-500',     glow: '#ef4444', label: 'Very busy',        emoji: '🔴' },
}

const LEVEL_ORDER = { low: 0, moderate: 1, high: 2, critical: 3 }

const HOUR_CHIPS = [
  { value: 0, label: 'Now' },
  { value: 1, label: '+1h' },
  { value: 2, label: '+2h' },
  { value: 3, label: '+3h' },
  { value: 4, label: '+4h' },
  { value: 5, label: '+5h' },
  { value: 6, label: '+6h' },
]

function ParkingMeter({ pct, level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.low
  const carPos = Math.min(Math.max(pct * 100, 5), 88)
  return (
    <div className="relative w-full h-7 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 mt-0.5">
      <div className="absolute inset-0 flex items-center px-1 gap-1">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-px flex-1 bg-gray-300/70 dark:bg-gray-600/60 rounded-full" />
        ))}
      </div>
      <div className={`absolute left-0 top-0 h-full ${cfg.bar} opacity-15 rounded-lg transition-all duration-1000`} style={{ width: `${Math.round(pct * 100)}%` }} />
      <div className="absolute top-1/2 transition-all duration-1000 ease-in-out" style={{ left: `${carPos}%`, transform: 'translateX(-50%) translateY(-50%)' }}>
        <svg width="26" height="14" viewBox="0 0 28 16" fill="none">
          <rect x="2" y="6" width="24" height="8" rx="2" fill={cfg.glow} />
          <path d="M6 6 L9 2 L19 2 L22 6" fill={cfg.glow} opacity="0.8" />
          <circle cx="7"  cy="14" r="2.5" fill="#1f2937" />
          <circle cx="7"  cy="14" r="1.2" fill="#9ca3af" />
          <circle cx="21" cy="14" r="2.5" fill="#1f2937" />
          <circle cx="21" cy="14" r="1.2" fill="#9ca3af" />
          <rect x="9"  y="3" width="4" height="3" rx="0.5" fill="#bfdbfe" opacity="0.9" />
          <rect x="15" y="3" width="4" height="3" rx="0.5" fill="#bfdbfe" opacity="0.9" />
          <rect x="22" y="8" width="3" height="2" rx="0.5" fill="#fde68a" opacity="0.9" />
        </svg>
      </div>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
        <span className="text-white text-[7px] font-black leading-none">P</span>
      </div>
    </div>
  )
}

function ZoneSparkline({ zoneData, selectedHour }) {
  if (!zoneData || zoneData.length < 2) return null
  const max = Math.max(...zoneData.map(d => d.predicted_occupancy), 0.1)
  const W = 60, H = 18
  const points = zoneData.map((d, i) => `${(i / (zoneData.length - 1)) * W},${H - (d.predicted_occupancy / max) * (H - 2)}`).join(' ')
  const selIdx = zoneData.findIndex(d => d.hours_from_now === selectedHour)
  const selPt = selIdx >= 0 ? { x: (selIdx / (zoneData.length - 1)) * W, y: H - (zoneData[selIdx].predicted_occupancy / max) * (H - 2) } : null
  const cfg = LEVEL_CONFIG[zoneData[selIdx >= 0 ? selIdx : 0]?.warning_level || 'low'] || LEVEL_CONFIG.low
  return (
    <svg width={W + 2} height={H} viewBox={`0 0 ${W + 2} ${H}`} className="shrink-0">
      <polyline points={points} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {selPt && (<><circle cx={selPt.x} cy={selPt.y} r="3" fill={cfg.glow} /><circle cx={selPt.x} cy={selPt.y} r="1.5" fill="white" /></>)}
    </svg>
  )
}

function ZoneRow({ zone, allWarnings, selectedHour, onClick, index }) {
  const lvl = zone.warning_level || 'low'
  const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.low
  const pct = zone.predicted_occupancy || 0
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 80); return () => clearTimeout(t) }, [index])
  const sparkData = useMemo(() => (allWarnings || []).filter(w => w.zone === zone.zone).sort((a, b) => a.hours_from_now - b.hours_from_now), [allWarnings, zone.zone])
  return (
    <button type="button" onClick={() => onClick?.({ ...zone, centroid_lat: zone.zone_lat, centroid_lon: zone.zone_lon })}
      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-300 hover:bg-white/70 dark:hover:bg-gray-800/70 hover:shadow-sm group ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}>
      <div className={`w-1 h-10 rounded-full ${cfg.bar} shrink-0 transition-transform duration-200 group-hover:scale-y-110`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{zone.zone}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bar} text-white shrink-0`}>{Math.round(pct * 100)}%</span>
        </div>
        <ParkingMeter pct={pct} level={lvl} />
      </div>
      {sparkData.length > 1 && <div className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"><ZoneSparkline zoneData={sparkData} selectedHour={selectedHour} /></div>}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${cfg.text} opacity-0 group-hover:opacity-100 transition-opacity`} aria-hidden><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
    </button>
  )
}

function AlternativeCard({ alt, onClick, index }) {
  const lvl = alt.pressure_level || 'low'
  const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.low
  const pct = alt.predicted_occ || 0
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 200 + index * 100); return () => clearTimeout(t) }, [index])
  return (
    <button type="button" onClick={() => onClick?.({ centroid_lat: alt.zone_lat, centroid_lon: alt.zone_lon, label: alt.zone })}
      className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-400 hover:shadow-md group ${cfg.border} bg-white/60 dark:bg-gray-900/40 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className={`w-1 h-10 rounded-full ${cfg.bar} shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{alt.zone}</span>
          <span className="text-[9px] text-gray-500 dark:text-gray-400 shrink-0">~{alt.walk_minutes} min walk</span>
        </div>
        <ParkingMeter pct={pct} level={lvl} />
      </div>
      <span className={`text-[10px] font-black ${cfg.text} shrink-0`}>{Math.round(pct * 100)}%</span>
    </button>
  )
}

function LiveDot({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.low
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-50`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
    </span>
  )
}

export default function ParkingForecastPanel({
  zoneWarnings = [], warnings = [], worstLevel = 'low',
  alternatives = null, loading = false, onZoneClick, isMobile = false,
}) {
  const [expanded, setExpanded] = useState(false)
  const [selectedHour, setSelectedHour] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])

  const filteredZoneWarnings = useMemo(() => {
    if (selectedHour === 0) return zoneWarnings
    const byZone = {}
    for (const w of warnings) {
      if (w.hours_from_now !== selectedHour) continue
      const prev = byZone[w.zone]
      if (!prev || (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[prev.warning_level] || 0)) byZone[w.zone] = w
    }
    return Object.values(byZone).sort((a, b) => (LEVEL_ORDER[b.warning_level] || 0) - (LEVEL_ORDER[a.warning_level] || 0))
  }, [selectedHour, zoneWarnings, warnings])

  const displayWorst = useMemo(() => {
    if (selectedHour === 0) return worstLevel
    if (!filteredZoneWarnings.length) return 'low'
    return filteredZoneWarnings.reduce((best, w) => (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[best] || 0) ? w.warning_level : best, 'low')
  }, [selectedHour, worstLevel, filteredZoneWarnings])

  const worstCfg = LEVEL_CONFIG[displayWorst] || LEVEL_CONFIG.low
  const hasWarnings = filteredZoneWarnings.length > 0
  const hasAlternatives = alternatives?.alternatives?.length > 0
  const hasTarget = alternatives?.target_zone != null
  const showAltSection = hasTarget && (LEVEL_ORDER[alternatives?.target_zone?.pressure_level] >= LEVEL_ORDER['moderate'] || hasAlternatives)

  if (!hasWarnings && !hasAlternatives && !loading) return null

  return (
    <div className={`rounded-2xl border shadow-lg backdrop-blur-md overflow-hidden pointer-events-auto transition-all duration-500 ${worstCfg.bg} ${worstCfg.border} ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'} ${isMobile ? 'text-[11px]' : 'text-xs'}`} role="region" aria-label="Parking forecast panel">
      <div className={`h-0.5 w-full ${worstCfg.bar} overflow-hidden relative`}>
        <div className="absolute inset-0 opacity-70" style={{ background: 'linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)', animation: 'shimmer 2.4s infinite' }} />
      </div>

      <button type="button" onClick={() => setExpanded(v => !v)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left" aria-expanded={expanded}>
        <LiveDot level={displayWorst} />
        <span className={`flex-1 text-[11px] font-bold tracking-wide ${worstCfg.text}`}>
          {loading ? <span className="animate-pulse">Updating forecast…</span>
            : displayWorst === 'low'
              ? `Good parking availability${selectedHour > 0 ? ` in ${selectedHour}h` : ''}`
              : `${worstCfg.label}${selectedHour > 0 ? ` in ${selectedHour}h` : ' · CBD'}`}
        </span>
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${worstCfg.border} ${worstCfg.text} opacity-70`}>6h forecast</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''} ${worstCfg.text}`} aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200/50 dark:border-gray-700/40 px-2.5 pb-3 pt-2">
          <div className="mb-3 flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {HOUR_CHIPS.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setSelectedHour(value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-200 cursor-pointer ${selectedHour === value ? `${worstCfg.bar} text-white shadow-sm scale-105` : 'bg-white/50 text-gray-600 hover:bg-white/80 dark:bg-gray-800/50 dark:text-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mb-1.5 px-1 flex items-center gap-1.5">
            <div className={`h-px flex-1 ${worstCfg.bar} opacity-30`} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{selectedHour === 0 ? 'Live now' : `In ${selectedHour} hour${selectedHour > 1 ? 's' : ''}`}</span>
            <div className={`h-px flex-1 ${worstCfg.bar} opacity-30`} />
          </div>

          {hasWarnings && (
            <div className="flex flex-col gap-0.5 mb-2">
              {filteredZoneWarnings.map((z, i) => (
                <ZoneRow key={`${z.zone}-${selectedHour}`} zone={z} allWarnings={warnings} selectedHour={selectedHour} onClick={onZoneClick} index={i} />
              ))}
            </div>
          )}

          {filteredZoneWarnings.some(z => z.event_risk_level === 'high' || z.event_risk_level === 'medium') && (
            <div className="mb-2 rounded-xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-700 px-2.5 py-1.5 flex items-center gap-2">
              <span className="text-base leading-none">⚠️</span>
              <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">Events detected nearby — expect higher demand</span>
            </div>
          )}

          {showAltSection && (
            <div>
              <div className="mb-1.5 px-1 flex items-center gap-1.5">
                <div className="h-px flex-1 bg-gray-300/50 dark:bg-gray-600/50" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Try instead</span>
                <div className="h-px flex-1 bg-gray-300/50 dark:bg-gray-600/50" />
              </div>
              {hasTarget && (
                <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-white/50 dark:bg-gray-900/30 px-2.5 py-1.5 border border-gray-200/60 dark:border-gray-700/40">
                  <span className="text-sm leading-none">{worstCfg.emoji}</span>
                  <span className="min-w-0 flex-1 text-[10px] text-gray-700 dark:text-gray-300 truncate">
                    Your zone ({alternatives.target_zone.zone}): <span className="font-bold">{Math.round((alternatives.target_zone.predicted_occ || 0) * 100)}% full</span>
                  </span>
                </div>
              )}
              {hasAlternatives
                ? <div className="flex flex-col gap-1">{alternatives.alternatives.map((alt, i) => <AlternativeCard key={alt.zone} alt={alt} onClick={onZoneClick} index={i} />)}</div>
                : <div className="rounded-xl bg-white/50 px-2.5 py-1.5 text-[10px] text-gray-500 dark:bg-gray-900/30 dark:text-gray-400 text-center">No quieter alternatives nearby</div>
              }
            </div>
          )}

          <div className="mt-2 px-1 text-[9px] text-gray-400 dark:text-gray-500 text-center">Powered by SCATS traffic + XGBoost model</div>
        </div>
      )}
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
    </div>
  )
}
