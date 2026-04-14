// src/App.jsx
import React, { useState } from 'react';
import Navbar    from './components/Navbar';
import HomePage  from './components/HomePage';
import MapPage   from './components/MapPage';
import { useBays } from './hooks/useBays';

export default function App() {
  const [page, setPage] = useState('home');
  const { bays, lastUpdated, availableBayCount, totalFreeSpots, error, loading, refresh } = useBays();

  return (
    <div style={{ fontFamily:"'Inter', sans-serif", minHeight:'100vh' }}>
      <Navbar activePage={page} onNavigate={setPage} />

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
  );
}
