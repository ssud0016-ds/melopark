import { useState } from 'react'
import TopBar from './components/layout/TopBar'
import SiteFooter from './components/layout/SiteFooter'
import AboutPage from './components/home/AboutPage'
import AttributionPage from './components/legal/AttributionPage'
import TermsPage from './components/legal/TermsPage'
import MapPage from './components/map/MapPage'
import { useBays } from './hooks/useBays'
import { useDarkMode } from './hooks/useDarkMode'

export default function App() {
  const [page, setPage] = useState('map')
  const { bays, lastUpdated, error, loading, refresh } = useBays()
  const [darkMode, toggleDark] = useDarkMode()

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <TopBar
        activePage={page}
        onNavigate={setPage}
        darkMode={darkMode}
        onToggleDark={toggleDark}
      />

      <div className="flex min-h-0 flex-1 flex-col pt-16">
        {page === 'map' && (
          <MapPage
            bays={bays}
            lastUpdated={lastUpdated}
            apiError={error}
            apiLoading={loading}
            onRetry={refresh}
          />
        )}

        {page === 'about' && <AboutPage onNavigate={setPage} />}

        {page === 'attribution' && <AttributionPage onNavigate={setPage} />}

        {page === 'terms' && <TermsPage onNavigate={setPage} />}
      </div>

      <SiteFooter onNavigate={setPage} />
    </div>
  )
}
