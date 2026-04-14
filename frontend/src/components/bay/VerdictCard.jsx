import { cn } from '../../utils/cn'

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
 *   bay        – bay object (always present); only bay.type and bay.bayType used
 *   evaluation – BayEvaluation from backend, or null while loading / on failure
 */
export default function VerdictCard({ bay, evaluation }) {
  const verdict = evaluation?.verdict ?? null      // "yes" | "no" | "unknown" | null
  const hasRealVerdict = verdict === 'yes' || verdict === 'no'
  const isUnknown = verdict === 'unknown'
  const restriction = evaluation?.active_restriction ?? null

  // ── Visual type (colour) ────────────────────────────────────────────────
  // Priority: backend verdict → sensor-derived bay.type (loading state fallback)
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

  // ── Headline ─────────────────────────────────────────────────────────────
  let headlineText
  if (isUnknown) {
    headlineText = 'Rules Unknown'
  } else if (hasRealVerdict) {
    headlineText = isAvailable ? 'Safe to Park' : isTrap ? 'Rule Trap' : 'Do Not Park'
  } else {
    // No evaluation yet (loading / API failed) — derive a neutral label from sensor
    headlineText = isAvailable ? 'Likely Available' : isTrap ? 'Restricted Bay' : 'Occupied'
  }

  // ── Grid row values — ALL from backend; no local guessing ────────────────
  const statusVal = isUnknown
    ? 'Rule data not available for this bay.'
    : hasRealVerdict
      ? evaluation.reason
      : evaluation === null
        ? 'Rule evaluation loading\u2026'
        : 'Rule data unavailable — check posted signage.'

  const limitVal = restriction?.typedesc
    ?? (bay.bayType !== 'Other' ? bay.bayType : null)
    ?? '\u2014'

  const costVal = 'Check street signage for pricing'  // no cost data in any source

  const appliesVal = restriction?.plain_english ?? 'Check posted street signage'

  return (
    <div
      className={cn(
        'rounded-xl p-4 border',
        isAvailable && 'bg-brand border-brand dark:bg-brand dark:border-brand',
        isTrap && 'bg-trap-50 border-trap-200 dark:bg-trap-500/10 dark:border-trap-400/40',
        !isAvailable && !isTrap && 'bg-danger-50 border-danger-200 dark:bg-danger-500/10 dark:border-danger-400/40',
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span
          className={cn(
            'text-sm font-bold',
            isAvailable && 'text-white dark:text-white',
            isTrap && 'text-trap dark:text-trap-400',
            !isAvailable && !isTrap && 'text-danger dark:text-danger-400',
          )}
        >
          {headlineText}
        </span>
        <span className={cn('text-xs', isAvailable ? 'text-white/85' : 'text-gray-500 dark:text-gray-400')}>
          {limitVal}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Status', value: statusVal },
          { label: 'Time Limit', value: limitVal },
          { label: 'Cost', value: costVal },
          { label: 'Applies', value: appliesVal },
        ].map((row) => (
          <div
            key={row.label}
            className={cn('rounded-lg px-3 py-2', isAvailable ? 'bg-white/15' : 'bg-white/60 dark:bg-white/5')}
          >
            <div
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                isAvailable ? 'text-white/80' : 'text-gray-400 dark:text-gray-500',
              )}
            >
              {row.label}
            </div>
            <div
              className={cn(
                'text-xs font-semibold mt-0.5 break-words leading-snug',
                isAvailable ? 'text-white' : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {row.value ?? '\u2014'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
