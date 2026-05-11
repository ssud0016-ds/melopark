import { useState, useEffect } from 'react'
import TopBar from './components/layout/TopBar'
import AboutPage from './components/home/AboutPage'
import AttributionPage from './components/legal/AttributionPage'
import TermsPage from './components/legal/TermsPage'
import MapPage from './components/map/MapPage'
import PredictionsPage from './components/predictions/PredictionsPage'
import { useBays } from './hooks/useBays'
import { useDarkMode } from './hooks/useDarkMode'

export default function App() {
  const [page, setPage] = useState('map')
  const { bays, lastUpdated, error, loading, refresh } = useBays()
  const [darkMode, toggleDark, setTheme] = useDarkMode()
  const [flyTarget, setFlyTarget] = useState(null)

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleNavigateToMap = (lat, lon, label) => {
    setFlyTarget({ lat, lon, label, ts: Date.now() })
    setPage('map')
  }

  return (
    <div className="flex min-h-[100dvh] flex-col font-sans">
      {/* TopBar: desktop only — mobile uses ChromeSearchBar inside each page */}
      {!isMobile && (
        <TopBar
          activePage={page}
          onNavigate={setPage}
          darkMode={darkMode}
          onToggleDark={toggleDark}
        />
      )}

      {/* Content — no top padding on mobile (no TopBar); keep pt-16 on desktop */}
      <div className={`flex min-h-0 flex-1 flex-col ${isMobile ? '' : 'pt-12 sm:pt-16'}`}>
        {page === 'map' && (
          <MapPage
            bays={bays}
            lastUpdated={lastUpdated}
            apiError={error}
            apiLoading={loading}
            onRetry={refresh}
            flyTarget={flyTarget}
            onNavigate={setPage}
            darkMode={darkMode}
            onToggleDark={toggleDark}
            onSetTheme={setTheme}
          />
        )}
        {page === 'predictions' && (
          <PredictionsPage
            onNavigateToMap={handleNavigateToMap}
            onNavigate={setPage}
            darkMode={darkMode}
            onToggleDark={toggleDark}
            onSetTheme={setTheme}
          />
        )}
        {page === 'about'       && <AboutPage onNavigate={setPage} />}
        {page === 'attribution' && <AttributionPage onNavigate={setPage} />}
        {page === 'terms'       && <TermsPage onNavigate={setPage} />}
      </div>
    </div>
  )
}
