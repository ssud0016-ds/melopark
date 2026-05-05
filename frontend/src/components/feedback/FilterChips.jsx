import { useState } from 'react'
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
]

function CustomDurationRow({ durationFilter, customDuration, onDurationFilterChange, onCustomDurationChange }) {
  const [unit, setUnit] = useState('min')
  const isActive = durationFilter === 'custom'

  const displayValue = isActive
    ? (unit === 'hr' ? Math.round((customDuration ?? 0) / 60 * 10) / 10 : (customDuration ?? ''))
    : ''

  const handleValueChange = (val) => {
    const mins = unit === 'hr' ? Math.round(val * 60) : val
    onCustomDurationChange(mins)
  }

  const unitBtn = (label) =>
    `px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${unit === label ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-slate-700'}`

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={isActive}
        onClick={() => onDurationFilterChange(isActive ? null : 'custom')}
        className={cn(chipBase, isActive ? chipActive : chipIdle)}
      >
        Custom
      </button>
      {isActive && (
        <div className="flex shrink-0 items-center gap-1">
          <input
            type="number"
            min="1"
            max={unit === 'hr' ? 24 : 1440}
            step={unit === 'hr' ? 0.5 : 1}
            value={displayValue}
            onChange={(e) => handleValueChange(Number(e.target.value))}
            placeholder={unit === 'hr' ? 'hrs' : 'min'}
            className="w-14 rounded-full border border-brand bg-white/70 px-2 py-1 text-center text-[11px] font-semibold text-slate-700 outline-none backdrop-blur-sm dark:border-brand dark:bg-surface-dark-secondary/60 dark:text-gray-100"
          />
          <div className="flex overflow-hidden rounded-full border border-slate-300/70 bg-white/70 backdrop-blur-sm dark:border-slate-500/60 dark:bg-surface-dark-secondary/60">
            <button type="button" onClick={() => setUnit('min')} className={unitBtn('min')}>min</button>
            <button type="button" onClick={() => setUnit('hr')} className={cn(unitBtn('hr'), 'border-l border-slate-300/70 dark:border-slate-500/60')}>hr</button>
          </div>
        </div>
      )}
    </div>
  )
}

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

  const subheading = 'px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400'

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
      <div className="relative">
        <div
          className="flex w-full items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="Filter bays by duration"
        >
          {DURATION_FILTERS.map((f) => renderDurationChip(f))}
        </div>
        {/* Right-edge fade — signals horizontal scrollability */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/90 to-transparent dark:from-surface-dark-secondary/90" aria-hidden />
      </div>
      <CustomDurationRow
        durationFilter={durationFilter}
        customDuration={customDuration}
        onDurationFilterChange={onDurationFilterChange}
        onCustomDurationChange={onCustomDurationChange}
      />
    </div>
  )
}
