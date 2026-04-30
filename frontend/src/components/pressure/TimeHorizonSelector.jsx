const HORIZONS = [
  { value: 'now', label: 'Now' },
  { value: '1h', label: '+1h' },
  { value: '3h', label: '+3h' },
  { value: '6h', label: '+6h' },
]

export default function TimeHorizonSelector({ value, onChange }) {
  return (
    <div className="flex gap-1" role="tablist" aria-label="Pressure time horizon">
      {HORIZONS.map((h) => (
        <button
          key={h.value}
          role="tab"
          aria-selected={value === h.value}
          onClick={() => onChange(h.value)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            value === h.value
              ? 'bg-brand text-white dark:bg-brand-300 dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {h.label}
        </button>
      ))}
    </div>
  )
}
