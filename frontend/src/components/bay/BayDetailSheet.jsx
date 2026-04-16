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

  const plannerBackdatedError = useMemo(() => {
    if (!rawPlanner?.arrivalIso) return null
    const t = new Date(rawPlanner.arrivalIso)
    if (Number.isNaN(t.getTime())) return 'Invalid date/time. Please try again.'
    // Give a small buffer so "now" doesn't immediately fail due to seconds drift.
    if (t.getTime() < Date.now() - 30_000) return "That time is in the past. Please choose a future time."
    return null
  }, [rawPlanner])

  const debouncedPlanner = useDebouncedPlannerParams(rawPlanner, 300)

  const plannerActive = Boolean(debouncedPlanner)

  /** Sync MapPage only when debounced value is stable; avoid pushing null on mount while saved plan is still debouncing. */
  useEffect(() => {
    if (plannerBackdatedError) return
    if (debouncedPlanner === null) {
      if (rawPlanner === null) {
        onDebouncedPlannerChange?.(null)
      }
      return
    }
    onDebouncedPlannerChange?.(debouncedPlanner)
  }, [debouncedPlanner, rawPlanner, onDebouncedPlannerChange, plannerBackdatedError])

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
    if (plannerBackdatedError) return null
    if (!debouncedPlanner) return null
    return {
      arrivalIso: debouncedPlanner.arrivalIso,
      durationMins: debouncedPlanner.durationMins,
    }
  }, [debouncedPlanner, plannerBackdatedError])

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

  const atLabel = debouncedPlanner ? formatAtDateTime(debouncedPlanner.arrivalIso) : null

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

      <div
        ref={plannerSectionRef}
        id="bay-arrival-planner"
        className="px-5 pt-2 pb-4 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0 scroll-mt-20"
      >
        <button
          type="button"
          onClick={handleToggleCheckTime}
          className="flex w-full min-h-[40px] items-center justify-between gap-2 rounded-xl border border-gray-200/90 bg-gray-50/80 px-3 py-2 text-left hover:bg-gray-100/80 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          aria-expanded={checkTimeExpanded}
          aria-controls="bay-arrival-planner"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ClockIcon className="shrink-0 text-gray-600 dark:text-gray-400" />
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">Check another time</span>
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className={cn(
              'shrink-0 text-gray-500 transition-transform duration-200',
              checkTimeExpanded && 'rotate-180',
            )}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {checkTimeExpanded && (
          <div className="mt-3 flex flex-col gap-3">
            {!dateStr && !timeStr && (
              <div className="rounded-xl border border-gray-200/90 bg-white/70 px-3.5 py-2.5 text-xs font-semibold text-gray-600 shadow-card dark:border-gray-700/70 dark:bg-surface-dark-secondary/70 dark:text-gray-200">
                Please select a date and time to check the rules.
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Date
              </span>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="rounded-lg border border-gray-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100 min-h-[40px] w-full min-w-0"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Time
              </span>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="rounded-lg border border-gray-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100 min-h-[40px] w-full min-w-0"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-[11rem]">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Stay
              </span>
              <select
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="rounded-lg border border-gray-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100 cursor-pointer min-h-[40px] w-full min-w-0"
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 30
                      ? '30 min'
                      : m === 60
                        ? '1 hr'
                        : m === 90
                          ? '1.5 hr'
                          : m === 120
                            ? '2 hr'
                            : m === 180
                              ? '3 hr'
                              : '4 hr'}
                  </option>
                ))}
              </select>
            </label>
            </div>
          </div>
        )}

        {checkTimeExpanded && plannerBackdatedError && (
          <div className="mt-3 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-xs font-semibold text-danger shadow-card dark:border-danger-400/40 dark:bg-danger-500/10 dark:text-danger-200">
            {plannerBackdatedError}
          </div>
        )}

        {checkTimeExpanded && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/80">
            <button
              type="button"
              onClick={handleClearPlanner}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
            >
              Clear
            </button>
            {debouncedPlanner &&
              !plannerBackdatedError &&
              (!mapBaysAtPlannedTime ? (
                <button
                  type="button"
                  onClick={() => debouncedPlanner && onShowAllBaysAtThisTime?.(debouncedPlanner)}
                  className="text-xs font-semibold text-brand dark:text-brand-light hover:underline cursor-pointer text-right"
                >
                  Show all bays at this time →
                </button>
              ) : (
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Map uses this time</span>
              ))}
          </div>
        )}

        {!checkTimeExpanded && debouncedPlanner && !plannerBackdatedError && (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/80">
            {!mapBaysAtPlannedTime ? (
              <button
                type="button"
                onClick={() => debouncedPlanner && onShowAllBaysAtThisTime?.(debouncedPlanner)}
                className="text-xs font-semibold text-brand dark:text-brand-light hover:underline cursor-pointer text-right"
              >
                Show all bays at this time →
              </button>
            ) : (
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Map uses this time</span>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-5 shrink-0 pt-4 border-b border-gray-200/60 dark:border-gray-700/60">
        {atLabel && (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-3">At {atLabel}</p>
        )}
        <VerdictCard
          bay={bay}
          evaluation={evaluation}
          evaluationPending={evalLoading}
          plannerActive={plannerActive}
        />
      </div>

      {plannerActive && bay.hasRules && !evalLoading && evaluation && (
        <div className="px-5 py-4 shrink-0 border-b border-gray-200/60 dark:border-gray-700/60">
          <div className="flex justify-between gap-4 text-sm py-1.5">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">Stay limit:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-right tabular-nums">
              {formatStayLimitShort(evaluation?.active_restriction?.max_stay_mins) ?? '-'}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-sm py-1.5">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">Leave by:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">
              {formatLeaveByClock(evaluation?.active_restriction?.expires_at) ?? '-'}
            </span>
          </div>
        </div>
      )}

      <div className="px-5 py-5 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: cols.border }}
            >
              {badgeLabel}
            </div>
            <div className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-1.5">
              {bayDisplayName}
            </div>
            {missingStreetNote && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{missingStreetNote}</div>
            )}
            {(bay.name?.trim() || walkStr) && (
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {bay.name?.trim() ? <span>#{bay.id}</span> : null}
                {bay.name?.trim() && walkStr ? <span> · {walkStr}</span> : null}
                {!bay.name?.trim() && walkStr ? <span>{walkStr}</span> : null}
              </div>
            )}
            <div className="mt-3">
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

      <div className="px-5 pt-5 pb-8 flex-1 space-y-4">
        <div className="flex items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3">
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

        {!evalLoading && !bay.hasRules && (
          <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2.5">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="shrink-0 text-gray-400 mt-0.5">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  No rule text for this bay
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                  Sensor data only – confirm rules on street signs before parking.
                </p>
                <p className="text-[11px] text-[#35338c] dark:text-[#a3a1e6] font-medium mt-1.5">
                  Gold ring on the map = full rule data.
                </p>
              </div>
            </div>
          </div>
        )}

        {!evalLoading && showApiNote && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 text-[11px] text-blue-700 dark:text-blue-300">
            Rules from CoM API (no hourly schedule in this feed).
          </div>
        )}

        {warnLine && (
          <div className="pl-4 pr-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 border-l-4 border-l-amber-500 dark:border-amber-700/50 dark:border-l-amber-500 text-xs text-amber-900 dark:text-amber-100 leading-snug">
            {warnLine}
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
