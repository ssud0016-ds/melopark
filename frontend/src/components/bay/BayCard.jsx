import { BAY_COLORS } from '../../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../../utils/mapGeo'
import { cn } from '../../utils/cn'

const STATUS_BADGE = {
  available: { className: 'bg-brand-50 text-brand-dark dark:bg-brand-900/40 dark:text-brand-light', label: 'Available' },
  trap:      { className: 'bg-trap-50 text-amber-700 dark:bg-trap-500/10 dark:text-trap-400', label: '\u26a0 Trap' },
  occupied:  { className: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400', label: 'Occupied' },
}

export default function BayCard({ bay, selected, destination, onSelect }) {
  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available
  const avDot = bay.free === 0 ? '🔴' : bay.free <= bay.spots * 0.3 ? '🟠' : '🟢'
  const badge = STATUS_BADGE[bay.type] || STATUS_BADGE.occupied

  let distLabel = null
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    const mn = walkingMinutesFromMeters(m)
    distLabel = `${m} m \u00b7 ~${mn} min walk`
  }

  return (
    <button
      onClick={() => onSelect(bay.id)}
      className={cn(
        'flex items-start gap-3 w-full text-left px-3.5 py-3 rounded-xl cursor-pointer border-[1.5px] mb-2 transition-all',
        selected
          ? 'border-current bg-brand-50 dark:bg-brand-900/20'
          : 'border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-surface-dark-secondary hover:border-brand/40 hover:bg-brand-50/40 dark:hover:bg-brand-900/10',
      )}
      style={selected ? { borderColor: cols.border } : undefined}
      aria-selected={selected}
      role="option"
    >
      {/* Colour dot */}
      <div
        className="w-3 h-3 rounded-full shrink-0 mt-0.5"
        style={{ background: cols.dot }}
      />

      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {bay.name}
          </div>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', badge.className)}>
            {badge.label}
          </span>
        </div>

        {/* Sub info */}
        <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-2 flex-wrap mb-1.5">
          <span>#{bay.id}</span>
          <span>{avDot} <strong className="text-gray-600 dark:text-gray-300">{bay.free}/{bay.spots}</strong> spots free</span>
          {bay.cost && <span>{bay.cost}</span>}
          {distLabel && <span>{distLabel}</span>}
        </div>

        {/* Tags */}
        <div className="flex gap-1 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-surface-tertiary dark:bg-surface-dark-tertiary font-bold">
            {(bay.limitType || '').toUpperCase()}
          </span>
          {bay.tags
            .filter((t) => !t.match(/^[234]P$/i))
            .map((t, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-surface-tertiary dark:bg-surface-dark-tertiary"
              >
                {t}
              </span>
            ))}
        </div>

        {/* Warning */}
        {bay.warn && (
          <div className="bg-trap-50 dark:bg-trap-500/10 border border-trap-200 dark:border-trap-400/30 rounded-lg px-2.5 py-1.5 text-[10px] text-orange-700 dark:text-orange-300 mt-1.5">
            &#9888; {bay.warn}
          </div>
        )}
      </div>
    </button>
  )
}
