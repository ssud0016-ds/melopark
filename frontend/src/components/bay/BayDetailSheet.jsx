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
  const [customDurationInput, setCustomDurationInput] = useState(() =>
    String(savedPlannerDurationMins != null ? savedPlannerDurationMins : 60),
  )

  useEffect(() => {
    setCustomDurationInput(String(durationMins))
  }, [durationMins])

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

  const plannerActive = Boolean(debouncedPlanner) && !plannerBackdatedError

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
    if (plannerBackdatedError) {
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
  }, [bay?.id, fetchOpts, debouncedPlanner, plannerBackdatedError])

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
    setCheckTimeExpanded((e) => {
      const next = !e
      if (next && !dateStr && !timeStr) {
        const now = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
        setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
      }
      return next
    })
  }, [dateStr, timeStr])

  const handleClearPlanner = useCallback(() => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
    setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
    setDurationMins(60)
    onResetPlannerToLive?.()
  }, [onResetPlannerToLive])

  if (!bay) return null

  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available

  let badgeLabel
  if (!evalLoading && evaluation?.verdict) {
    if (evaluation.verdict === 'yes') badgeLabel = 'OK to park'
    else if (evaluation.verdict === 'no') badgeLabel = 'Not allowed now'
    else badgeLabel = 'Unclear'
  } else if (evalLoading) {
    badgeLabel = 'Checking…'
  } else if (bay.type === 'available') {
    badgeLabel = 'Space free'
  } else if (bay.type === 'trap') {
    badgeLabel = 'Special zone'
  } else {
    badgeLabel = 'Space taken'
  }

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
  const topSpaceLabel =
    bay.free === 1 ? 'Space free' : bay.free === 0 ? 'Space occupied' : 'Space status unknown'
  const topLocationLabel = bay.name?.trim() || 'Location unavailable'

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
      <div className="sticky top-0 z-[3] flex items-center gap-3 border-b border-gray-200/60 bg-white/95 px-5 py-3 backdrop-blur dark:border-gray-700/60 dark:bg-surface-dark/95 shrink-0">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: cols.border }}
          >
            {topSpaceLabel}
          </div>
          <div className="truncate text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
            Bay #{bay.id}
          </div>
          <div className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
            {topLocationLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-none cursor-pointer flex items-center justify-center text-base text-gray-500 dark:text-gray-400 shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          &times;
        </button>
      </div>

      <div className="px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
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
            <div className="mt-2">
              {hasRuleInfo ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#35338c]/30 bg-[#35338c]/5 px-2 py-0.5 text-[10px] font-semibold text-[#35338c] dark:border-[#a3a1e6]/40 dark:bg-[#35338c]/20 dark:text-[#a3a1e6]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#35338c] dark:bg-[#a3a1e6]" />
                  Full rules available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-300" />
                  Sensor only — check the sign
                </span>
              )}
            </div>
          </div>
          {feedUpdatedStr && (
            <div
              className="text-[11px] font-semibold text-brand-dark dark:text-brand-light bg-brand-50 dark:bg-brand-900/40 border border-brand/25 rounded-full px-3 py-1.5 whitespace-nowrap self-start"
              title="When the rules data feed last refreshed"
            >
              Live feed · {feedUpdatedStr}
            </div>
          )}
        </div>
      </div>

      {bay.hasRules && !evalLoading && evaluation && (
        <div className="px-5 py-4 shrink-0 border-b border-gray-200/60 dark:border-gray-700/60">
          {(() => {
            const noActiveRestriction = evaluation?.verdict === 'yes' && !evaluation?.active_restriction
            const stayLimitLabel = noActiveRestriction
              ? 'Unlimited'
              : (formatStayLimitShort(evaluation?.active_restriction?.max_stay_mins) ?? '-')
            const leaveByLabel = noActiveRestriction
              ? (formatLeaveByClock(evaluation?.warning?.starts_at) ?? '-')
              : (formatLeaveByClock(evaluation?.active_restriction?.expires_at) ?? '-')
            const verdictLine = evaluation?.verdict === 'yes'
              ? 'Yes, you can park here'
              : evaluation?.verdict === 'no'
                ? 'No, you cannot park here'
                : null
            return (
              <>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {atLabel ? `At ${atLabel}` : 'Right now'}
                </div>
                {verdictLine && (
                  <div
                    className={cn(
                      'mb-2 rounded-lg px-3 py-1.5 text-sm font-semibold',
                      evaluation?.verdict === 'yes'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white',
                    )}
                  >
                    {verdictLine}
                  </div>
                )}
                <div className="flex justify-between gap-4 text-sm py-1.5">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">Zone type</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {limitTypeLabel}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm py-1.5">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">Stay limit</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-right tabular-nums">
                    {stayLimitLabel}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm py-1.5">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">
                    {noActiveRestriction ? 'Rules start' : 'Leave by'}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {leaveByLabel}
                  </span>
                </div>
                <div className="mt-3">
                  <VerdictCard
                    bay={bay}
                    evaluation={evaluation}
                    evaluationPending={evalLoading}
                  />
                </div>
              </>
            )
          })()}
        </div>
      )}

      <div
        ref={plannerSectionRef}
        id="bay-arrival-planner"
        className="px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0 scroll-mt-20"
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
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">Plan ahead</span>
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
            <div className="flex min-w-0 basis-full flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Stay
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATIONS.map((m) => {
                  const isActive = durationMins === m
                  const label = m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}m`
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDurationMins(m)}
                      aria-pressed={isActive}
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors min-h-[28px] ${
                        isActive
                          ? 'border-brand bg-brand text-white dark:border-brand-300/80 dark:bg-brand-50 dark:text-brand-900'
                          : 'border-gray-200/90 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-200 dark:hover:bg-surface-dark-secondary'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
                <label className="ml-0.5 flex items-center gap-1 rounded-lg border border-gray-200/90 bg-white px-2 py-1 dark:border-gray-600 dark:bg-surface-dark">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Custom
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customDurationInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      setCustomDurationInput(raw)
                      const n = Number(raw)
                      if (raw !== '' && Number.isFinite(n) && n > 0) setDurationMins(n)
                    }}
                    onBlur={() => {
                      const n = Number(customDurationInput)
                      if (!customDurationInput || !Number.isFinite(n) || n < 1) {
                        setDurationMins(5)
                        setCustomDurationInput('5')
                        return
                      }
                      const clamped = Math.max(1, Math.min(480, Math.round(n)))
                      setDurationMins(clamped)
                      setCustomDurationInput(String(clamped))
                    }}
                    aria-label="Custom stay duration in minutes"
                    className="w-14 bg-transparent text-center text-xs font-semibold text-gray-900 outline-none dark:text-gray-100"
                  />
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">min</span>
                </label>
              </div>
            </div>
            </div>
          </div>
        )}

        {checkTimeExpanded && plannerBackdatedError && (
          <div className="mt-3 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-xs font-semibold text-danger shadow-card dark:border-danger-400/40 dark:bg-danger-500/10 dark:text-danger-200">
            {plannerBackdatedError}
          </div>
        )}

        {(checkTimeExpanded || (debouncedPlanner && !plannerBackdatedError)) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/80">
            {checkTimeExpanded ? (
              <button
                type="button"
                onClick={handleClearPlanner}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
              >
                Reset to now
              </button>
            ) : <span />}
            {debouncedPlanner && !plannerBackdatedError && (
              !mapBaysAtPlannedTime ? (
                <button
                  type="button"
                  onClick={() => onShowAllBaysAtThisTime?.(debouncedPlanner)}
                  className="text-xs font-semibold text-brand dark:text-brand-light hover:underline cursor-pointer text-right"
                >
                  Apply this time to the map →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onResetPlannerToLive?.()}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
                >
                  Using this time on the map · Undo
                </button>
              )
            )}
          </div>
        )}
      </div>

      <div className="px-5 pt-5 pb-8 flex-1 space-y-4">
        <div className="flex items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3">
          <div className={cn('w-3 h-3 rounded-full shrink-0', spotDotColor)} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Sensor reading
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {bay.free === 1 ? 'Free' : bay.free === 0 ? 'Taken' : 'Unknown'}
            </div>
            {sensorStr && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {sensorStr}
              </div>
            )}
            {!sensorStr && (
              <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 italic">No live sensor time</div>
            )}
          </div>
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
