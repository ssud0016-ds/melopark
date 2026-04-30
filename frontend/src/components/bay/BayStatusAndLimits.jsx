import { cn } from '../../utils/cn'
import { formatLeaveByClock } from '../../utils/plannerTime'

function dot(on) {
  return cn(
    'w-3 h-3 rounded-full shrink-0',
    on ? 'bg-[#2E2A8A]' : 'bg-transparent border-2 border-gray-200 dark:border-gray-600',
  )
}

export default function BayStatusAndLimits({ bay, evaluation }) {
  const restriction = evaluation?.active_restriction ?? null
  const warning = evaluation?.warning ?? null

  const maxStay = restriction?.max_stay_mins ?? null
  const leaveBy =
    (restriction?.expires_at && formatLeaveByClock(restriction.expires_at)) ||
    (warning?.starts_at && formatLeaveByClock(warning.starts_at)) ||
    null

  const nowText =
    bay?.free === 1
      ? 'Sensor reports this space is free'
      : bay?.free === 0
        ? 'Sensor reports this space is occupied'
        : 'No live sensor data for this bay'

  const items = [
    { title: 'Now', desc: nowText },
    ...(maxStay != null
      ? [{ title: 'Maximum Stay', desc: `Maximum stay is ${maxStay} minutes` }]
      : []),
    ...(leaveBy ? [{ title: 'Leave By', desc: leaveBy }] : []),
  ]

  return (
    <div className="px-5 mt-5">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Bay Status and Limits
      </div>

      <div className="flex flex-col">
        {items.map((t, i) => (
          <div key={t.title} className="flex items-stretch">
            <div className="mr-4 flex w-3 shrink-0 flex-col items-center">
              <div className={cn(dot(i === 1), 'mt-0.5')} aria-hidden />
              {i < items.length - 1 && (
                <div className="mt-1 w-0.5 flex-1 min-h-[12px] bg-gray-100 dark:bg-gray-700" />
              )}
            </div>
            <div className={cn('min-w-0 flex-1', i < items.length - 1 && 'pb-5')}>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {t.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

