import { cn } from '../../utils/cn'

const FILTERS = [
  { id: 'all', label: 'All bays' },
  { id: 'available', label: 'Available' },
  { id: 'timed', label: 'Timed' },
  { id: 'hasRules', label: 'Has Rules' },
]

export default function FilterChips({
  activeFilter,
  onFilterChange,
  showLimitedBays,
  onToggleLimitedBays,
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto w-full pb-0.5 scrollbar-hide"
      role="group"
      aria-label="Bay filter"
    >
      {FILTERS.map((f) => {
        const isActive = activeFilter === f.id
        return (
          <button
            key={f.id}
            role="radio"
            aria-checked={isActive}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-full border-[1.5px] text-xs font-semibold',
              'whitespace-nowrap shrink-0 transition-all cursor-pointer',
              'shadow-card',
              isActive
                ? 'bg-brand-50 text-brand-900 border-brand-300 dark:bg-brand dark:text-white dark:border-brand'
                : 'bg-brand text-white border-brand dark:bg-brand-50 dark:text-brand-900 dark:border-brand-300/80',
            )}
          >
            {f.label}
          </button>
        )
      })}

      <button
        role="switch"
        aria-checked={!showLimitedBays}
        onClick={() => onToggleLimitedBays?.(!showLimitedBays)}
        className={cn(
          'px-3.5 py-1.5 rounded-full border-[1.5px] text-xs font-semibold',
          'whitespace-nowrap shrink-0 transition-all cursor-pointer',
          'shadow-card',
          !showLimitedBays
            ? 'bg-brand-50 text-brand-900 border-brand-300 dark:bg-brand dark:text-white dark:border-brand'
            : 'bg-brand text-white border-brand dark:bg-brand-50 dark:text-brand-900 dark:border-brand-300/80',
        )}
      >
        Verified only
      </button>
    </div>
  )
}
