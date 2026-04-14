import { cn } from '../../utils/cn'

export default function TimelineStrip({ timeline }) {
  if (!timeline?.length) return null

  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        Rule timeline today
      </div>
      {timeline.map((t, i) => (
        <div key={i} className="flex gap-3 mb-3 items-start">
          {/* Dot + connector */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full shrink-0',
                t.on
                  ? 'bg-brand'
                  : 'bg-transparent border-2 border-gray-200 dark:border-gray-600',
              )}
            />
            {i < timeline.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-700 my-0.5 min-h-[16px]" />
            )}
          </div>

          {/* Label */}
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.time}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{t.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
