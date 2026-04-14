import React, { useRef, useCallback, useEffect } from 'react'
import MapLeaflet from './MapLeaflet'
import SearchBar from './SearchBar'
import BayDetailPanel from './BayDetailPanel'
import BayList from './BayList'
import { useMapState } from '../hooks/useMapState'

const FILTERS = [
  { id: 'all', label: 'All bays', activeStyle: { bg: '#3fa73f', color: 'white', border: '#3fa73f' } },
  { id: 'available', label: '🟢 Available', activeStyle: { bg: '#3fa73f', color: 'white', border: '#3fa73f' } },
  { id: 'trap', label: '⚠️ Traps', activeStyle: { bg: '#f97316', color: 'white', border: '#f97316' } },
  { id: '2p', label: '2P', activeStyle: { bg: '#7c3aed', color: 'white', border: '#7c3aed' } },
  { id: '3p', label: '3P', activeStyle: { bg: '#0891b2', color: 'white', border: '#0891b2' } },
  { id: '4p', label: '4P', activeStyle: { bg: '#b45309', color: 'white', border: '#b45309' } },
]

const SHEET_PEEK_PX = 268

export default function MapPage({ bays, lastUpdated, apiError, apiLoading, onRetry }) {
  const mapRef = useRef(null)

  const {
    selectedBayId,
    setSelectedBayId,
    activeFilter,
    setActiveFilter,
    destination,
    pickDestination,
    clearDestination,
    sheetOpen,
    setSheetOpen,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter,
    defaultMapZoom,
    destinationMapZoom,
  } = useMapState()

  const visibleBays = getVisibleBays(bays)
  const proximityBays = getProximityBays(bays)

  const selectedBay = bays.find((b) => b.id === selectedBayId) || null
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 900

  const proxFreeSpots = proximityBays.reduce(
    (a, b) => a + (b.type === 'available' ? b.free : 0),
    0,
  )
  const proxFreeBays = proximityBays.filter((b) => b.type === 'available').length

  const tsStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—'

  const handlePickLandmark = useCallback(
    (lm) => {
      pickDestination(lm)
    },
    [pickDestination],
  )

  const handleMapReady = useCallback((map) => {
    mapRef.current = map
  }, [])

  const zoomBy = useCallback((delta) => {
    const m = mapRef.current
    if (!m) return
    const z = m.getZoom()
    m.setZoom(Math.max(12, Math.min(19, z + delta)))
  }, [])

  const handleBayClick = useCallback(
    (bay) => {
      if (bay) setSelectedBayId(bay.id)
      else setSelectedBayId(null)
    },
    [setSelectedBayId],
  )

  useEffect(() => {
    if (selectedBay) setSheetOpen(false)
  }, [selectedBay, setSheetOpen])

  return (
    <div style={{ paddingTop: 64, height: '100vh', overflow: 'hidden' }}>
      <style>{`@keyframes mp-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 64px)',
          overflow: 'hidden',
        }}
      >
        <MapLeaflet
          bays={bays}
          visibleBays={visibleBays}
          proximityBays={proximityBays}
          selectedBayId={selectedBayId}
          destination={destination}
          onBayClick={handleBayClick}
          onMapReady={handleMapReady}
          defaultCenter={defaultMapCenter}
          defaultZoom={defaultMapZoom}
          destZoom={destinationMapZoom}
        />

        {apiLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 400,
              background: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
            }}
          >
            Loading bays…
          </div>
        )}

        {apiError && (
          <div
            style={{
              position: 'absolute',
              top: 72,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 520,
              maxWidth: 'min(420px, 92vw)',
              background: '#fff7ed',
              border: '1px solid #fdba74',
              color: '#9a3412',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.45,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}
          >
            <strong>Live data:</strong> {apiError}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  marginLeft: 10,
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: '1px solid #ea580c',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            width: 'calc(100% - 28px)',
            maxWidth: 560,
            zIndex: 500,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              pointerEvents: 'all',
            }}
          >
            <SearchBar
              destination={destination}
              onPick={handlePickLandmark}
              onClear={clearDestination}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[{ d: 0.3, label: '+' }, { d: -0.3, label: '−' }].map(({ d, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => zoomBy(d)}
                  style={{
                    width: 40,
                    height: 40,
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 18,
                    fontWeight: 600,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 7,
              overflowX: 'auto',
              width: '100%',
              paddingBottom: 2,
              pointerEvents: 'all',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.id
              const s = f.activeStyle
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 100,
                    border: `1.5px solid ${isActive ? s.border : 'rgba(255,255,255,0.9)'}`,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: isActive ? s.bg : 'white',
                    color: isActive ? s.color : '#4b5563',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'white',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 100,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            color: '#6b7280',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: '#3fa73f',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'mp-pulse 2s infinite',
            }}
          />
          <span title="Last data refresh">Updated {tsStr}</span>
        </div>

        {destination && (
          <div
            style={{
              position: 'absolute',
              top: 118,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 500,
              background: '#1a3353',
              color: 'white',
              borderRadius: 100,
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: 'calc(100% - 28px)',
            }}
          >
            <span>{proxFreeSpots > 0 ? '🟢' : '🔴'}</span>
            <span>
              {proxFreeSpots} free spot{proxFreeSpots !== 1 ? 's' : ''} across&nbsp;
              {proxFreeBays} bay{proxFreeBays !== 1 ? 's' : ''} within 400 m of {destination.name}
            </span>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: sheetOpen ? 'calc(75vh + 14px)' : 290,
            left: 14,
            zIndex: 500,
            background: 'white',
            borderRadius: 100,
            padding: '7px 14px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            fontSize: 13,
            fontWeight: 600,
            color: '#111827',
            transition: 'bottom 0.4s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <span style={{ color: '#3fa73f' }}>{visibleBays.length}</span> bays shown
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: sheetOpen ? 'calc(75vh + 14px)' : 290,
            right: 14,
            zIndex: 500,
            background: 'white',
            borderRadius: 12,
            padding: '10px 13px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            transition: 'bottom 0.4s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#9ca3af',
              marginBottom: 7,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Bay Status
          </div>
          {[
            ['#3fa73f', 'Available'],
            ['#f97316', 'Rule Trap'],
            ['#ef4444', 'Occupied'],
          ].map(([c, l]) => (
            <div
              key={l}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                color: '#4b5563',
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: c,
                  flexShrink: 0,
                }}
              />
              {l}
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 550,
            background: 'white',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.14)',
            transform: sheetOpen ? 'translateY(0)' : 'translateY(calc(100% - 260px))',
            transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)',
            maxHeight: '75vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              background: '#e5e7eb',
              borderRadius: 2,
              margin: '12px auto 0',
              flexShrink: 0,
              cursor: 'grab',
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSheetOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSheetOpen((o) => !o)
            }}
            style={{
              padding: '12px 20px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {destination ? `Near ${destination.name}` : 'Nearby Bays'}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                {visibleBays.length} bay{visibleBays.length !== 1 ? 's' : ''} · Data updated {tsStr}
              </div>
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              {sheetOpen ? '↓' : '↑'}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <BayList
              visibleBays={visibleBays}
              selectedBayId={selectedBayId}
              destination={destination}
              onSelect={(id) => {
                setSelectedBayId(id)
                setSheetOpen(false)
              }}
            />
          </div>
        </div>

        {selectedBay && (
          <BayDetailPanel
            bay={selectedBay}
            destination={destination}
            onClose={() => setSelectedBayId(null)}
            isMobile={isMobile}
            lastUpdated={lastUpdated}
            reserveBottomPx={isMobile ? 0 : SHEET_PEEK_PX}
          />
        )}
      </div>
    </div>
  )
}
