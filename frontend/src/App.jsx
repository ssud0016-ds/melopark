import { useState } from 'react'
import TopBar from './components/layout/TopBar'
import HomePage from './components/home/HomePage'
import MapPage from './components/map/MapPage'
import { useBays } from './hooks/useBays'
import { useDarkMode } from './hooks/useDarkMode'

export default function App() {
  const [page, setPage] = useState('home')
  const { bays, lastUpdated, availableBayCount, totalFreeSpots, error, loading, refresh } = useBays()
  const [darkMode, toggleDark] = useDarkMode()

  return (
    <div className="min-h-screen font-sans">
      <TopBar
        activePage={page}
        onNavigate={setPage}
        darkMode={darkMode}
        onToggleDark={toggleDark}
      />

      {page === 'home' && (
        <HomePage
          availableBayCount={availableBayCount}
          totalFreeSpots={totalFreeSpots}
          onNavigate={setPage}
        />
      )}

      {page === 'map' && (
        <MapPage
          bays={bays}
          lastUpdated={lastUpdated}
          apiError={error}
          apiLoading={loading}
          onRetry={refresh}
        />
      )}
    </div>
  )
}
