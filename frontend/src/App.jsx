import { useState, useCallback } from 'react'
import ParkingMap from './components/ParkingMap'
import BayDetail from './components/BayDetail'
import SearchBar from './components/SearchBar'
import StatusBar from './components/StatusBar'
import { useSensors } from './hooks/useSensors'
import { useRestrictionTranslator } from './hooks/useRestrictionTranslator'

export default function App() {
  const [destination, setDestination] = useState(null)
  const [selectedSensor, setSelectedSensor] = useState(null)

  const { sensors, loading, error, refresh } = useSensors()
  const translator = useRestrictionTranslator()

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
          <StatusBar sensors={sensors} loading={loading} error={error} />
        </div>
      </header>

      {/* Map area */}
      <main className="flex-1 relative">
        <ParkingMap
          sensors={sensors}
          destination={destination}
          onBayClick={handleBayClick}
        />

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
