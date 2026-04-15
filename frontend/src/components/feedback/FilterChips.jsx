import { cn } from '../../utils/cn'

const FILTERS = [
  { id: 'all',       label: 'All Bays',      color: 'brand' },
  { id: 'available', label: '🟢 Available',  color: 'brand' },
  { id: 'hasRules',  label: '📋 Has Rules',  color: 'violet' },
  { id: 'trap',      label: '⚠️ Restricted', color: 'trap' },
  { id: 'timed',     label: '⏱ Timed',       color: 'cyan' },
  { id: 'occupied',  label: '🔴 Occupied',   color: 'amber' },
]

const COLOR_MAP = {
  brand:  { active: 'bg-brand text-white border-brand' },
  trap:   { active: 'bg-trap text-white border-trap' },
  violet: { active: 'bg-[#35338c] text-white border-[#35338c]' },
  cyan:   { active: 'bg-accent text-brand border-accent' },
  amber:  { active: 'bg-[#ed6868] text-white border-[#ed6868]' },
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
