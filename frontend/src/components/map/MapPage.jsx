import { useRef, useCallback, useEffect, useState } from 'react'
import ParkingMap from './ParkingMap'
import SearchBar from '../search/SearchBar'
import BayDetailSheet from '../bay/BayDetailSheet'
import FilterChips from '../feedback/FilterChips'
import { useMapState } from '../../hooks/useMapState'

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

  const proxFreeSpots = proximityBays.reduce((a, b) => a + (b.type === 'available' ? b.free : 0), 0)
  const proxFreeBays = proximityBays.filter((b) => b.type === 'available').length

  const tsStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—'

  const handlePickLandmark = useCallback((lm) => pickDestination(lm), [pickDestination])

  const handleMapReady = useCallback((map) => {
    mapRef.current = map
  }, [])

  const zoomBy = useCallback((delta) => {
    const m = mapRef.current
    if (!m) return
    if (delta > 0) m.zoomIn()
    else m.zoomOut()
  }, [])

  const handleBayClick = useCallback(
    (bay) => setSelectedBayId(bay ? bay.id : null),
    [setSelectedBayId],
  )

  const desktopSheetReservePx = selectedBay && !isMobile ? 396 : 0
  const rightInsetPx = 14 + desktopSheetReservePx

  return (
    <div className="pt-16 h-screen overflow-hidden">
      <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden">
        <ParkingMap
          bays={bays}
          visibleBays={visibleBays}
          proximityBays={proximityBays}
          activeFilter={activeFilter}
          selectedBayId={selectedBayId}
          destination={destination}
          onBayClick={handleBayClick}
          onMapReady={handleMapReady}
          defaultCenter={defaultMapCenter}
          defaultZoom={defaultMapZoom}
          destZoom={destinationMapZoom}
        />

        {apiLoading && (
          <div className="absolute inset-0 z-[400] bg-white/35 dark:bg-black/25 pointer-events-none flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            Loading bays...
          </div>
        )}

        {apiError && (
          <div
            className="absolute top-[72px] z-[520] max-w-[min(420px,92vw)] bg-trap-50 border border-trap-300 text-orange-800 dark:text-orange-200 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed shadow-overlay"
            style={
              desktopSheetReservePx
                ? { left: 14, right: rightInsetPx, marginInline: 'auto' }
                : { left: '50%', transform: 'translateX(-50%)' }
            }
          >
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

        <div
          className="absolute top-3.5 flex flex-col items-center gap-2.5 z-[500] pointer-events-none"
          style={
            desktopSheetReservePx
              ? { left: 14, right: rightInsetPx, width: 'auto', maxWidth: 'none' }
              : { left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 28px)', maxWidth: 560 }
          }
        >
          <div className="flex items-center gap-2.5 w-full pointer-events-auto">
            <SearchBar destination={destination} onPick={handlePickLandmark} onClear={clearDestination} />
            <div className="flex flex-col gap-1">
              {[{ delta: 1, label: '+' }, { delta: -1, label: '−' }].map(({ delta, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => zoomBy(delta)}
                  aria-label={delta > 0 ? 'Zoom in' : 'Zoom out'}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-gray-200/60 bg-white font-sans text-lg font-semibold text-gray-700 shadow-card transition-colors hover:bg-gray-50 dark:border-gray-700/60 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark-secondary"
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

        {!selectedBay && (
          <div
            className="absolute top-3.5 z-[500] flex items-center gap-1.5 rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-card dark:border-brand-300/80 dark:bg-brand-50 dark:text-brand-900"
            style={{ right: rightInsetPx }}
          >
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-white/85 dark:bg-brand-700" />
            <span title="Last data refresh">Updated {tsStr}</span>
          </div>
        )}

        {destination && (
          <div
            className="absolute top-[118px] z-[500] bg-surface-secondary text-gray-900 rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap shadow-overlay flex items-center gap-2 max-w-[calc(100%-28px)]"
            style={
              desktopSheetReservePx
                ? { left: 14, right: rightInsetPx, marginInline: 'auto' }
                : { left: '50%', transform: 'translateX(-50%)' }
            }
          >
            <span>{proxFreeSpots > 0 ? '🟢' : '🔴'}</span>
            <span>
              {proxFreeSpots} free spot{proxFreeSpots !== 1 ? 's' : ''} across&nbsp;
              {proxFreeBays} bay{proxFreeBays !== 1 ? 's' : ''} within 400 m of {destination.name}
            </span>
          </div>
        )}

        <div className="absolute bottom-3.5 left-3.5 z-[500] rounded-full border border-brand bg-brand px-3.5 py-1.5 text-sm font-semibold text-white shadow-overlay dark:border-brand-300/80 dark:bg-brand-50 dark:text-brand-900">
          <span className="text-white dark:text-brand-900">{visibleBays.length}</span> bays shown
        </div>

        <div
          className="absolute bottom-3.5 z-[500] rounded-xl border border-brand bg-brand p-2.5 shadow-overlay dark:border-brand-300/80 dark:bg-brand-50"
          style={{ right: rightInsetPx }}
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 dark:text-brand-800/90">
            Bay Status
          </div>
          {[
            ['bg-accent', 'Available'],
            ['bg-[#FFB382]', 'Rule Trap'],
            ['bg-[#ed6868]', 'Occupied'],
          ].map(([bg, label]) => (
            <div key={label} className="mb-1 flex items-center gap-1.5 text-xs text-white/95 last:mb-0 dark:text-brand-900">
              <div className={`${bg} w-2.5 h-2.5 rounded-full shrink-0`} />
              {label}
            </div>
          ))}
          <div className="mt-0.5">
            <div className="flex items-center gap-1.5 text-xs text-white/95 dark:text-brand-900">
              <div className="h-3 w-3 shrink-0 rounded-full border-2 border-[#FFD700] bg-transparent" />
              <span>Has rule info</span>
            </div>
          </div>
        </div>

        {selectedBay && (
          <BayDetailSheet
            bay={selectedBay}
            destination={destination}
            onClose={() => setSelectedBayId(null)}
            isMobile={isMobile}
            lastUpdated={lastUpdated}
            reserveBottomPx={0}
          />
        )}
      </div>
    </div>
  )
}
