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

      <div className="flex">
        <div className="flex flex-col items-center mr-4 pt-1">
          {items.map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={dot(i === 1)} aria-hidden />
              {i < items.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-700 my-1 min-h-[22px]" />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1">
          {items.map((t) => (
            <div key={t.title} className="mb-5">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                {t.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

