const HORIZONS = [
  { value: 'now', label: 'Now' },
  { value: '1h', label: '+1h' },
  { value: '3h', label: '+3h' },
  { value: '6h', label: '+6h' },
]

export default function TimeHorizonSelector({ value, onChange, compact = false }) {
  if (compact) {
    return (
      <div
        className="flex gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-0.5 shadow-map-float backdrop-blur-sm dark:border-slate-600 dark:bg-surface-dark-secondary/95"
        role="tablist"
        aria-label="Pressure time horizon"
      >
        {HORIZONS.map((h) => (
          <button
            key={h.value}
            role="tab"
            aria-selected={value === h.value}
            onClick={() => onChange(h.value)}
            className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
              value === h.value
                ? 'bg-brand text-white dark:bg-brand-300 dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-1" role="tablist" aria-label="Pressure time horizon">
      {HORIZONS.map((h) => (
        <button
          key={h.value}
          role="tab"
          aria-selected={value === h.value}
          onClick={() => onChange(h.value)}
          className={`rounded-full px-3 py-1 text-xs font-semibold shadow-map-float transition-colors ${
            value === h.value
              ? 'bg-brand text-white dark:bg-brand-300 dark:text-gray-900'
              : 'bg-white/95 text-gray-600 hover:bg-gray-100 dark:bg-surface-dark-secondary/95 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {h.label}
        </button>
      ))}
    </div>
  )
}
