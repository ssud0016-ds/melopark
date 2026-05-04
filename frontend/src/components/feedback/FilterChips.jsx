import { cn } from '../../utils/cn'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'trap', label: 'Caution' },
]

const DURATION_FILTERS = [
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '1h', label: '1H' },
  { id: '2h', label: '2H' },
  { id: '3h', label: '3H' },
  { id: '4h', label: '4H' },
  { id: 'custom', label: 'Custom' },
]

const chipBase =
  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors cursor-pointer backdrop-blur-sm'
const chipActive =
  'border-brand bg-brand text-white shadow-sm dark:border-brand dark:bg-brand'
const chipIdle =
  'border-slate-300/70 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-400 dark:border-slate-500/60 dark:bg-surface-dark-secondary/60 dark:text-gray-100'

export default function FilterChips({
  statusFilter,
  onStatusFilterChange,
  durationFilter,
  onDurationFilterChange,
  accessibleOn = false,
  onToggleAccessible,
  customDuration,
  onCustomDurationChange,
}) {
  const renderStatusChip = (f) => {
    const isActive = statusFilter === f.id
    return (
      <button
        key={f.id}
        type="button"
        role="radio"
        aria-checked={isActive}
        onClick={() => onStatusFilterChange(f.id)}
        className={cn(chipBase, isActive ? chipActive : chipIdle)}
      >
        {f.label}
      </button>
    )
  }

  const renderDurationChip = (f) => {
    const isActive = durationFilter === f.id
    return (
      <button
        key={f.id}
        type="button"
        role="radio"
        aria-checked={isActive}
        onClick={() => onDurationFilterChange(isActive ? null : f.id)}
        className={cn(chipBase, isActive ? chipActive : chipIdle)}
      >
        {f.label}
      </button>
    )
  }

  const subheading = 'px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400'

  return (
    <div id="map-filter-chips" className="flex w-full flex-col gap-1 bg-transparent">
      <span className={subheading}>Status</span>
      <div
        className="flex w-full items-center gap-1.5"
        role="radiogroup"
        aria-label="Filter bays by type"
      >
        {renderStatusChip(STATUS_FILTERS[0])}
        {renderStatusChip(STATUS_FILTERS[1])}

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
            <span>Accessible</span>
          </button>
        )}

        {renderStatusChip(STATUS_FILTERS[2])}
      </div>

      <span className={subheading}>Duration</span>
      <div
        className="flex w-full items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Filter bays by duration"
      >
        {DURATION_FILTERS.map((f) => renderDurationChip(f))}
        {durationFilter === 'custom' && (
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="number"
              min="1"
              max="480"
              value={customDuration ?? ''}
              onChange={(e) => onCustomDurationChange(Number(e.target.value))}
              placeholder="min"
              className="w-16 rounded-full border border-brand bg-white/70 px-2 py-1 text-center text-[11px] font-semibold text-slate-700 outline-none backdrop-blur-sm dark:border-brand dark:bg-surface-dark-secondary/60 dark:text-gray-100"
            />
            <span className="shrink-0 text-[11px] font-semibold text-slate-600 dark:text-gray-300">min</span>
          </div>
        )}
      </div>
    </div>
  )
}
