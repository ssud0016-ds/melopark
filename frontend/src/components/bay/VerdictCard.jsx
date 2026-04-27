import { useState, useEffect } from 'react'
import { cn } from '../../utils/cn'

/** Sentences from `plain_english` not already covered by `reason` (API text only; no invention). */
function plainEnglishBeyondReason(plain, reason) {
  if (!plain?.trim()) return null
  const p = plain.trim()
  if (!reason?.trim()) return p
  const r = reason.toLowerCase()
  const sentences = p.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const extra = sentences.filter((s) => {
    const head = s.toLowerCase().slice(0, 32)
    return head.length >= 6 && !r.includes(head)
  })
  if (extra.length) return extra.join(' ')
  if (!r.includes(p.toLowerCase().slice(0, Math.min(28, p.length)))) return p
  return null
}

const REASON_COLLAPSE_AT = 220

/**
 * Displays parking rule verdict for a bay.
 *
 * Data-source policy:
 *   - All rule text comes from `evaluation` (backend: DB or API fallback).
 *   - `bay` is used ONLY for visual colour category (map-dot type) when
 *     no backend evaluation is available yet (loading state).
 *   - No rule text is ever generated locally.
 *
 * Props:
 *   bay                 – bay object (always present); only bay.type and bay.bayType used
 *   evaluation          – BayEvaluation from backend, or null while loading / on failure
 *   evaluationPending   – true while the evaluate request is in flight
 */
