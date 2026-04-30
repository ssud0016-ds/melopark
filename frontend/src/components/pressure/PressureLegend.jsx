const ITEMS = [
  { color: '#a3ec48', label: 'Quiet', desc: 'Plenty of parking' },
  { color: '#FFB382', label: 'Moderate', desc: 'Some bays available' },
  { color: '#ed6868', label: 'Busy', desc: 'Limited parking' },
]

export default function PressureLegend() {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white/95 px-3 py-2 shadow-card backdrop-blur-sm dark:border-gray-700/60 dark:bg-surface-dark-secondary/95">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Parking Pressure
      </div>
      <div className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: item.color, opacity: 0.7 }}
            />
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
              {item.label}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {item.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
