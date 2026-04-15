import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import ParkingMap from './ParkingMap'
import SearchBar from '../search/SearchBar'
import BayDetailSheet from '../bay/BayDetailSheet'
import BayList from '../bay/BayList'
import FilterChips from '../feedback/FilterChips'
import BottomSheet, { SNAP_PEEK, SNAP_HALF, SNAP_FULL } from '../layout/BottomSheet'
import { useMapState } from '../../hooks/useMapState'
import { cn } from '../../utils/cn'

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
    sheetSnap,
    setSheetSnap,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter,
    defaultMapZoom,
    destinationMapZoom,
  } = useMapState()

  const visibleBays = getVisibleBays(bays)
  const proximityBays = getProximityBays(bays)
  const selectedBay = bays.find((b) => b.id === selectedBayId) || null

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    : '\u2014'

  const handlePickLandmark = useCallback(
    (lm) => pickDestination(lm),
    [pickDestination],
  )

  const handleMapReady = useCallback((map) => {
    mapRef.current = map
  }, [])

  const zoomBy = useCallback((delta) => {
    const m = mapRef.current
    if (!m) return
    m.setZoom(Math.max(12, Math.min(19, m.getZoom() + delta)))
  }, [])

  const handleBayClick = useCallback(
    (bay) => setSelectedBayId(bay ? bay.id : null),
    [setSelectedBayId],
  )

  // Collapse sheet when a bay detail opens
  useEffect(() => {
    if (selectedBay) setSheetSnap(SNAP_PEEK)
  }, [selectedBay, setSheetSnap])

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const sheetHeightPx = sheetSnap * vh

  // Height available for the BayList inside the sheet (minus header ~72px)
  const listHeight = Math.max(120, sheetHeightPx - 72)

  // Don't render the heavy bay list on mobile when BayDetailSheet covers everything
  const hideBayList = isMobile && !!selectedBay

  // Bottom offset for floating UI elements that sit above the sheet
  const floatingBottom = useMemo(() => {
    return Math.round(sheetHeightPx + 14)
  }, [sheetHeightPx])

  return (
    <div className="pt-16 h-screen overflow-hidden">
      <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden">
        {/* Map */}
        <ParkingMap
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

        {/* Loading overlay */}
        {apiLoading && (
          <div className="absolute inset-0 z-[400] bg-white/35 dark:bg-black/25 pointer-events-none flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            Loading bays...
          </div>
        )}

        {/* Error banner */}
        {apiError && (
          <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-[520] max-w-[min(420px,92vw)] bg-trap-50 border border-trap-300 text-orange-800 dark:text-orange-200 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed shadow-overlay">
            <strong>Live data:</strong> {apiError}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="ml-2.5 px-2.5 py-1 rounded-lg border border-trap bg-white dark:bg-surface-dark-secondary cursor-pointer font-semibold text-xs"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Top overlay: search + zoom + filters */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 w-[calc(100%-28px)] max-w-[560px] z-[500] pointer-events-none">
          <div className="flex items-center gap-2.5 w-full pointer-events-auto">
            <SearchBar
              destination={destination}
              onPick={handlePickLandmark}
              onClear={clearDestination}
            />
            <div className="flex flex-col gap-1">
              {[
                { delta: 0.3, label: '+' },
                { delta: -0.3, label: '\u2212' },
              ].map(({ delta, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => zoomBy(delta)}
                  aria-label={delta > 0 ? 'Zoom in' : 'Zoom out'}
                  className="w-10 h-10 bg-white dark:bg-surface-dark-secondary border border-gray-200/60 dark:border-gray-700/60 rounded-xl flex items-center justify-center cursor-pointer text-lg font-semibold shadow-card font-sans text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full pointer-events-auto">
            <FilterChips activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          </div>
        </div>

        {/* Live badge (top-right) */}
        <div className="absolute top-3.5 right-3.5 z-[500] flex items-center gap-1.5 bg-white dark:bg-surface-dark-secondary border border-gray-200/60 dark:border-gray-700/60 rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 shadow-card">
          <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse-dot" />
          <span title="Last data refresh">Updated {tsStr}</span>
        </div>

        {/* Destination proximity badge */}
        {destination && (
          <div className="absolute top-[118px] left-1/2 -translate-x-1/2 z-[500] bg-surface-secondary text-gray-900 rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap shadow-overlay flex items-center gap-2 max-w-[calc(100%-28px)]">
            <span>{proxFreeSpots > 0 ? '🟢' : '🔴'}</span>
            <span>
              {proxFreeSpots} free spot{proxFreeSpots !== 1 ? 's' : ''} across&nbsp;
              {proxFreeBays} bay{proxFreeBays !== 1 ? 's' : ''} within 400 m of {destination.name}
            </span>
          </div>
        )}

        {/* Bay count pill (bottom-left) — floats above sheet */}
        <div
          className="absolute left-3.5 z-[500] bg-white dark:bg-surface-dark-secondary rounded-full px-3.5 py-1.5 border border-gray-200/60 dark:border-gray-700/60 shadow-overlay text-sm font-semibold text-gray-900 dark:text-gray-100 transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ bottom: floatingBottom }}
          aria-live="polite"
        >
          <span className="text-brand">{visibleBays.length}</span> bays shown
        </div>

        {/* Legend (bottom-right) — floats above sheet */}
        <div
          className="absolute right-3.5 z-[500] bg-white dark:bg-surface-dark-secondary rounded-xl p-2.5 border border-gray-200/60 dark:border-gray-700/60 shadow-overlay transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ bottom: floatingBottom }}
        >
          <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wider">
            Bay Status
          </div>
          {[
            ['bg-accent', 'Available'],
            ['bg-trap', 'Restricted'],
            ['bg-[#ed6868]', 'Occupied'],
          ].map(([bg, label]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1 last:mb-0">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', bg)} />
              {label}
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="w-3 h-3 rounded-full shrink-0 border-2 border-[#35338c] bg-accent" />
              <span>Has rule info</span>
            </div>
          </div>
        </div>

        {/* Bottom sheet with bay list */}
        <BottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          title={destination ? `Near ${destination.name}` : 'Nearby Bays'}
          subtitle={`${visibleBays.length} bay${visibleBays.length !== 1 ? 's' : ''} \u00b7 Data updated ${tsStr}`}
        >
          {!hideBayList && (
            <BayList
              visibleBays={visibleBays}
              selectedBayId={selectedBayId}
              destination={destination}
              height={listHeight}
              onSelect={(id) => {
                setSelectedBayId(id)
                setSheetSnap(SNAP_PEEK)
              }}
            />
          )}
        </BottomSheet>

        {/* Bay detail panel */}
        {selectedBay && (
          <BayDetailSheet
            bay={selectedBay}
            destination={destination}
            onClose={() => setSelectedBayId(null)}
            isMobile={isMobile}
            lastUpdated={lastUpdated}
            reserveBottomPx={isMobile ? 0 : Math.round(SNAP_PEEK * vh)}
          />
        )}
      </div>
    </div>
  )
}
