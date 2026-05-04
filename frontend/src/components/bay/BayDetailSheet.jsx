import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { DEFAULT_PLANNER_DURATION_MINS } from '../../utils/plannerTime'
import { bayHeading, bayMissingStreetNote, streetShort } from '../../utils/bayLabels'
import { cn } from '../../utils/cn'
import { fetchBayEvaluation } from '../../services/apiBays'
import ParkingVerdictPanel from './ParkingVerdictPanel'
import BayStatusAndLimits from './BayStatusAndLimits'
import ParkingSignTranslator from './ParkingSignTranslator'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function listFocusable(root) {
  if (typeof document === 'undefined' || !root) return []
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return false
    const st = window.getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none') return false
    return true
  })
}

export default function BayDetailSheet({
  bay,
  accessibilityRuleFallback = null,
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
  durationFilter = null,
  customDuration = 60,
}) {
  const [evaluation, setEvaluation] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const durationMins = savedPlannerDurationMins ?? DEFAULT_PLANNER_DURATION_MINS

  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    if (!bay?.id) return

    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusInitial = () => {
      const closeEl = closeButtonRef.current
      if (closeEl && typeof closeEl.focus === 'function') {
        closeEl.focus()
        return
      }
      const root = dialogRef.current
      if (!root) return
      const first = listFocusable(root)[0]
      first?.focus?.()
    }
    focusInitial()

    const onKeyDown = (e) => {
      const root = dialogRef.current
      if (!root) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab') return

      const elems = listFocusable(root)
      if (elems.length === 0) return

      const active = document.activeElement
      if (!root.contains(active)) return

      if (elems.length === 1) {
        e.preventDefault()
        elems[0].focus()
        return
      }

      const first = elems[0]
      const last = elems[elems.length - 1]

      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (previous && document.body.contains(previous) && typeof previous.focus === 'function') {
        previous.focus()
      }
    }
  }, [bay?.id])

  const fetchOpts = useMemo(() => {
    if (!savedPlannerArrivalIso || savedPlannerDurationMins == null) return null
    return {
      arrivalIso: savedPlannerArrivalIso,
      durationMins: savedPlannerDurationMins,
    }
  }, [savedPlannerArrivalIso, savedPlannerDurationMins])

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
  }, [bay?.id, fetchOpts])

  if (!bay) return null

  const renderEvaluation = useMemo(() => {
    if (evalLoading) return null
    if (evaluation?.translator_rules?.length) return evaluation

    const plainEnglish = accessibilityRuleFallback?.plain_english
    const typedesc = accessibilityRuleFallback?.typedesc
    if (!plainEnglish && !typedesc) return evaluation

    const heading = typedesc ? `Rule: ${typedesc}` : 'Accessible bay rule'
    const body = plainEnglish || 'Accessibility rule is available for this bay.'
    return {
      ...(evaluation || {}),
      active_restriction: {
        ...(evaluation?.active_restriction || {}),
        typedesc: typedesc || evaluation?.active_restriction?.typedesc || null,
        plain_english: plainEnglish || evaluation?.active_restriction?.plain_english || null,
        rule_category: evaluation?.active_restriction?.rule_category || 'disabled',
      },
      translator_rules: [
        {
          heading,
          body,
          state: 'current',
          banner: null,
        },
      ],
    }
  }, [evalLoading, evaluation, accessibilityRuleFallback])

  const resolvedName = bay.name?.trim() || renderEvaluation?.street_name || null
  const bayDisplayName = resolvedName || bayHeading(bay)
  const missingStreetNote = resolvedName ? null : bayMissingStreetNote(bay)
  const streetLine = resolvedName ? streetShort(resolvedName) : null

  const occupancyBadge = bay?.free === 1 ? 'FREE NOW' : bay?.free === 0 ? 'OCCUPIED NOW' : 'STATUS UNKNOWN'
  const occupancyDotClass = bay?.free === 1 ? 'bg-emerald-400' : bay?.free === 0 ? 'bg-red-500' : 'bg-gray-400'

  const disabilityOnly =
    renderEvaluation?.active_restriction?.rule_category === 'disabled' || renderEvaluation?.warning?.type === 'disabled'

  const isTowAwayOrLoadingCaution = (() => {
    const cat = (renderEvaluation?.warning?.type || renderEvaluation?.active_restriction?.rule_category || '').toLowerCase()
    return cat === 'clearway' || cat === 'loading' || cat === 'no_standing'
  })()

  const isFuturePlanningMode = (() => {
    if (!savedPlannerArrivalIso) return false
    const planned = new Date(savedPlannerArrivalIso)
    if (Number.isNaN(planned.getTime())) return false
    // Treat near-now planner values as "current" to avoid jitter from click-to-render delay.
    return planned.getTime() > Date.now() + 60 * 1000
  })()

  const verdictVariant = (() => {
    if (!isFuturePlanningMode && bay?.free === 0) return 'no'
    if (!renderEvaluation || evalLoading) return null
    if (renderEvaluation.verdict === 'no') return 'no'
    if (renderEvaluation.verdict === 'yes' && renderEvaluation.warning && isTowAwayOrLoadingCaution) return 'caution'
    if (renderEvaluation.verdict === 'yes') return 'yes'
    // Keep strict 3-state behaviour: unknown / unsupported warnings are conservative "NO".
    return 'no'
  })()

  const _showingDate = (() => {
    const iso = savedPlannerArrivalIso || new Date().toISOString()
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short' }).format(d)
    const mm = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', month: '2-digit' }).format(d)
    const dd = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: '2-digit' }).format(d)
    const yyyy = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric' }).format(d)
    return `${day}, ${mm}/${dd}/${yyyy}`
  })()

  const _showingTime = (() => {
    const iso = savedPlannerArrivalIso || new Date().toISOString()
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d).toUpperCase()
  })()

  const _durFilterLabels = { '15min': '15 min', '30min': '30 min', '1h': '1H', '2h': '2H', '3h': '3H', '4h': '4H' }
  const _durationLabel = durationFilter
    ? (durationFilter === 'custom' && customDuration ? `${customDuration} min` : (_durFilterLabels[durationFilter] || durationFilter))
    : 'Any duration'

  return (
    <div
      ref={dialogRef}
      className={cn(
        'flex flex-col bg-white dark:bg-surface-dark overflow-y-auto overscroll-contain',
        isMobile
          ? 'fixed top-16 inset-x-0 bottom-0 z-[2000] w-full max-w-full'
          : 'absolute right-0 top-0 w-[380px] min-w-[280px] max-w-[min(420px,calc(100vw-24px))] shadow-[-8px_0_40px_rgba(0,0,0,0.12)] z-[560]',
      )}
      style={!isMobile ? { bottom: reserveBottomPx } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`${bayDisplayName}, parking details`}
    >
      {/* 1. Header strip: ID + close, then street short on next line */}
      <div className="sticky top-0 z-[3] bg-white dark:bg-surface-dark px-5 py-3 shrink-0 border-b border-gray-200/60 dark:border-gray-700/60">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Bay #{bay.id}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-gray-500 dark:text-gray-400">
              <span className={cn('w-2 h-2 rounded-full', occupancyDotClass)} aria-hidden />
              {occupancyBadge}
            </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border-none cursor-pointer flex items-center justify-center text-base text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            &times;
          </button>
          </div>
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
      </div>

      {/* 2. Currently showing strip */}
      <div className="px-5 pt-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          <span className="font-semibold">Showing: </span>
          <span className="font-semibold text-[#2E2A8A] dark:text-brand-300">{_durationLabel}</span>
          <span className="mx-1">·</span>
          <span className="font-semibold text-[#2E2A8A] dark:text-brand-300">{_showingDate} {_showingTime}</span>
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
            evaluation={renderEvaluation}
        />
      )}

      {/* 5. Bay status and limits */}
      <BayStatusAndLimits bay={bay} evaluation={renderEvaluation} />

      {/* 6. Parking sign translator */}
      <ParkingSignTranslator evaluation={renderEvaluation} />
    </div>
  )
}
