import { useState } from 'react'
import TopBar from './components/layout/TopBar'
import AboutPage from './components/home/AboutPage'
import MapPage from './components/map/MapPage'
import { useBays } from './hooks/useBays'
import { useDarkMode } from './hooks/useDarkMode'

export default function App() {
  const [page, setPage] = useState('map')
  const { bays, lastUpdated, error, loading, refresh } = useBays()
  const [darkMode, toggleDark] = useDarkMode()

  return (
    <div className="min-h-screen font-sans">
      <TopBar
        activePage={page}
        onNavigate={setPage}
        darkMode={darkMode}
        onToggleDark={toggleDark}
      />

      {page === 'map' && (
        <MapPage
          bays={bays}
          lastUpdated={lastUpdated}
          apiError={error}
          apiLoading={loading}
          onRetry={refresh}
        />
      )}

      {page === 'about' && (
        <AboutPage onNavigate={setPage} />
      )}
    </div>
  )
}
