import { BAY_COLORS } from '../../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../../utils/mapGeo'
import { cn } from '../../utils/cn'
import VerdictCard from './VerdictCard'
import TimelineStrip from './TimelineStrip'

export default function BayDetailSheet({
  bay,
  destination,
  onClose,
  isMobile,
  lastUpdated,
  reserveBottomPx = 280,
}) {
  if (!bay) return null

  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available

  let badgeLabel = 'Occupied'
  if (bay.type === 'available') badgeLabel = 'Available'
  else if (bay.type === 'trap') badgeLabel = 'Rule Trap'

  let walkStr = bay.tags?.[2] || bay.tags?.[0] || ''
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    walkStr = `${m} m from ${destination.name} \u2013 ${walkingMinutesFromMeters(m)} min walk`
  } else if (!walkStr) {
    walkStr = 'Select a destination to see walking distance'
  }

  const spotDotColor =
    bay.free === 0 ? 'bg-danger' : bay.free <= (bay.spots ?? 1) * 0.3 ? 'bg-trap' : 'bg-accent'

  const feedUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const sensorStr = bay.sensorLastUpdated
    ? (() => {
        try {
          const d = new Date(bay.sensorLastUpdated)
          if (Number.isNaN(d.getTime())) return String(bay.sensorLastUpdated)
          return d.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'medium' })
        } catch {
          return String(bay.sensorLastUpdated)
        }
      })()
    : null

  const spots = bay.spots ?? 1
  const free = bay.free ?? 0

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-surface-dark overflow-y-auto overscroll-contain',
        isMobile
          ? 'fixed top-16 inset-x-0 bottom-0 z-[2000]'
          : 'absolute right-0 top-0 w-[380px] max-w-[min(420px,44vw)] shadow-[-8px_0_40px_rgba(0,0,0,0.12)] z-[560]',
      )}
      style={!isMobile ? { bottom: reserveBottomPx } : undefined}
      role="dialog"
      aria-label={`Bay ${bay.name} details`}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="sticky top-0 self-end mt-3.5 mr-3.5 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-none cursor-pointer flex items-center justify-center text-base text-gray-500 dark:text-gray-400 z-[3] shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        &times;
      </button>

      {/* Header */}
      <div className="px-5 pb-4 border-b border-gray-200/60 dark:border-gray-700/60 shrink-0 -mt-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: cols.border }}
            >
              {badgeLabel}
            </div>
            <div className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-1">
              {bay.name}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Bay #{bay.id} \u2013 {walkStr}
            </div>
          </div>
          {feedUpdatedStr && (
            <div className="text-[11px] font-semibold text-brand-dark dark:text-brand-light bg-brand-50 dark:bg-brand-900/40 border border-brand/25 rounded-full px-3 py-1.5 whitespace-nowrap self-start">
              Updated {feedUpdatedStr}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-7 flex-1">
        {/* Spot count */}
        <div className="flex items-center gap-2.5 bg-surface-secondary rounded-xl px-3.5 py-3 mb-4">
          <div className={cn('w-3 h-3 rounded-full shrink-0', spotDotColor)} />
          <span className="text-sm font-bold text-gray-900">
            {free}/{spots} spots free
          </span>
          <span className="text-xs text-gray-500 ml-auto">
            {(bay.limitType || '').toUpperCase()}
          </span>
        </div>

        {/* Sensor timestamp */}
        {sensorStr && (
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3.5 px-3 py-2 bg-surface-tertiary dark:bg-surface-dark-tertiary rounded-lg">
            Sensor last reported: {sensorStr}
          </div>
        )}

        {/* Verdict card */}
        <VerdictCard bay={bay} />

        {/* Warning */}
        {bay.warn && (
          <div className="mt-3.5 px-3.5 py-2.5 bg-trap-50 dark:bg-trap-500/10 border border-trap-200 dark:border-trap-400/30 rounded-xl text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
            &#9888; {bay.warn}
          </div>
        )}

        {/* Timeline */}
        <TimelineStrip timeline={bay.timeline} />

        {/* Description */}
        {bay.desc && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {bay.desc}
          </p>
        )}
      </div>
    </div>
  )
}
