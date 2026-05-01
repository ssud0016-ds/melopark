const ITEMS = [
  {
    color: '#3ca028',
    label: 'Quiet',
    desc:  'Plenty of parking',
    range: '< 40',
    icon:  (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" fill="#3ca028" />
      </svg>
    ),
  },
  {
    color: '#ffa500',
    label: 'Moderate',
    desc:  'Some bays available',
    range: '40 - 70',
    icon:  (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" fill="#ffa500" />
      </svg>
    ),
  },
  {
    color: '#ff3030',
    label: 'Busy',
    desc:  'Limited parking',
    range: '> 70',
    icon:  (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" fill="#ff3030" />
      </svg>
    ),
  },
]

// Pulse indicator SVG
function PulseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="4" fill="#ff3030" opacity="0.3">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="6" cy="6" r="2.5" fill="#ff3030" />
    </svg>
  )
}

export default function PressureLegend() {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white/95 px-3 py-2.5 shadow-card backdrop-blur-sm dark:border-gray-700/60 dark:bg-surface-dark-secondary/95">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Parking Pressure
      </div>

      {/* Gradient bar */}
      <div
        className="mb-2.5 h-2.5 w-full rounded-full"
        style={{
          background: 'linear-gradient(to right, #3ca028, #a8d020, #ffd700, #ffa500, #ff4500, #ff1010)',
        }}
      />

      {/* Legend items */}
      <div className="flex flex-col gap-1.5">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 flex-shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
              {item.label}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {item.desc}
            </span>
            <span className="ml-auto text-[10px] font-mono text-gray-400 dark:text-gray-500">
              {item.range}
            </span>
          </div>
        ))}
      </div>

      {/* Pulse note */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-gray-100 pt-1.5 dark:border-gray-700/40">
        <PulseIcon />
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Pulsing zones indicate high demand
        </span>
      </div>
    </div>
  )
}
