import { useState, useEffect } from 'react'
import TopBar from './components/layout/TopBar'
import AboutPage from './components/home/AboutPage'
import AttributionPage from './components/legal/AttributionPage'
import TermsPage from './components/legal/TermsPage'
import MapPage from './components/map/MapPage'
import PredictionsPage from './components/predictions/PredictionsPage'
import SettingsSheet from './components/settings/SettingsSheet'
import { useBays } from './hooks/useBays'
import { useDarkMode } from './hooks/useDarkMode'

export default function App() {
  const [page, setPage] = useState('map')
  const { bays, lastUpdated, error, loading, refresh } = useBays()
  const [darkMode, toggleDark, setTheme] = useDarkMode()
  const [flyTarget, setFlyTarget] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [colorBlindMode, setColorBlindMode] = useState(false)
  const [accessibilityAvailableOnly, setAccessibilityAvailableOnly] = useState(false)
  const [triggerOnboarding, setTriggerOnboarding] = useState(false)

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
          onSettingsOpen={() => setSettingsOpen(true)}
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
            onSettingsOpen={() => setSettingsOpen(true)}
            colorBlindMode={colorBlindMode}
            onToggleColorBlind={() => setColorBlindMode((v) => !v)}
            accessibilityAvailableOnly={accessibilityAvailableOnly}
            onSetAccessibilityAvailableOnly={setAccessibilityAvailableOnly}
            triggerOnboarding={triggerOnboarding}
            onOnboardingConsumed={() => setTriggerOnboarding(false)}
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

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        darkMode={darkMode}
        onSetTheme={setTheme}
        colorBlindMode={colorBlindMode}
        onToggleColorBlind={() => setColorBlindMode((v) => !v)}
        accessibleOnly={accessibilityAvailableOnly}
        onToggleAccessible={() => setAccessibilityAvailableOnly((v) => !v)}
        onNavigate={setPage}
        onHelpOpen={() => { setPage('map'); setTriggerOnboarding(true) }}
      />
    </div>
  )
}
