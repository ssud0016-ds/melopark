import { cn } from '../../utils/cn'
import { formatLeaveByClock } from '../../utils/plannerTime'

/**
 * Shows the current rule state for a parking bay (rules only, no sensor).
 *
 * Data-source policy:
 *   - Rule entries come ONLY from backend `activeRestriction` (DB or API fallback).
 *   - Sensor occupancy is shown in the signal row block, NOT here.
 *   - NO fake time schedules are generated here.
 *   - If no rule data is available, an honest "not available" message is shown.
 *
 * Props:
 *   activeRestriction – ActiveRestriction from the evaluate API, or null
 *   verdict           – "yes" | "no" | "unknown" | null
 */
export default function TimelineStrip({ activeRestriction, verdict }) {
  const items = []

  // ── Active restriction from backend ──────────────────────────────────────
  // Rule wording (typedesc / plain_english) is shown in VerdictCard only – avoid repeating it here.
  if (activeRestriction) {
    if (activeRestriction.max_stay_mins != null) {
      items.push({
        time: 'Max Stay',
        desc: `${activeRestriction.max_stay_mins} min allowed`,
        on: true,
      })
    }

    const leaveBy = formatLeaveByClock(activeRestriction.expires_at)
    if (leaveBy) {
      items.push({
        time: 'Leave by',
        desc: leaveBy,
        on: true,
      })
    }
  }

  // ── Nothing to show ───────────────────────────────────────────────────────
  if (!items.length) {
    // Only render the "not available" note if evaluation has completed
    // (verdict will be set even for unknown – null means still loading)
    if (verdict === null) return null
    // Full rule text lives in VerdictCard; nothing extra to list here.
    if (activeRestriction) return null

    return (
      <div className="mt-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Rule details
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic leading-relaxed">
          No timed breakdown available. Check posted signage.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        Rule limits
      </div>
      {items.map((t, i) => (
        <div key={i} className="flex gap-3 mb-3 items-start">
          <div className="flex flex-col items-center shrink-0">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full shrink-0',
                t.on
                  ? 'bg-brand'
                  : 'bg-transparent border-2 border-gray-200 dark:border-gray-600',
              )}
            />
            {i < items.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-700 my-0.5 min-h-[16px]" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.time}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{t.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
