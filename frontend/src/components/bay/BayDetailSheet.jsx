import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { BAY_COLORS } from '../../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../../utils/mapGeo'
import { bayHeading, bayMissingStreetNote } from '../../utils/bayLabels'
import { cn } from '../../utils/cn'
import { fetchBayEvaluation } from '../../services/apiBays'
import { useDebouncedPlannerParams } from '../../hooks/useDebouncedPlannerParams'
import {
  formatStayLimitShort,
  formatLeaveByClock,
  formatAtDateTime,
  nextQuarterHourDefaults,
} from '../../utils/plannerTime'
import VerdictCard from './VerdictCard'
import TimelineStrip from './TimelineStrip'

const DURATIONS = [30, 60, 90, 120, 180, 240]

function splitIsoForInputs(iso) {
  if (!iso) return { dateStr: '', timeStr: '' }
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return { dateStr: '', timeStr: '' }
  return { dateStr: m[1], timeStr: `${m[2]}:${m[3]}` }
}

function firstSentence(text) {
  if (!text?.trim()) return ''
  const t = text.trim()
  const match = t.match(/^(.+?[.!?])(\s|$)/)
  return match ? match[1].trim() : t
}

function ClockIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export default function BayDetailSheet({
  bay,
  destination,
  onClose,
  isMobile,
  lastUpdated,
  reserveBottomPx = 280,
  savedPlannerArrivalIso = null,
  savedPlannerDurationMins = null,
  onDebouncedPlannerChange,
  mapBaysAtPlannedTime = false,
  onShowAllBaysAtThisTime,
  onResetPlannerToLive,
  plannerResetNonce = 0,
}) {
  const [evaluation, setEvaluation] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)

  const [checkTimeExpanded, setCheckTimeExpanded] = useState(false)
  const [dateStr, setDateStr] = useState(() =>
    savedPlannerArrivalIso ? splitIsoForInputs(savedPlannerArrivalIso).dateStr : '',
  )
  const [timeStr, setTimeStr] = useState(() =>
    savedPlannerArrivalIso ? splitIsoForInputs(savedPlannerArrivalIso).timeStr : '',
  )
  const [durationMins, setDurationMins] = useState(() =>
    savedPlannerDurationMins != null ? savedPlannerDurationMins : 60,
  )

  const rawPlanner = useMemo(() => {
    if (!dateStr || !timeStr) return null
    return { arrivalIso: `${dateStr}T${timeStr}:00`, durationMins }
  }, [dateStr, timeStr, durationMins])

  const debouncedPlanner = useDebouncedPlannerParams(rawPlanner, 300)

  const plannerActive = Boolean(debouncedPlanner)

  /** Sync MapPage only when debounced value is stable; avoid pushing null on mount while saved plan is still debouncing. */
  useEffect(() => {
    if (debouncedPlanner === null) {
      if (rawPlanner === null) {
        onDebouncedPlannerChange?.(null)
      }
      return
    }
    onDebouncedPlannerChange?.(debouncedPlanner)
  }, [debouncedPlanner, rawPlanner, onDebouncedPlannerChange])

  useEffect(() => {
    if (savedPlannerArrivalIso && savedPlannerDurationMins != null) {
      const s = splitIsoForInputs(savedPlannerArrivalIso)
      setDateStr(s.dateStr)
      setTimeStr(s.timeStr)
      setDurationMins(savedPlannerDurationMins)
    } else {
      setDateStr('')
      setTimeStr('')
      setDurationMins(60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit saved* deps so parent debounce updates do not reset inputs
  }, [bay?.id, plannerResetNonce])

  const fetchOpts = useMemo(() => {
    if (!debouncedPlanner) return null
    return {
      arrivalIso: debouncedPlanner.arrivalIso,
      durationMins: debouncedPlanner.durationMins,
    }
  }, [debouncedPlanner])

  useEffect(() => {
    if (!bay?.id) {
      setEvaluation(null)
      setEvalLoading(false)
      return
    }
    let cancelled = false
    setEvalLoading(true)
    setEvaluation(null)
    fetchBayEvaluation(bay.id, fetchOpts).then((data) => {
      if (!cancelled) {
        setEvaluation(data)
        setEvalLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [bay?.id, fetchOpts, debouncedPlanner])

  useEffect(() => {
    if (!checkTimeExpanded) return
    if (dateStr || timeStr) return
    const d = nextQuarterHourDefaults()
    setDateStr(d.dateStr)
    setTimeStr(d.timeStr)
    setDurationMins(d.durationMins)
  }, [checkTimeExpanded, dateStr, timeStr])

  const plannerSectionRef = useRef(null)

  useEffect(() => {
    if (!checkTimeExpanded) return
    const id = window.setTimeout(() => {
      plannerSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
    return () => window.clearTimeout(id)
  }, [checkTimeExpanded])

  const handleToggleCheckTime = useCallback(() => {
    setCheckTimeExpanded((e) => !e)
  }, [])

  const handleClearPlanner = useCallback(() => {
    setCheckTimeExpanded(false)
    setDateStr('')
    setTimeStr('')
    setDurationMins(60)
    onResetPlannerToLive?.()
  }, [onResetPlannerToLive])

  if (!bay) return null

  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available

  let badgeLabel = 'Occupied'
  if (bay.type === 'available') badgeLabel = 'Available'
  else if (bay.type === 'trap') badgeLabel = 'Restricted'

  const bayDisplayName = bayHeading(bay)
  const missingStreetNote = bayMissingStreetNote(bay)

  let walkStr = null
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    walkStr = `${m} m from ${destination.name} \u2013 ${walkingMinutesFromMeters(m)} min walk`
  }

  const spotDotColor = bay.free === 0 ? 'bg-danger' : 'bg-accent'

  const feedUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
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

  const limitTypeLabel =
    (evaluation?.active_restriction?.typedesc) ||
    (bay.bayType !== 'Other' ? bay.bayType : null) ||
    '\u2013'

  const backendWarn = evaluation?.warning?.description ?? null
  const warnLine = backendWarn ? firstSentence(String(backendWarn)) : null
  const hasRuleInfo = Boolean(bay.hasRules)

  const dataSource = evaluation?.data_source ?? null
  const showApiNote = dataSource === 'api_fallback'

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-surface-dark overflow-y-auto overscroll-contain',
        isMobile
          ? 'fixed inset-x-0 bottom-0 z-[2000] top-[calc(4rem+env(safe-area-inset-top,0px))] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]'
          : 'absolute right-0 top-0 w-[380px] max-w-[min(420px,44vw)] shadow-[-8px_0_40px_rgba(0,0,0,0.12)] z-[560]',
      )}
      style={!isMobile ? { bottom: reserveBottomPx } : undefined}
      role="dialog"
      aria-label={`${bayDisplayName}, parking details`}
    >
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
            {missingStreetNote && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{missingStreetNote}</div>
            )}
            {(bay.name?.trim() || walkStr) && (
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {bay.name?.trim() ? <span>#{bay.id}</span> : null}
                {bay.name?.trim() && walkStr ? <span> · {walkStr}</span> : null}
                {!bay.name?.trim() && walkStr ? <span>{walkStr}</span> : null}
              </div>
            )}
            <div className="mt-2">
              {hasRuleInfo ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#35338c]/30 bg-[#35338c]/5 px-2 py-0.5 text-[10px] font-semibold text-[#35338c] dark:border-[#a3a1e6]/40 dark:bg-[#35338c]/20 dark:text-[#a3a1e6]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#35338c] dark:bg-[#a3a1e6]" />
                  Rules on file
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-300" />
                  Rules not on file
                </span>
              )}
            </div>
          </div>
          {feedUpdatedStr && (
            <div className="text-[11px] font-semibold text-brand-dark dark:text-brand-light bg-brand-50 dark:bg-brand-900/40 border border-brand/25 rounded-full px-3 py-1.5 whitespace-nowrap self-start">
              Updated {feedUpdatedStr}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 pb-7 flex-1">
        <div className="flex items-center gap-2.5 bg-surface-secondary rounded-xl px-3.5 py-2.5 mb-3">
          <div className={cn('w-3 h-3 rounded-full shrink-0', spotDotColor)} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {bay.free === 1 ? 'Space looks free' : bay.free === 0 ? 'Space looks occupied' : 'Occupancy unknown'}
            </div>
            {sensorStr && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Sensor · {sensorStr}
              </div>
            )}
            {!sensorStr && (
              <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 italic">No live sensor time</div>
            )}
          </div>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 text-right max-w-[45%] leading-snug">
            {limitTypeLabel}
          </span>
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

        <TimelineStrip
          activeRestriction={evalLoading ? null : evaluation?.active_restriction ?? null}
          verdict={evaluation?.verdict ?? null}
          sensorFree={bay.free}
        />
      </div>
    </div>
  )
}
