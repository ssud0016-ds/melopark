<<<<<<< HEAD
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../../utils/mapGeo'
import { bayHeading, bayMissingStreetNote, streetShort } from '../../utils/bayLabels'
import { cn } from '../../utils/cn'
import { fetchBayEvaluation } from '../../services/apiBays'
import { useDebouncedPlannerParams } from '../../hooks/useDebouncedPlannerParams'
import {
  formatStayLimitShort,
  formatLeaveByClock,
  formatAtDateTime,
} from '../../utils/plannerTime'
import { combinedStatus } from '../../utils/bayCombinedStatus'
import HeroVerdict from './HeroVerdict'
import ProofRows from './ProofRows'
import ConstraintChips from './ConstraintChips'
import TimelineStrip from './TimelineStrip'

const DURATIONS = [30, 60, 90, 120, 180, 240]

function splitIsoForInputs(iso) {
  if (!iso) return { dateStr: '', timeStr: '' }
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return { dateStr: '', timeStr: '' }
  return { dateStr: m[1], timeStr: `${m[2]}:${m[3]}` }
}

function ClockIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ open, className }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180', className)}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  const [detailsOpen, setDetailsOpen] = useState(false)

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
    if (t.getTime() < Date.now() - 30_000) return "That time is in the past. Please choose a future time."
    return null
  }, [rawPlanner])

  const debouncedPlanner = useDebouncedPlannerParams(rawPlanner, 300)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bay?.id, plannerResetNonce])

  const fetchOpts = useMemo(() => {
    if (plannerBackdatedError) return null
    if (!debouncedPlanner) return null
    return {
      arrivalIso: debouncedPlanner.arrivalIso,
      durationMins: debouncedPlanner.durationMins,
    }
  }, [debouncedPlanner, plannerBackdatedError])
=======
import { useState, useEffect, useMemo } from 'react'
import { bayHeading, bayMissingStreetNote, streetShort } from '../../utils/bayLabels'
import { cn } from '../../utils/cn'
import { fetchBayEvaluation } from '../../services/apiBays'
import ParkingVerdictPanel from './ParkingVerdictPanel'
import BayStatusAndLimits from './BayStatusAndLimits'
import ParkingSignTranslator from './ParkingSignTranslator'

export default function BayDetailSheet({
  bay,
  onClose,
  isMobile,
  reserveBottomPx = 280,
  savedPlannerArrivalIso = null,
  savedPlannerDurationMins = null,
  mapBaysAtPlannedTime = false,
}) {
  const [evaluation, setEvaluation] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const durationMins = savedPlannerDurationMins ?? 60

  const fetchOpts = useMemo(() => {
    if (!savedPlannerArrivalIso || savedPlannerDurationMins == null) return null
    return {
      arrivalIso: savedPlannerArrivalIso,
      durationMins: savedPlannerDurationMins,
    }
  }, [savedPlannerArrivalIso, savedPlannerDurationMins])
>>>>>>> origin/main

  useEffect(() => {
    if (!bay?.id) {
      setEvaluation(null)
      setEvalLoading(false)
      return
    }
<<<<<<< HEAD
    if (plannerBackdatedError) {
      setEvaluation(null)
      setEvalLoading(false)
      return
    }
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
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

  const combined = combinedStatus(bay, evalLoading ? null : evaluation)

=======
  }, [bay?.id, fetchOpts])

  if (!bay) return null

>>>>>>> origin/main
  const resolvedName = bay.name?.trim() || evaluation?.street_name || null
  const bayDisplayName = resolvedName || bayHeading(bay)
  const missingStreetNote = resolvedName ? null : bayMissingStreetNote(bay)
  const streetLine = resolvedName ? streetShort(resolvedName) : null

<<<<<<< HEAD
  let walkStr = null
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    walkStr = `${m} m from ${destination.name}, ${walkingMinutesFromMeters(m)} min walk`
  }

  const feedUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  const sensorTimeStr = bay.sensorLastUpdated
    ? (() => {
        try {
          const d = new Date(bay.sensorLastUpdated)
          if (Number.isNaN(d.getTime())) return String(bay.sensorLastUpdated)
          return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
        } catch {
          return String(bay.sensorLastUpdated)
        }
      })()
    : feedUpdatedStr

  // Constraint chips
  const noActiveRestriction =
    !evalLoading && evaluation?.verdict === 'yes' && !evaluation?.active_restriction
  const stayLimitLabel = evalLoading
    ? null
    : noActiveRestriction
      ? 'Unlimited'
      : (formatStayLimitShort(evaluation?.active_restriction?.max_stay_mins) ?? null)
  const endsAtLabel = evalLoading
    ? null
    : noActiveRestriction
      ? (formatLeaveByClock(evaluation?.warning?.starts_at) ?? 'No limit')
      : (formatLeaveByClock(evaluation?.active_restriction?.expires_at) ?? null)
  const costLabel = evalLoading
    ? null
    : noActiveRestriction
      ? 'Free'
      : evaluation?.active_restriction
        ? 'Check meter'
        : null

  // Long prose for Details expand
  const reasonText = evalLoading ? null : (evaluation?.reason ?? null)
  const plainEnglish = evalLoading ? null : (evaluation?.active_restriction?.plain_english ?? null)
  const warningDesc = evalLoading ? null : (evaluation?.warning?.description ?? null)

  const coverage = evaluation?.data_coverage ?? null
  const coverageBadge = evalLoading
    ? (
      bay.hasRules
        ? { tone: 'strong', label: 'Full rules available' }
        : { tone: 'mute', label: 'Sensor only. Check the sign.' }
    )
    : coverage === 'full'
      ? { tone: 'strong', label: 'Live status + rules' }
      : coverage === 'rules_only'
        ? { tone: 'weak', label: 'Rules only. No live status.' }
        : coverage === 'partial_signage'
          ? { tone: 'amber', label: 'Check bay sign. Sign type not captured.' }
          : { tone: 'mute', label: 'No data. Check signage.' }

  const dataSource = evaluation?.data_source ?? null
  const showApiNote = dataSource === 'api_fallback'

  const atLabel = debouncedPlanner ? formatAtDateTime(debouncedPlanner.arrivalIso) : null
