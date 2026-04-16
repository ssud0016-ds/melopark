import { cn } from '../../utils/cn'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Free now' },
  { id: 'trap', label: 'Caution' },
]

export default function FilterChips({
  activeFilter,
  onFilterChange,
  showLimitedBays,
  onToggleLimitedBays,
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Filter by
      </p>

      <div className="flex w-full min-w-0 items-center gap-2">
        <div
          className="flex min-h-[34px] min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 scrollbar-hide"
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
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200/90 bg-white/90 py-1 pl-2 pr-1 shadow-card dark:border-gray-700 dark:bg-surface-dark-secondary/95"
          title="When on, the map shows only bays with full rule information. Turn off to include sensor-only bays too."
        >
          <div className="min-w-0 max-w-[7.75rem] leading-tight">
            <span className="block text-[10px] font-semibold text-gray-800 dark:text-gray-100">
              Rule info only
            </span>
            <span className="block text-[9px] text-gray-500 dark:text-gray-400">
              Hide sensor-only bays
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showLimitedBays}
            aria-label="Show only bays with full rule information"
            onClick={() => onToggleLimitedBays?.(!showLimitedBays)}
            className={cn(
              'relative h-6 w-10 shrink-0 rounded-full transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              showLimitedBays ? 'bg-brand dark:bg-brand' : 'bg-gray-300 dark:bg-gray-600',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out',
                showLimitedBays ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
