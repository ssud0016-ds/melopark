const LEVEL_BADGES = {
  low: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200', label: 'Quiet' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', label: 'Moderate' },
  high: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-200', label: 'Busy' },
}

const TREND_ICONS = {
  rising: '↑',
  falling: '↓',
  stable: '→',
}

export default function ZoneDetailPanel({ zone, onClose }) {
  if (!zone) return null

  const badge = LEVEL_BADGES[zone.level] || LEVEL_BADGES.low
  const trendIcon = TREND_ICONS[zone.trend] || '→'
  const occPct = Math.round((zone.components?.occupancy_pct || 0) * 100)

  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white p-4 shadow-card dark:border-gray-700/60 dark:bg-surface-dark-secondary">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-50">{zone.label}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {trendIcon} {zone.trend}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="Close zone detail"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>{occPct}% occupied</span>
          <span>{zone.free_bays} free / {zone.total_bays} bays</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${occPct}%`,
              backgroundColor: occPct > 80 ? '#ed6868' : occPct > 50 ? '#FFB382' : '#a3ec48',
            }}
          />
        </div>
      </div>

      {zone.components && (
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Occupancy</div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-50">{occPct}%</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Traffic</div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-50">
              {zone.components.traffic_z > 0.5 ? 'High' : zone.components.traffic_z < -0.5 ? 'Low' : 'Normal'}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Events</div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-50">
              {zone.events_nearby?.length || 0}
            </div>
          </div>
        </div>
      )}

      {zone.events_nearby?.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Nearby Events
          </div>
          {zone.events_nearby.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 border-t border-gray-100 py-1.5 dark:border-gray-700">
              <span className="mt-0.5 text-xs">🎭</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{ev.event_name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  {ev.distance_m}m away{ev.category ? ` · ${ev.category}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
