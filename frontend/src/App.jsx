import { useState, useCallback, useMemo } from 'react'
import ParkingMap from './components/ParkingMap'
import BayDetail from './components/BayDetail'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
import { useSensors } from './hooks/useSensors'
import { useRestrictionTranslator } from './hooks/useRestrictionTranslator'
import { haversineDistance } from './utils/distance'

const SEARCH_RADIUS_M = 400

export default function App() {
  const [destination, setDestination] = useState(null)
  const [selectedSensor, setSelectedSensor] = useState(null)

  const { sensors, loading, error, refresh } = useSensors()
  const translator = useRestrictionTranslator()

  // When a destination is set, only show bays within SEARCH_RADIUS_M metres.
  const visibleSensors = useMemo(() => {
    if (!destination) return sensors
    return sensors.filter((s) =>
      haversineDistance(destination.lat, destination.lng, s.lat, s.lng) <= SEARCH_RADIUS_M
    )
  }, [sensors, destination])

  const handleSearch = useCallback((location) => {
    setDestination(location)
    setSelectedSensor(null)
    translator.clear()
  }, [translator])

  const handleBayClick = useCallback((sensor) => {
    setSelectedSensor(sensor)
    if (sensor.bay_id) {
      translator.translate(sensor.bay_id)
    }
  }, [translator])

  const handleCloseDetail = useCallback(() => {
    setSelectedSensor(null)
    translator.clear()
  }, [translator])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-melopark-teal rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">MelOPark</h1>
            <span className="text-xs text-gray-400 hidden sm:inline">Melbourne Parking Intelligence</span>
          </div>
          <SearchBar onSearch={handleSearch} loading={loading} />
          <StatusBar sensors={visibleSensors} loading={loading} error={error} />
        </div>
      </header>

      {/* Map area */}
      <main className="flex-1 relative">
        <ParkingMap
          sensors={visibleSensors}
          destination={destination}
          onBayClick={handleBayClick}
        />

        {/* Out-of-coverage notice */}
        {destination && !loading && visibleSensors.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
                          bg-white border border-amber-300 rounded-xl shadow-lg
                          px-4 py-3 max-w-sm w-[90%] text-center">
            <p className="text-sm font-medium text-amber-700">No parking data available here.</p>
            <p className="text-xs text-gray-500 mt-1">CoM sensors cover Melbourne CBD only.</p>
          </div>
        )}

        {/* Bay detail panel (slides up on mobile, sidebar on desktop) */}
        <BayDetail
          sensor={selectedSensor}
          translation={translator.result}
          loading={translator.loading}
          error={translator.error}
          onClose={handleCloseDetail}
        />
      </main>
    </div>
  )
}
