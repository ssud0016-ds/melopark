import { cn } from '../../utils/cn'

const FILTERS = [
  { id: 'all', label: 'All bays' },
  { id: 'available', label: 'Available' },
  { id: 'trap', label: 'Caution' },
  { id: 'lt1h', label: '<1h' },
  { id: '1h', label: '1h' },
  { id: '2h', label: '2h' },
  { id: '3h', label: '3h' },
  { id: '4h', label: '4h' },
]

export default function FilterChips({ activeFilter, onFilterChange }) {
  return (
    <div
      id="map-filter-chips"
      className="flex w-full items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg border border-slate-200 bg-white/95 px-1.5 py-1 shadow-map-float [-ms-overflow-style:none] [scrollbar-width:thin] dark:border-slate-600 dark:bg-surface-dark-secondary/95"
      role="radiogroup"
      aria-label="Filter bays by type"
    >
      {FILTERS.map((f) => {
        const isActive = activeFilter === f.id
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md border-[1.5px] px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer',
              isActive
                ? 'border-brand bg-brand text-white dark:border-brand dark:bg-brand'
                : 'border-brand-300 bg-brand-50 text-brand-900 hover:bg-brand-100 dark:border-brand-300/80 dark:bg-brand-50 dark:text-brand-900',
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
