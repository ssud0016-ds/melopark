function eventLabel(ev) {
  const n = ev?.name ?? ev?.event_name
  return typeof n === 'string' ? n : ''
}

export default function EventBadge({ events = [] }) {
  if (!events || events.length === 0) return null
  const head = events.slice(0, 2)
  const more = Math.max(0, events.length - head.length)
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {head.map((ev, i) => {
        const label = eventLabel(ev) || 'Event'
        const title = [label, ev.start_iso].filter(Boolean).join(' · ')
        return (
          <span
            key={i}
            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200"
            title={title}
          >
            {label.slice(0, 22)}
          </span>
        )
      })}
      {more > 0 && (
        <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">+{more}</span>
      )}
    </div>
  )
}
