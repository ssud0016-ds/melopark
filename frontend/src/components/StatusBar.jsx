/**
 * Status bar showing parking availability.
 *
 * - With destination: shows a nearby summary ("12 free · 8 occupied within 400m")
 * - Without destination: shows overall city-wide counts
 */
function formatTime(date) {
  if (!date) return null
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function StatusBar({ sensors, loading, error, destination, lastUpdated }) {
  if (loading) {
    return (
      <div className="text-sm text-gray-500 py-2">
        Loading bay data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 py-2">
        Could not load sensor data. The map may show stale information.
      </div>
    )
  }

  const free     = sensors.filter(s => s.status === 'free').length
  const occupied = sensors.filter(s => s.status === 'occupied').length
  const unknown  = sensors.filter(s => s.status === 'unknown').length
  const total    = sensors.length

  // Nearby summary (shown when a destination is selected)
  if (destination) {
    if (total === 0) {
      return (
        <div className="flex items-center justify-between text-sm py-2">
          <span className="flex items-center gap-2 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            No parking bays found within 400m
          </span>
          {formatTime(lastUpdated) && (
            <span className="text-xs text-gray-400">Updated {formatTime(lastUpdated)}</span>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center justify-between text-sm py-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-green-700">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            {free} free
          </span>
          <span className="text-gray-300">·</span>
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            {occupied} occupied
          </span>
          <span className="text-gray-400">within 400m</span>
          {unknown > 0 && (
            <span className="flex items-center gap-1.5 text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              {unknown} unknown
            </span>
          )}
        </div>
        {formatTime(lastUpdated) && (
          <span className="text-xs text-gray-400">Updated {formatTime(lastUpdated)}</span>
        )}
      </div>
    )
  }

  // Default city-wide summary (no destination selected)
  return (
    <div className="flex items-center justify-between text-sm py-2">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          {free} free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          {occupied} occupied
        </span>
        {unknown > 0 && (
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            {unknown} unknown
          </span>
        )}
        <span className="text-gray-400">{total} bays loaded</span>
      </div>
      {formatTime(lastUpdated) && (
        <span className="text-xs text-gray-400">Updated {formatTime(lastUpdated)}</span>
      )}
    </div>
  )
}
