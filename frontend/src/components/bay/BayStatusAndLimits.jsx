import { cn } from '../../utils/cn'
import { formatLeaveByClock } from '../../utils/plannerTime'

const CONNECTOR = '#f4f6ff'

function dot(highlight) {
  return cn(
    'w-3 h-3 rounded-full shrink-0 mt-0.5',
    highlight ? 'bg-[#2E2A8A]' : 'bg-transparent border-2 border-[#f4f6ff]',
  )
}

export default function BayStatusAndLimits({ bay, evaluation }) {
  const restriction = evaluation?.active_restriction ?? null
  const warning = evaluation?.warning ?? null

  const maxStay = restriction?.max_stay_mins ?? null
  const leaveBy =
    formatLeaveByClock(restriction?.expires_at) ||
    formatLeaveByClock(warning?.starts_at) ||
    null

  const nowText =
    bay?.free === 1
      ? 'Sensor reports this space is free'
      : bay?.free === 0
        ? 'Sensor reports this space is occupied'
        : 'No live sensor data for this bay'

  const items = [
    { title: 'Now', desc: nowText, highlight: false },
    ...(maxStay != null
      ? [{ title: 'Maximum Stay', desc: `Maximum stay is ${maxStay} minutes`, highlight: true }]
      : []),
    ...(leaveBy ? [{ title: 'Leave By', desc: leaveBy, highlight: false }] : []),
  ]

  return (
    <div className="px-5 mt-5">
      <div className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">
        Bay Status and Limits
      </div>

      <div className="flex flex-col">
        {items.map((t, i) => (
          <div key={t.title} className="flex items-stretch">
            <div className="mr-4 flex w-3 shrink-0 flex-col items-center">
              <div className={dot(t.highlight)} aria-hidden />
              {i < items.length - 1 && (
                <div className="mt-1 w-0.5 flex-1 min-h-[12px]" style={{ backgroundColor: CONNECTOR }} />
              )}
            </div>
            <div className={cn('min-w-0 flex-1', i < items.length - 1 && 'pb-5')}>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {t.title}
              </div>
              <div className="mt-0.5 text-[11px] leading-[17px] text-gray-700 dark:text-gray-300">
                {t.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
