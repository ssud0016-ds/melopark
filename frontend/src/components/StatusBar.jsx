/**
 * Status bar showing how many bays are free/occupied nearby.
 */
export default function StatusBar({ sensors, loading, error }) {
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

  const free = sensors.filter(s => s.status === 'Unoccupied' && !s.is_stale).length
  const occupied = sensors.filter(s => s.status === 'Present' && !s.is_stale).length
  const stale = sensors.filter(s => s.is_stale).length
  const total = sensors.length

  return (
    <div className="flex items-center gap-4 text-sm py-2">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        {free} free
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        {occupied} occupied
      </span>
      {stale > 0 && (
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          {stale} uncertain
        </span>
      )}
      <span className="text-gray-400 ml-auto">
        {total} bays loaded
      </span>
    </div>
  )
}
