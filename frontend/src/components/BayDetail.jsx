/**
 * BayDetail panel - slides up when a user taps a bay marker.
 * Shows the restriction translator output (Epic 2).
 */
export default function BayDetail({ sensor, translation, loading, error, onClose }) {
  if (!sensor) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl
                    max-h-[60vh] overflow-y-auto z-[1000] p-5
                    md:absolute md:right-4 md:bottom-auto md:top-4 md:left-auto
                    md:w-96 md:rounded-2xl md:max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Bay {sensor.bay_id}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                sensor.status === 'free'
                  ? 'bg-green-500'
                  : sensor.status === 'occupied'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
              }`}
            />
            <span className="text-sm text-gray-600">
              {sensor.status === 'free' ? 'Available' : sensor.status === 'occupied' ? 'Occupied' : 'Unknown'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Restriction translation */}
      {loading && (
        <div className="py-6 text-center text-gray-500">
          Loading parking rules...
        </div>
      )}

      {error && (
        <div className="py-4 px-4 bg-red-50 rounded-lg text-red-700 text-sm">
          Could not load rules: {error}
        </div>
      )}

      {translation && (
        <div className="space-y-4">
          {/* Main verdict */}
          <div className={`p-4 rounded-lg ${
            translation.can_park ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${translation.can_park ? 'text-green-800' : 'text-red-800'}`}>
              {translation.can_park ? 'You can park here' : 'Cannot park here'}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              {translation.verdict}
            </p>
          </div>

          {/* Details */}
          {translation.can_park && (
            <div className="grid grid-cols-2 gap-3">
              {translation.time_limit && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Time limit</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{translation.time_limit}</p>
                </div>
              )}
              {translation.expires_at && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Expires at</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{translation.expires_at}</p>
                </div>
              )}
              {translation.cost_estimate && (
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Cost</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{translation.cost_estimate}</p>
                </div>
              )}
            </div>
          )}

          {/* Warnings / traps */}
          {translation.warnings && translation.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Heads up</p>
              {translation.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-700 mt-1">{w}</p>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 mt-4">
            Based on City of Melbourne data. Always check signage on site.
          </p>
        </div>
      )}
    </div>
  )
}
