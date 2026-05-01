import { cn } from '../../utils/cn'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'trap', label: 'Caution' },
]

const chipBase =
  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors cursor-pointer backdrop-blur-sm'
const chipActive =
  'border-brand bg-brand text-white shadow-sm dark:border-brand dark:bg-brand'
const chipIdle =
  'border-slate-300/70 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-400 dark:border-slate-500/60 dark:bg-surface-dark-secondary/60 dark:text-gray-100'

export default function FilterChips({
  activeFilter,
  onFilterChange,
  accessibleOn = false,
  onToggleAccessible,
}) {
  const renderStatus = (f) => {
    const isActive = activeFilter === f.id
    return (
      <button
        key={f.id}
        type="button"
        role="radio"
        aria-checked={isActive}
        onClick={() => onFilterChange(f.id)}
        className={cn(chipBase, isActive ? chipActive : chipIdle)}
      >
        {f.label}
      </button>
    )
  }

  return (
    <div
      id="map-filter-chips"
      className="flex w-full items-center gap-1.5 bg-transparent"
      role="radiogroup"
      aria-label="Filter bays by type"
    >
      {renderStatus(STATUS_FILTERS[0])}
      {renderStatus(STATUS_FILTERS[1])}

      {onToggleAccessible && (
        <button
          type="button"
          role="switch"
          aria-checked={accessibleOn}
          aria-label={accessibleOn ? 'Disable accessibility filter' : 'Enable accessibility filter'}
          onClick={onToggleAccessible}
          className={cn(
            chipBase,
            'inline-flex items-center gap-1',
            accessibleOn ? chipActive : chipIdle,
          )}
        >
          <span aria-hidden>♿</span>
          <span>Accessible</span>
        </button>
      )}

      {renderStatus(STATUS_FILTERS[2])}
    </div>
  )
}