=======
  const occupancyBadge = bay?.free === 1 ? 'SPACE FREE' : bay?.free === 0 ? 'SPACE OCCUPIED' : 'SPACE UNKNOWN'
  const occupancyDotClass = bay?.free === 1 ? 'bg-emerald-400' : bay?.free === 0 ? 'bg-red-500' : 'bg-gray-400'

  const disabilityOnly =
    evaluation?.active_restriction?.rule_category === 'disabled' || evaluation?.warning?.type === 'disabled'

  const isTowAwayOrLoadingCaution = (() => {
    const cat = (evaluation?.warning?.type || evaluation?.active_restriction?.rule_category || '').toLowerCase()
    return cat === 'clearway' || cat === 'loading' || cat === 'no_standing'
  })()

  const verdictVariant = (() => {
    if (bay?.free === 0) return 'no'
    if (!evaluation || evalLoading) return null
    if (evaluation.verdict === 'no') return 'no'
    if (evaluation.verdict === 'yes' && evaluation.warning && isTowAwayOrLoadingCaution) return 'caution'
    if (evaluation.verdict === 'yes') return 'yes'
    // Keep strict 3-state behaviour: unknown / unsupported warnings are conservative "NO".
    return 'no'
  })()

  const currentlyShowingStr = (() => {
    const iso = savedPlannerArrivalIso || new Date().toISOString()
    // Build "YYYY-MM-DD | h:mm AM/PM" in Melbourne time, matching screenshots.
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const da = parts.find((p) => p.type === 'day')?.value
    const dateStr = y && m && da ? `${y}-${m}-${da}` : ''
    const timeStr = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
    return `${dateStr} | ${timeStr}`
  })()

  const durationLabel = (() => {
    if (mapBaysAtPlannedTime) return 'All Bays'
    if (typeof durationMins !== 'number' || !Number.isFinite(durationMins)) return null
    if (durationMins % 60 === 0 && durationMins <= 6 * 60) return `${durationMins / 60}P`
    return `${durationMins}m`
  })()
>>>>>>> origin/main

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
      {/* 1. Header strip: ID + close, then street short on next line */}
      <div className="sticky top-0 z-[3] bg-white dark:bg-surface-dark px-5 py-3 shrink-0 border-b border-gray-200/60 dark:border-gray-700/60">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Bay #{bay.id}
          </div>
<<<<<<< HEAD
=======
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-gray-500 dark:text-gray-400">
              <span className={cn('w-2 h-2 rounded-full', occupancyDotClass)} aria-hidden />
              {occupancyBadge}
            </div>
>>>>>>> origin/main
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border-none cursor-pointer flex items-center justify-center text-base text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            &times;
          </button>
<<<<<<< HEAD
=======
          </div>
>>>>>>> origin/main
        </div>
        {streetLine ? (
          <div
            className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2"
            title={resolvedName}
          >
            {streetLine}
          </div>
        ) : missingStreetNote ? (
          <div className="mt-0.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            {missingStreetNote}
          </div>
        ) : null}
