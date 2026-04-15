import { useState, useEffect } from 'react'
import { BAY_COLORS } from '../../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../../utils/mapGeo'
import { cn } from '../../utils/cn'
import { fetchBayEvaluation } from '../../services/apiBays'
import VerdictCard from './VerdictCard'
import TimelineStrip from './TimelineStrip'

export default function BayDetailSheet({
  bay,
  destination,
  onClose,
  isMobile,
  lastUpdated,
  reserveBottomPx = 280,
}) {
  const [evaluation, setEvaluation] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)

  // Fetch real evaluation from backend whenever the selected bay changes.
  // The backend tries DB first, then external API cache, then returns "unknown".
  useEffect(() => {
    if (!bay?.id) {
      setEvaluation(null)
      return
    }
    let cancelled = false
    setEvalLoading(true)
    setEvaluation(null)
    fetchBayEvaluation(bay.id).then((data) => {
      if (!cancelled) {
        setEvaluation(data)
        setEvalLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [bay?.id])

  if (!bay) return null

  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available

  // Header badge reflects sensor occupancy (real data from CoM sensor API)
  let badgeLabel = 'Occupied'
  if (bay.type === 'available') badgeLabel = 'Available'
  else if (bay.type === 'trap') badgeLabel = 'Restricted'

  // Bay display name — real street name from CoM API, or honest fallback
  const bayDisplayName = bay.name || 'Unnamed Bay'

  // Walking distance (only shown when user has selected a destination)
  let walkStr = null
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    walkStr = `${m} m from ${destination.name} \u2013 ${walkingMinutesFromMeters(m)} min walk`
  }

  // Spot dot colour based on live sensor data
  const spotDotColor = bay.free === 0 ? 'bg-danger' : 'bg-accent'

  const feedUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const sensorStr = bay.sensorLastUpdated
    ? (() => {
        try {
          const d = new Date(bay.sensorLastUpdated)
          if (Number.isNaN(d.getTime())) return String(bay.sensorLastUpdated)
          return d.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'medium' })
        } catch {
          return String(bay.sensorLastUpdated)
        }
      })()
    : null

  // limitType label: prefer backend restriction typedesc, then raw bayType, then dash
  const limitTypeLabel =
    (evaluation?.active_restriction?.typedesc) ||
    (bay.bayType !== 'Other' ? bay.bayType : null) ||
    '\u2014'

  // Backend warning description (only from real evaluation — no local guessing)
  const backendWarn = evaluation?.warning?.description ?? null

  // Data source transparency note
  const dataSource = evaluation?.data_source ?? null
  const showApiNote = dataSource === 'api_fallback'

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-surface-dark overflow-y-auto overscroll-contain',
        isMobile
          ? 'fixed top-16 inset-x-0 bottom-0 z-[2000]'
          : 'absolute right-0 top-0 w-[380px] max-w-[min(420px,44vw)] shadow-[-8px_0_40px_rgba(0,0,0,0.12)] z-[560]',
      )}
      style={!isMobile ? { bottom: reserveBottomPx } : undefined}
      role="dialog"
      aria-label={`Bay ${bayDisplayName} details`}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="sticky top-0 self-end mt-3.5 mr-3.5 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-none cursor-pointer flex items-center justify-center text-base text-gray-500 dark:text-gray-400 z-[3] shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        &times;
      </button>

      {/* Primary answer first — "Can I park here?" */}
      <div className="px-5 pb-4 shrink-0 -mt-2">
        <VerdictCard bay={bay} evaluation={evaluation} evaluationPending={evalLoading} />
      </div>

      {/* Location & feed context */}
      <div className="px-5 pb-4 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: cols.border }}
            >
              {badgeLabel}
            </div>
            <div className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-1">
              {bayDisplayName}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Bay #{bay.id}
              {walkStr && <span> \u2013 {walkStr}</span>}
            </div>
          </div>
          {feedUpdatedStr && (
            <div className="text-[11px] font-semibold text-brand-dark dark:text-brand-light bg-brand-50 dark:bg-brand-900/40 border border-brand/25 rounded-full px-3 py-1.5 whitespace-nowrap self-start">
              Updated {feedUpdatedStr}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-7 flex-1">
        {/* Sensor occupancy row — 1 bay sensor, real data */}
        <div className="flex items-center gap-2.5 bg-surface-secondary rounded-xl px-3.5 py-3 mb-4">
          <div className={cn('w-3 h-3 rounded-full shrink-0', spotDotColor)} />
          <span className="text-sm font-bold text-gray-900">
            {bay.free === 1 ? 'Bay unoccupied' : bay.free === 0 ? 'Bay occupied' : 'Occupancy unknown'}
          </span>
          <span className="text-xs text-gray-500 ml-auto">{limitTypeLabel}</span>
        </div>

        {/* Sensor timestamp */}
        {sensorStr ? (
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3.5 px-3 py-2 bg-surface-tertiary dark:bg-surface-dark-tertiary rounded-lg">
            Sensor last reported: {sensorStr}
          </div>
        ) : (
          <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-3.5 px-3 py-2 bg-surface-tertiary dark:bg-surface-dark-tertiary rounded-lg italic">
            Live occupancy data unavailable
          </div>
        )}

        {/* No restriction data notice */}
        {!evalLoading && !bay.hasRules && (
          <div className="mb-3.5 px-3.5 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none mt-0.5">🔍</span>
              <div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  No restriction data for this bay
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
                  This bay has live sensor data (occupied/vacant) but the City of Melbourne
                  restrictions dataset does not cover it. Always check the posted street signage.
                </p>
                <p className="text-[11px] text-[#35338c] dark:text-[#a3a1e6] font-semibold">
                  Tip: Look for bays with a purple ring on the map — they have full rule info.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data source transparency note */}
        {!evalLoading && showApiNote && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 text-[11px] text-blue-700 dark:text-blue-300">
            Rule data sourced from City of Melbourne external API (no detailed time schedule available).
          </div>
        )}

        {/* Warning — only from backend evaluation, never locally inferred */}
        {backendWarn && (
          <div className="mt-3.5 px-3.5 py-2.5 bg-trap-50 dark:bg-trap-500/10 border border-trap-200 dark:border-trap-400/30 rounded-xl text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
            &#9888; {backendWarn}
          </div>
        )}

        {/* Timeline — only backend restriction data; no fake schedules */}
        <TimelineStrip
          activeRestriction={evalLoading ? null : evaluation?.active_restriction ?? null}
          verdict={evaluation?.verdict ?? null}
          sensorFree={bay.free}
        />
      </div>
    </div>
  )
}