export default function VerdictCard({ bay, evaluation, evaluationPending = false }) {
  const [reasonExpanded, setReasonExpanded] = useState(false)

  useEffect(() => {
    setReasonExpanded(false)
  }, [bay.id])

  const verdict = evaluation?.verdict ?? null      // "yes" | "no" | "unknown" | null
  const hasRealVerdict = verdict === 'yes' || verdict === 'no'
  const isUnknown = verdict === 'unknown'
  const restriction = evaluation?.active_restriction ?? null
  const dataSource = evaluation?.data_source ?? null
  const coverage = evaluation?.data_coverage ?? null
  const hasRealData = dataSource === 'db' || dataSource === 'api_fallback'
  const noRestrictionData =
    !evaluationPending && (coverage === 'none' || (!restriction && !hasRealData))
  const NO_DATA_FALLBACK = 'Restriction data not available. Check signage on site'

  // ── Visual type (colour) ────────────────────────────────────────────────
  let resolvedType = bay.type   // 'available' | 'trap' | 'occupied'
  if (hasRealVerdict) {
    if (verdict === 'yes') {
      resolvedType = 'available'
    } else {
      const cat = (restriction?.rule_category ?? '').toLowerCase()
      resolvedType =
        cat === 'loading' || cat === 'no_standing' || cat === 'clearway'
          ? 'trap'
          : 'occupied'
    }
  }

  const isTrap = resolvedType === 'trap'
  const isAvailable = resolvedType === 'available'

  const loading = evaluationPending

  // ── Primary answer – headline (no big letterform) ──────────────────────
  let headlineText
  if (loading) {
    headlineText = 'Checking rules\u2026'
  } else if (isUnknown) {
    headlineText = 'Rules unclear for this bay'
  } else if (hasRealVerdict) {
    headlineText = isAvailable ? 'Rules allow parking' : 'Rules block parking here'
  } else {
    headlineText = 'Rules unclear for this bay'
  }

  const reasonText = loading
    ? 'Loading rule evaluation\u2026'
    : noRestrictionData
      ? NO_DATA_FALLBACK
      : isUnknown
        ? (evaluation?.reason ?? NO_DATA_FALLBACK)
        : hasRealVerdict
          ? evaluation.reason
          : NO_DATA_FALLBACK

  const reasonStr = typeof reasonText === 'string' ? reasonText : ''

  /** Prefer evaluated rule; never show coarse API bay type when rules say "yes" with no active window. */
  const limitVal = (() => {
    if (restriction?.typedesc) return restriction.typedesc
    if (hasRealVerdict && verdict === 'yes' && coverage !== 'none' && !restriction) {
      return 'None active at this time'
    }
    if (!hasRealVerdict || isUnknown) {
      if (bay.bayType !== 'Other') return bay.bayType
      return '\u2013'
    }
    if (coverage !== 'none' && verdict === 'yes') return 'None active'
    return '\u2013'
  })()

  const costVal = 'Not shown. Check meters or signage'

  /** Extra wording from API `plain_english` not already stated in `reason` (AC: plain English without repeating). */
  let appliesVal = '\u2013'
  if (!loading) {
    if (restriction?.plain_english) {
      const extra = plainEnglishBeyondReason(restriction.plain_english, reasonStr)
      appliesVal = extra ?? '\u2013'
    } else if (coverage !== 'none' && verdict === 'yes') {
      appliesVal =
        'No restriction windows from our data apply at this time. Always confirm on posted signs.'
    } else {
      appliesVal = NO_DATA_FALLBACK
    }
  }

  const showDetailsRow =
    !loading &&
    appliesVal !== '\u2013' &&
    appliesVal.trim() !== reasonStr.trim()
  const reasonNeedsCollapse = reasonStr.length > REASON_COLLAPSE_AT

  let tone
  if (loading) tone = 'neutral'
  else if (hasRealVerdict && verdict === 'yes') tone = 'yes'
  else if (hasRealVerdict && verdict === 'no' && isTrap) tone = 'trap'
  else if (hasRealVerdict && verdict === 'no') tone = 'no'
  else tone = 'neutral'

  return (
    <div
      className={cn(
        'rounded-xl p-4 border',
        tone === 'yes' && 'bg-brand border-brand dark:bg-brand dark:border-brand',
        tone === 'trap' && 'bg-trap-50 border-trap-200 dark:bg-trap-500/10 dark:border-trap-400/40',
        tone === 'no' && 'bg-danger-50 border-danger-200 dark:bg-danger-500/10 dark:border-danger-400/40',
        tone === 'neutral' && 'bg-surface-secondary border-gray-200/80 dark:border-gray-600/60 dark:bg-surface-dark-tertiary',
      )}
      aria-busy={loading}
      aria-live="polite"
    >
      {loading && (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-1">
          Checking
        </p>
      )}
      {!loading && (verdict === 'unknown' || !hasRealVerdict) && (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-1">
          Unclear
        </p>
      )}

      <h2
        className={cn(
          'text-lg font-extrabold tracking-tight leading-tight mb-2',
          tone === 'yes' && 'text-white',
          tone === 'trap' && 'text-trap dark:text-trap-200',
          tone === 'no' && 'text-danger dark:text-danger-200',
          tone === 'neutral' && 'text-gray-900 dark:text-gray-100',
        )}
      >
        {headlineText}
      </h2>
      <div className="mb-4">
        <p
          className={cn(
            'text-sm leading-relaxed',
            !reasonExpanded && reasonNeedsCollapse && 'line-clamp-3',
            tone === 'yes' && 'text-white/95',
            tone === 'trap' && 'text-gray-800 dark:text-gray-200',
            tone === 'no' && 'text-gray-800 dark:text-gray-200',
            tone === 'neutral' && 'text-gray-600 dark:text-gray-300',
          )}
        >
          {reasonText}
        </p>
        {reasonNeedsCollapse && (
          <button
            type="button"
            onClick={() => setReasonExpanded((e) => !e)}
            className={cn(
              'mt-1.5 text-xs font-semibold underline-offset-2 hover:underline',
              tone === 'yes' && 'text-white/90',
              tone !== 'yes' && 'text-brand dark:text-brand-light',
            )}
          >
            {reasonExpanded ? 'Show less' : 'Show full explanation'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Time limit', value: limitVal },
          { label: 'Cost', value: costVal },
          ...(showDetailsRow ? [{ label: 'Details', value: appliesVal }] : []),
        ].map((row) => (
          <div
            key={row.label}
            className={cn(
              'rounded-lg px-3 py-2',
              row.label === 'Details' && 'col-span-2',
              tone === 'yes' ? 'bg-white/15' : 'bg-white/60 dark:bg-white/5',
            )}
          >
            <div
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                tone === 'yes' ? 'text-white/80' : 'text-gray-400 dark:text-gray-500',
              )}
            >
              {row.label}
            </div>
            <div
              className={cn(
                'text-xs font-semibold mt-0.5 break-words leading-snug',
                tone === 'yes' ? 'text-white' : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {row.value ?? '\u2013'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
