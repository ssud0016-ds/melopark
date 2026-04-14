import { cn } from '../../utils/cn'

const FILTERS = [
  { id: 'all',       label: 'All bays',     color: 'brand' },
  { id: 'available', label: '🟢 Available', color: 'brand' },
  { id: 'trap',      label: '⚠️ Traps',     color: 'trap' },
  { id: '2p',        label: '2P',           color: 'violet' },
  { id: '3p',        label: '3P',           color: 'cyan' },
  { id: '4p',        label: '4P',           color: 'amber' },
]

const COLOR_MAP = {
  brand:  { active: 'bg-brand text-white border-brand',               inactive: '' },
  trap:   { active: 'bg-trap text-white border-trap',                 inactive: '' },
  violet: { active: 'bg-violet-600 text-white border-violet-600',     inactive: '' },
  cyan:   { active: 'bg-cyan-600 text-white border-cyan-600',         inactive: '' },
  amber:  { active: 'bg-amber-700 text-white border-amber-700',       inactive: '' },
}

export default function FilterChips({ activeFilter, onFilterChange }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto w-full pb-0.5 scrollbar-hide"
      role="radiogroup"
      aria-label="Bay filter"
    >
      {FILTERS.map((f) => {
        const isActive = activeFilter === f.id
        const colors = COLOR_MAP[f.color]
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
                ? colors.active
                : 'bg-white dark:bg-surface-dark-secondary text-gray-500 dark:text-gray-400 border-white/90 dark:border-gray-600',
            )}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