<<<<<<< HEAD
        {walkStr && (
          <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{walkStr}</div>
        )}
      </div>

      {/* 2. Hero verdict */}
      <HeroVerdict combined={combined} loading={evalLoading} />

      {/* 3. Proof rows */}
      <ProofRows
        bay={bay}
        evaluation={evalLoading ? null : evaluation}
        evalLoading={evalLoading}
        sensorTimeStr={sensorTimeStr}
      />

      {/* 4. Constraint chips */}
      <ConstraintChips stayLimit={stayLimitLabel} cost={costLabel} endsAt={endsAtLabel} />

      {/* 5. Details expand (collapsed by default) */}
      <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0">
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          aria-expanded={detailsOpen}
          aria-controls="bay-details-panel"
          className="flex w-full min-h-[40px] items-center justify-between gap-2 text-left cursor-pointer"
        >
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">Details</span>
          <ChevronIcon open={detailsOpen} className="text-gray-500" />
        </button>

        {detailsOpen && (
          <div id="bay-details-panel" className="mt-3 space-y-2.5">
            {atLabel && (
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                At {atLabel}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  coverageBadge.tone === 'strong' &&
                    'border border-[#35338c]/30 bg-[#35338c]/5 text-[#35338c] dark:border-[#a3a1e6]/40 dark:bg-[#35338c]/20 dark:text-[#a3a1e6]',
                  coverageBadge.tone === 'weak' &&
                    'border border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300',
                  coverageBadge.tone === 'amber' &&
                    'border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300',
                  coverageBadge.tone === 'mute' &&
                    'border border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    coverageBadge.tone === 'strong' && 'bg-[#35338c] dark:bg-[#a3a1e6]',
                    coverageBadge.tone === 'weak' && 'bg-blue-500 dark:bg-blue-300',
                    coverageBadge.tone === 'amber' && 'bg-amber-500 dark:bg-amber-300',
                    coverageBadge.tone === 'mute' && 'bg-gray-400 dark:bg-gray-300',
                  )}
                />
                {coverageBadge.label}
              </span>
              {feedUpdatedStr && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Feed {feedUpdatedStr}
                </span>
              )}
            </div>

            {!evalLoading && coverage === 'partial_signage' && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-800 dark:text-amber-200">
                <div className="font-semibold mb-0.5">Sign type not captured</div>
                <p className="leading-relaxed">
                  Rules shown apply to bays on this stretch. A loading or disabled sign may apply. Check the sign before parking.
                </p>
              </div>
            )}

            {!evalLoading && coverage === 'none' && (
              <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-200">
                <div className="font-semibold mb-0.5">No rule text for this bay</div>
                <p className="leading-relaxed">Sensor only. Check the sign.</p>
              </div>
            )}

            {!evalLoading && showApiNote && (
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Rules from CoM API (no hourly schedule in this feed).
              </p>
            )}

            {reasonText && (
              <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                {reasonText}
              </p>
            )}

            {plainEnglish && plainEnglish.trim() !== (reasonText ?? '').trim() && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {plainEnglish}
              </p>
            )}

            {warningDesc && (
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                {warningDesc}
              </p>
            )}

            <TimelineStrip
              activeRestriction={evalLoading ? null : evaluation?.active_restriction ?? null}
              verdict={evaluation?.verdict ?? null}
            />
          </div>
        )}
      </div>

      {/* 6. Plan ahead expand */}
      <div
        ref={plannerSectionRef}
        id="bay-arrival-planner"
        className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0 scroll-mt-20"
      >
        <button
          type="button"
          onClick={handleToggleCheckTime}
          className="flex w-full min-h-[40px] items-center justify-between gap-2 text-left cursor-pointer"
          aria-expanded={checkTimeExpanded}
          aria-controls="bay-arrival-planner"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ClockIcon className="shrink-0 text-gray-600 dark:text-gray-400" />
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">Plan ahead</span>
          </span>
          <ChevronIcon open={checkTimeExpanded} className="text-gray-500" />
        </button>

        {checkTimeExpanded && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Times are Melbourne time (AEST/AEDT).
            </p>
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
                  Apply this time to the map
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onResetPlannerToLive?.()}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
                >
                  Using this time on the map. Undo
                </button>
              )
            )}
          </div>
        )}
      </div>
=======
      </div>

      {/* 2. Currently showing strip */}
      <div className="px-5 pt-3">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold">Currently Showing:</span>{' '}
          <span className="font-semibold text-[#2E2A8A]">{currentlyShowingStr}</span>
          {durationLabel ? <span className="font-semibold text-gray-500">{` | ${durationLabel}`}</span> : null}
        </div>
        <div className="mt-2 rounded-lg bg-gray-100/70 dark:bg-gray-800/60 px-3 py-1.5 text-[11px] font-semibold text-red-500">
          Please update the time filter to plan ahead
        </div>
      </div>

      {/* 3. Disability banner (when relevant) */}
      {disabilityOnly && (
        <div className="mx-5 mt-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700/40 px-3.5 py-2.5 text-xs font-bold tracking-wider text-blue-700 dark:text-blue-200 flex items-center gap-2">
          <span aria-hidden>♿</span>
          DISABILITY PERMIT HOLDERS ONLY
        </div>
      )}

      {/* 4. Parking verdict panel (matches tab design) */}
      {verdictVariant && (
        <ParkingVerdictPanel
          variant={verdictVariant}
          durationMins={durationMins}
          evaluation={evalLoading ? null : evaluation}
        />
      )}

      {/* 5. Bay status and limits */}
      <BayStatusAndLimits bay={bay} evaluation={evalLoading ? null : evaluation} />

      {/* 6. Parking sign translator */}
      <ParkingSignTranslator evaluation={evalLoading ? null : evaluation} />
>>>>>>> origin/main
    </div>
  )
}
