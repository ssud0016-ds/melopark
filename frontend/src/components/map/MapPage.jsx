import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import ParkingMap from './ParkingMap'
import SearchBar from '../search/SearchBar'
import BayDetailSheet from '../bay/BayDetailSheet'
import FilterChips from '../feedback/FilterChips'
import { useMapState } from '../../hooks/useMapState'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useDebouncedPlannerParams } from '../../hooks/useDebouncedPlannerParams'
import { fetchEvaluateBulk } from '../../services/apiBays'
import { formatAtDateTime, formatDurationLabel } from '../../utils/plannerTime'

function MapTimeBanner({ arrivalIso, durationMins, onDismiss }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="flex w-full min-w-0 items-center justify-center gap-2 rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-left text-xs font-semibold text-amber-800 shadow-card dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100 cursor-pointer hover:bg-amber-100/90 dark:hover:bg-amber-900/40 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-amber-700 dark:text-amber-200" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <span className="min-w-0 truncate">
        Showing bays at {formatAtDateTime(arrivalIso)} · {formatDurationLabel(durationMins)} stay
      </span>
    </button>
  )
}

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
    showLimitedBays,
    setShowLimitedBays,
    setBaysRef,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter,
    defaultMapZoom,
    destinationMapZoom,
  } = useMapState()

  /** Persisted across bay opens: last debounced plan from the detail sheet. */
  const [plannerArrivalIso, setPlannerArrivalIso] = useState(null)
  const [plannerDurationMins, setPlannerDurationMins] = useState(null)
  /** True after "Show all bays at this time" in the panel. */
  const [mapBaysAtPlannedTime, setMapBaysAtPlannedTime] = useState(false)
  /** Bump to force sheet form reset when banner or Clear resets live mode. */
  const [plannerResetNonce, setPlannerResetNonce] = useState(0)

  const [mapBounds, setMapBounds] = useState(null)
  const [bulkVerdictById, setBulkVerdictById] = useState({})

  const debouncedBounds = useDebouncedValue(mapBounds, 300)

  const plannerParams = useMemo(() => {
    if (!plannerArrivalIso || plannerDurationMins == null) return null
    return { arrivalIso: plannerArrivalIso, durationMins: plannerDurationMins }
  }, [plannerArrivalIso, plannerDurationMins])

  const debouncedPlannerForBulk = useDebouncedPlannerParams(
    mapBaysAtPlannedTime ? plannerParams : null,
    300,
  )

  const handleMapBounds = useCallback((b) => {
    setMapBounds(b)
  }, [])

  const handleDebouncedPlannerFromSheet = useCallback((p) => {
    if (!p) {
      setPlannerArrivalIso(null)
      setPlannerDurationMins(null)
      return
    }
    setPlannerArrivalIso(p.arrivalIso)
    setPlannerDurationMins(p.durationMins)
  }, [])

  const resetPlannerToLive = useCallback(() => {
    setPlannerArrivalIso(null)
    setPlannerDurationMins(null)
    setMapBaysAtPlannedTime(false)
    setPlannerResetNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!mapBaysAtPlannedTime) setBulkVerdictById({})
  }, [mapBaysAtPlannedTime])

  useEffect(() => {
    if (!debouncedPlannerForBulk || !debouncedBounds) return
    let cancelled = false
    const bbox = `${debouncedBounds.south},${debouncedBounds.west},${debouncedBounds.north},${debouncedBounds.east}`
    fetchEvaluateBulk(bbox, debouncedPlannerForBulk).then((rows) => {
      if (cancelled) return
      const next = {}
      for (const r of rows) {
        if (r?.bay_id != null) next[String(r.bay_id)] = r.verdict
      }
      setBulkVerdictById(next)
    })
    return () => {
      cancelled = true
    }
  }, [debouncedPlannerForBulk, debouncedBounds])

  useEffect(() => {
    setBaysRef(bays)
  }, [bays, setBaysRef])

  const visibleBays = getVisibleBays(bays)
  const proximityBays = getProximityBays(bays)
  const selectedBay = bays.find((b) => b.id === selectedBayId) || null

  const { verifiedCount, limitedCount, proxVerifiedFree, proxVerifiedFreeBays, proxLimitedCount } = useMemo(() => {
    const verified = visibleBays.filter((b) => b.hasRules)
    const limited = visibleBays.filter((b) => !b.hasRules)
    const proxVerified = proximityBays.filter((b) => b.hasRules)
    const proxLimited = proximityBays.filter((b) => !b.hasRules)
    return {
      verifiedCount: verified.length,
      limitedCount: limited.length,
      proxVerifiedFree: proxVerified.reduce((a, b) => a + (b.type === 'available' ? b.free : 0), 0),
      proxVerifiedFreeBays: proxVerified.filter((b) => b.type === 'available').length,
      proxLimitedCount: proxLimited.length,
    }
  }, [visibleBays, proximityBays])

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const tsStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '–'

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

  const showMapTimeBanner = mapBaysAtPlannedTime && plannerArrivalIso && plannerDurationMins != null

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
          onBoundsChange={handleMapBounds}
          plannerMapActive={mapBaysAtPlannedTime && Boolean(plannerParams)}
          verdictByBayId={bulkVerdictById}
          showLimitedBays={showLimitedBays}
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

          <div className="w-full pointer-events-auto min-w-0">
            <FilterChips
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              showLimitedBays={showLimitedBays}
              onToggleLimitedBays={setShowLimitedBays}
            />
          </div>

          {showMapTimeBanner && (
            <div className="w-full pointer-events-auto min-w-0 mt-0.5">
              <MapTimeBanner
                arrivalIso={plannerArrivalIso}
                durationMins={plannerDurationMins}
                onDismiss={resetPlannerToLive}
              />
            </div>
          )}
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
            className="absolute bottom-3.5 z-[500] bg-surface-secondary text-gray-900 rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-overlay flex flex-col items-center gap-0.5 max-w-[calc(100%-120px)] border-2 border-brand"
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          >
            <span>
              {proxVerifiedFree} free spot{proxVerifiedFree !== 1 ? 's' : ''} across&nbsp;
              {proxVerifiedFreeBays} verified bay{proxVerifiedFreeBays !== 1 ? 's' : ''} within 400 m of {destination.name}
            </span>
            {proxLimitedCount > 0 && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                +{proxLimitedCount} sensor-only nearby
              </span>
            )}
          </div>
        )}

        <div className="absolute bottom-3.5 left-3.5 z-[500] rounded-xl border border-brand bg-brand px-3.5 py-1.5 shadow-overlay dark:border-brand-300/80 dark:bg-brand-50 flex flex-col">
          <span className="text-sm font-semibold text-white dark:text-brand-900">
            {verifiedCount} verified bay{verifiedCount !== 1 ? 's' : ''}
          </span>
          {showLimitedBays && limitedCount > 0 && (
            <span className="text-[11px] font-medium text-white/65 dark:text-brand-900/55">
              +{limitedCount} sensor only
            </span>
          )}
        </div>

        <div
          className="absolute bottom-3.5 z-[500] rounded-xl border border-brand bg-brand p-2.5 shadow-overlay dark:border-brand-300/80 dark:bg-brand-50"
          style={{ right: rightInsetPx }}
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 dark:text-brand-800/90">
            Verified bays
          </div>
          {[
            ['bg-[#a3ec48]', 'Available (green)'],
            ['bg-[#FFB382]', 'Caution (orange)'],
            ['bg-[#ed6868]', 'Occupied (red)'],
          ].map(([bg, label]) => (
            <div key={label} className="mb-1 flex items-center gap-1.5 text-xs text-white/95 dark:text-brand-900">
              <div className={`${bg} h-2.5 w-2.5 shrink-0 rounded-full`} />
              {label}
            </div>
          ))}
          <div className="mt-2 border-t border-white/20 pt-1.5 dark:border-brand-800/20">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 dark:text-brand-800/90">
              Sensor only
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/75 dark:text-brand-900/70">
              <div className="h-2 w-2 shrink-0 rounded-full bg-gray-400/60" />
              Occupancy only, check signs
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
            savedPlannerArrivalIso={plannerArrivalIso}
            savedPlannerDurationMins={plannerDurationMins}
            onDebouncedPlannerChange={handleDebouncedPlannerFromSheet}
            mapBaysAtPlannedTime={mapBaysAtPlannedTime}
            onShowAllBaysAtThisTime={(p) => {
              if (p) {
                setPlannerArrivalIso(p.arrivalIso)
                setPlannerDurationMins(p.durationMins)
              }
              setMapBaysAtPlannedTime(true)
            }}
            onResetPlannerToLive={resetPlannerToLive}
            plannerResetNonce={plannerResetNonce}
          />
        )}
      </div>
    </div>
  )
}
