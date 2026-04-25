import { cn } from '../../utils/cn'
import { liveOccupancyLabel, rulesVerdictLabel } from '../../utils/bayLabels'
import { formatLeaveByClock } from '../../utils/plannerTime'

function dotClass(state) {
  if (state === 'ok') return 'bg-emerald-500'
  if (state === 'bad') return 'bg-red-500'
  if (state === 'warn') return 'bg-amber-500'
  return 'bg-gray-300'
}

function rulesDot(verdict) {
  if (verdict === 'yes') return 'ok'
  if (verdict === 'no') return 'bad'
  return 'unknown'
}

function sensorDot(free) {
  if (free === 1) return 'ok'
  if (free === 0) return 'bad'
  return 'unknown'
}

/**
 * Two stacked proof rows under the hero verdict.
 *
 * Row 1: rules verdict (allowed / blocked / unclear) with optional "until HH:MM".
 * Row 2: live sensor (free / taken / no sensor) with relative or formatted timestamp.
 *
 * Props:
 *   bay            - bay object (uses bay.free, bay.sensorLastUpdated)
 *   evaluation     - evaluation object (uses verdict, active_restriction.expires_at)
 *   evalLoading    - true while evaluate request is in flight
 *   sensorTimeStr  - pre-formatted sensor timestamp string (or null)
 */
export default function ProofRows({ bay, evaluation, evalLoading, sensorTimeStr }) {
  const verdict = evaluation?.verdict ?? null
  const expiresAt = evaluation?.active_restriction?.expires_at ?? null
  const expiresClock = expiresAt ? formatLeaveByClock(expiresAt) : null

  const rulesLabel = evalLoading ? 'Checking' : rulesVerdictLabel(evaluation)
  const occupancyLabel = liveOccupancyLabel(bay)

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotClass(rulesDot(verdict)))} aria-hidden />
        <div className="text-sm text-gray-800 dark:text-gray-100 flex-1 min-w-0">
          <span className="font-semibold">Rules:</span>{' '}
          <span>{rulesLabel}</span>
        </div>
        {!evalLoading && expiresClock && (
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
            until {expiresClock}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotClass(sensorDot(bay?.free)))} aria-hidden />
        <div className="text-sm text-gray-800 dark:text-gray-100 flex-1 min-w-0">
          <span className="font-semibold">Sensor:</span>{' '}
          <span>{occupancyLabel}</span>
        </div>
        {sensorTimeStr && (
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
            {sensorTimeStr}
          </span>
        )}
      </div>
    </div>
  )
}
