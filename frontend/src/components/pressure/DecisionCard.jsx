const LEVEL_BADGES = {
  low: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200', label: 'Quiet' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', label: 'Moderate' },
  high: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-200', label: 'Busy' },
}

const TREND_LABELS = { rising: '↑ Rising', falling: '↓ Falling', stable: '→ Stable' }

export default function DecisionCard({ target, alternatives, destinationName, onAlternativeClick, onClose }) {
  if (!target) return null

  const badge = LEVEL_BADGES[target.level] || LEVEL_BADGES.low
  const occPct = Math.round((target.components?.occupancy_pct || 0) * 100)

  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white/95 p-3 shadow-card-lg backdrop-blur-sm dark:border-gray-700/60 dark:bg-surface-dark-secondary/95">
      <div className="mb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Parking near {destinationName || 'destination'}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {TREND_LABELS[target.trend] || '→ Stable'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close decision card"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-[11px] text-gray-600 dark:text-gray-300">
          <span>{occPct}% occupied</span>
          <span>{target.free_bays} free / {target.total_bays}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full"
            style={{
              width: `${occPct}%`,
              backgroundColor: occPct > 80 ? '#ed6868' : occPct > 50 ? '#FFB382' : '#a3ec48',
            }}
          />
        </div>
      </div>

      {target.events_nearby?.length > 0 && (
        <div className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 dark:bg-amber-900/20">
          <div className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
            ⚡ {target.events_nearby[0].event_name} ({target.events_nearby[0].distance_m}m away)
          </div>
        </div>
      )}

      {alternatives?.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Try instead
          </div>
          <div className="flex flex-col gap-1">
            {alternatives.map((alt) => {
              const altBadge = LEVEL_BADGES[alt.level] || LEVEL_BADGES.low
              return (
                <button
                  key={alt.zone_id}
                  onClick={() => onAlternativeClick?.(alt)}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: alt.level === 'low' ? '#a3ec48' : alt.level === 'medium' ? '#FFB382' : '#ed6868',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                    {alt.label}
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-gray-500 dark:text-gray-400">
                    {alt.free_bays} free · {alt.walk_minutes} min walk
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-2 text-[9px] text-gray-400 dark:text-gray-500">
        Based on live sensors + typical traffic pattern
      </div>
    </div>
  )
}
