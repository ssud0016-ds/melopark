import { BAY_COLORS } from '../../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../../utils/mapGeo'
import { cn } from '../../utils/cn'

const STATUS_BADGE = {
  available: { className: 'bg-accent text-gray-900 border border-accent', label: 'Available' },
  trap:      { className: 'bg-trap-50 text-amber-700 dark:bg-trap-500/10 dark:text-trap-400', label: '\u26a0 Restricted' },
  occupied:  { className: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400', label: 'Occupied' },
}

/**
 * Compact bay card shown in the bay list.
 *
 * Displays only fields that come from real data sources:
 *   - bay.name        – street name from CoM sensor API (or "Unnamed Bay")
 *   - bay.id          – kerbside sensor ID (real)
 *   - bay.free        – sensor occupancy (real)
 *   - bay.type        – visual category derived from sensor + restriction API (real)
 *   - bay.bayType     – raw CoM restriction type string (real)
 *   - distance/walk   – computed from GPS coords (real, requires destination)
 *
 * Fields intentionally absent (no real source):
 *   - cost: no meter rate data in current data pipeline
 *   - limitType tag: only available after calling /evaluate; not fetched at list level
 *   - warn: only available from /evaluate; not fetched at list level
 */
export default function BayCard({ bay, selected, destination, onSelect }) {
  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available
  const occupancyDot = bay.free === 0 ? '🔴' : '🟢'
  const badge = STATUS_BADGE[bay.type] || STATUS_BADGE.occupied

  let distLabel = null
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    const mn = walkingMinutesFromMeters(m)
    distLabel = `${m} m \u00b7 ~${mn} min walk`
  }

  const displayName = bay.name || 'Unnamed Bay'

  // Bay type label from CoM restriction API (real external data)
  const typeLabel = bay.bayType && bay.bayType !== 'Other' ? bay.bayType : null

  return (
    <button
      onClick={() => onSelect(bay.id)}
      className={cn(
        'flex items-start gap-3 w-full text-left px-3.5 py-3 rounded-xl cursor-pointer border-[1.5px] mb-2 transition-all',
        selected
          ? 'border-current bg-surface-secondary'
          : 'border-gray-200/60 bg-surface-secondary hover:border-brand/40 hover:bg-surface-secondary',
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
        {/* Name + status badge */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {displayName}
          </div>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', badge.className)}>
            {badge.label}
          </span>
        </div>

        {/* Sub info — only real data */}
        <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-2 flex-wrap mb-1.5">
          <span>#{bay.id}</span>
          <span>
            {occupancyDot}{' '}
            <strong className="text-gray-600 dark:text-gray-300">
              {bay.free === 1 ? 'Free' : bay.free === 0 ? 'Occupied' : 'Unknown'}
            </strong>
          </span>
          {distLabel && <span>{distLabel}</span>}
        </div>

        {/* Bay type tag — from CoM restriction API */}
        {typeLabel && (
          <div className="flex gap-1 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
              {typeLabel}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
