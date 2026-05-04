import { useState } from 'react'
import { cn } from '../../utils/cn'

const FILTERS = [
  { id: 'all', label: 'All bays' },
  { id: 'available', label: 'Available' },
  { id: 'trap', label: 'Caution' },
  { id: 'lt1h', label: 'Less than 1h parking' },
  { id: '1h', label: '1h parking' },
  { id: '2h', label: '2h parking' },
  { id: '3h', label: '3h parking' },
  { id: '4h', label: '4h parking' },
]

const DURATION_FILTERS = [
  { id: '15min', label: '15 min' },
  { id: '30min', label: '30 min' },
  { id: '1h', label: '1H' },
  { id: '2h', label: '2H' },
  { id: '3h', label: '3H' },
  { id: '4h', label: '4H' },
]

function CustomDurationRow({ durationFilter, customDuration, onDurationFilterChange, onCustomDurationChange, chipBase, chipActive, chipIdle }) {
  const [unit, setUnit] = useState('min')
  const isActive = durationFilter === 'custom'

  const displayValue = isActive
    ? (unit === 'hr' ? Math.round((customDuration ?? 0) / 60 * 10) / 10 : (customDuration ?? ''))
    : ''

  const handleValueChange = (val) => {
    const mins = unit === 'hr' ? Math.round(val * 60) : val
    onCustomDurationChange(mins)
  }

  const handleUnitSwitch = (newUnit) => {
    if (newUnit === unit) return
    setUnit(newUnit)
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
            <button type="button" onClick={() => handleUnitSwitch('min')} className={unitBtn('min')}>min</button>
            <button type="button" onClick={() => handleUnitSwitch('hr')} className={cn(unitBtn('hr'), 'border-l border-slate-300/70 dark:border-slate-500/60')}>hr</button>
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
  activeFilter,
  onFilterChange,
  collapsed = false,
  onToggleCollapsed,
}) {
  return (
    <div className="relative flex w-auto flex-col items-end gap-2">
      <div className="flex w-auto items-center justify-end">
        <button
          type="button"
          onClick={() => onToggleCollapsed?.(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="map-filter-chips"
          aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
          title={collapsed ? 'Expand filters' : 'Collapse filters'}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 bg-white/95 text-gray-600 shadow-card transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-surface-dark-secondary dark:text-gray-200 dark:hover:bg-surface-dark"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            className={cn('transition-transform', !collapsed && 'rotate-180')}
            aria-hidden
          >
            <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[520] w-[200px] max-w-[68vw] rounded-xl border border-gray-200/80 bg-white/95 p-1.5 shadow-card dark:border-gray-700 dark:bg-surface-dark-secondary/95">
          <div
            id="map-filter-chips"
            className="flex max-h-44 min-h-[34px] min-w-0 flex-col items-stretch gap-1.5 overflow-y-auto pr-1"
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
                  'px-2.5 py-1 rounded-lg border-[1.5px] text-[11px] font-semibold',
                    'whitespace-nowrap transition-all cursor-pointer flex items-center justify-between gap-2',
                    'shadow-card',
                    isActive
                      ? 'bg-brand text-white border-brand dark:bg-brand dark:text-white dark:border-brand'
                      : 'bg-brand-50 text-brand-900 border-brand-300 dark:bg-brand-50 dark:text-brand-900 dark:border-brand-300/80',
                  )}
                >
                  <span>{f.label}</span>
                  <span aria-hidden className={cn('text-[11px]', isActive ? 'opacity-100' : 'opacity-0')}>
                    ✓
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
