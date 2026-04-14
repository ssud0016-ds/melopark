<<<<<<< Updated upstream
// src/App.jsx
import React, { useState } from 'react';
import Navbar    from './components/Navbar';
import HomePage  from './components/HomePage';
import MapPage   from './components/MapPage';
import { useBays } from './hooks/useBays';

export default function App() {
  const [page, setPage] = useState('home');
  const { bays, lastUpdated, availableBayCount, totalFreeSpots, error, loading, refresh } = useBays();
=======
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
>>>>>>> Stashed changes

  return (
    <div style={{ fontFamily:"'Inter', sans-serif", minHeight:'100vh' }}>
      <Navbar activePage={page} onNavigate={setPage} />

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
  );
}
