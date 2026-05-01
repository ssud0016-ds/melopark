import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import ParkingMap from './ParkingMap'
import OnboardingOverlay from './OnboardingOverlay'
import SearchBar from '../search/SearchBar'
import BayDetailSheet from '../bay/BayDetailSheet'
import FilterChips from '../feedback/FilterChips'
import DecisionCard from '../pressure/DecisionCard'
import ZoneDetailPanel from '../pressure/ZoneDetailPanel'
import PressureLegend from '../pressure/PressureLegend'
import TimeHorizonSelector from '../pressure/TimeHorizonSelector'
import { useMapState } from '../../hooks/useMapState'
import { usePressure, useAlternatives } from '../../hooks/usePressure'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useDebouncedPlannerParams } from '../../hooks/useDebouncedPlannerParams'
import { fetchAccessibilityNearby, fetchEvaluateBulk } from '../../services/apiBays'
import {
  DEFAULT_PLANNER_DURATION_MINS,
  formatAtDateTime,
  melbourneWallClockToAwareIso,
  toMelbourneDateTimeInputValue,
} from '../../utils/plannerTime'
import { getStatusFillColor } from './ParkingMap'

function splitMelbourneDateTimeParts(iso) {
  const dt = toMelbourneDateTimeInputValue(iso)
  if (!dt) return { date: '', time: '' }
  const [date, time] = dt.split('T')
  return { date: date || '', time: time || '' }
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
    accessibilityMode,
    setAccessibilityMode,
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

  // ── Epic 5: Pressure map state ──
  const [pressureEnabled, setPressureEnabled] = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const { zones: pressureZones, hulls: pressureHulls, horizon, setHorizon, loading: pressureLoading } =
    usePressure(pressureEnabled)
  const { data: alternativesData } = useAlternatives(
    destination?.lat, destination?.lng, null, !!(pressureEnabled && destination),
  )

  const togglePressure = useCallback(() => {
    setPressureEnabled((v) => {
      if (!v) setMapBaysAtPlannedTime(false) // mutual exclusion with planner
      return !v
    })
  }, [])

  const handlePressureZoneClick = useCallback((zone) => {
    setSelectedZone(zone)
  }, [])

  const handleAlternativeClick = useCallback((alt) => {
    setSelectedZone(null)
    if (mapRef.current) {
      mapRef.current.flyTo([alt.centroid_lat, alt.centroid_lon], 17, { duration: 0.8 })
    }
  }, [])

  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.sessionStorage.getItem('melopark.onboarded')
  })

  const dismissOnboarding = useCallback(() => {
    try {
      window.sessionStorage.setItem('melopark.onboarded', '1')
    } catch (_e) {}
    setShowOnboarding(false)
  }, [])

  const handleOnboardingPick = useCallback((lm, arrivalIso = null, opts = null) => {
    pickDestination(lm)
    if (opts?.activeFilter) setActiveFilter(opts.activeFilter)
    if (opts?.parkingType === 'accessible') {
      setAccessibilityMode(true)
      setAccessibilityAvailableOnly(true)
    } else {
      setAccessibilityMode(false)
    }
    if (arrivalIso) {
      setPlannerArrivalIso(arrivalIso)
      setPlannerDurationMins(DEFAULT_PLANNER_DURATION_MINS)
      setMapBaysAtPlannedTime(true)
    }
    dismissOnboarding()
  }, [pickDestination, dismissOnboarding, setActiveFilter, setAccessibilityMode])

  const [mapBounds, setMapBounds] = useState(null)
  const [bulkVerdictById, setBulkVerdictById] = useState({})
  const [showArrivePicker, setShowArrivePicker] = useState(false)
  const [accessibilityNearby, setAccessibilityNearby] = useState([])
  const [accessibilityLoading, setAccessibilityLoading] = useState(false)
  const [accessibilityError, setAccessibilityError] = useState(null)
  const [accessibilityAvailableOnly, setAccessibilityAvailableOnly] = useState(false)

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
    if (!accessibilityAvailableOnly) {
      setAccessibilityError(null)
      setAccessibilityLoading(false)
      return
    }

    let cancelled = false
    setAccessibilityLoading(true)
    setAccessibilityError(null)

    const targetLat = destination?.lat ?? defaultMapCenter[0]
    const targetLon = destination?.lng ?? defaultMapCenter[1]

    fetchAccessibilityNearby({
      lat: targetLat,
      lon: targetLon,
      radiusM: 20000,
      topN: 1500,
      availableOnly: false,
    })
      .then((data) => {
        if (cancelled) return
        setAccessibilityNearby(Array.isArray(data?.bays) ? data.bays : [])
      })
      .catch((err) => {
        if (cancelled) return
        setAccessibilityNearby([])
        setAccessibilityError(err instanceof Error ? err.message : 'Could not load accessibility bays')
      })
      .finally(() => {
        if (!cancelled) setAccessibilityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessibilityAvailableOnly, destination, defaultMapCenter])

  useEffect(() => {
    setBaysRef(bays)
  }, [bays, setBaysRef])

  const visibleBays = getVisibleBays(bays)
  const proximityBays = getProximityBays(bays)
  const accessibleBayIds = useMemo(
    () => new Set(accessibilityNearby.map((b) => String(b.bay_id))),
    [accessibilityNearby],
  )

  const mapBays = useMemo(() => {
    if (!accessibilityAvailableOnly) return bays
    return bays.filter((b) => accessibleBayIds.has(String(b.id)))
  }, [bays, accessibilityAvailableOnly, accessibleBayIds])

  const mapVisibleBays = useMemo(() => {
    if (!accessibilityAvailableOnly) return visibleBays
    return visibleBays.filter((b) => accessibleBayIds.has(String(b.id)))
  }, [visibleBays, accessibilityAvailableOnly, accessibleBayIds])

  const mapProximityBays = useMemo(() => {
    if (!accessibilityAvailableOnly) return proximityBays
    return proximityBays.filter((b) => accessibleBayIds.has(String(b.id)))
  }, [proximityBays, accessibilityAvailableOnly, accessibleBayIds])

  const selectedBay = mapBays.find((b) => b.id === selectedBayId) || null

  const {
    verifiedCount,
    limitedCount,
    proxFreeSpots,
    proxFreeBays,
    proxLimitedCount,
    proxModeLabel,
  } = useMemo(() => {
    // hasRules === parking API has_restriction_data (CoM cache); not evaluate coverage.
    const verified = mapVisibleBays.filter((b) => b.hasRules)
    const limited = mapVisibleBays.filter((b) => !b.hasRules)
    const proxVerified = mapProximityBays.filter((b) => b.hasRules)
    const proxLimited = mapProximityBays.filter((b) => !b.hasRules)

    const proxLive = mapProximityBays.filter((b) => b.source === 'live')
    const proxLiveAvailable = proxLive.filter((b) => b.type === 'available')

    return {
      verifiedCount: verified.length,
      limitedCount: limited.length,
      proxFreeSpots: showLimitedBays
        ? proxVerified.reduce((a, b) => a + (b.type === 'available' ? b.free : 0), 0)
        : proxLiveAvailable.reduce((a, b) => a + (b.free || 0), 0),
      proxFreeBays: showLimitedBays ? proxVerified.filter((b) => b.type === 'available').length : proxLiveAvailable.length,
      proxLimitedCount: proxLimited.length,
      proxModeLabel: showLimitedBays ? 'verified bay' : 'live bay',
    }
  }, [mapVisibleBays, mapProximityBays, showLimitedBays])

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const [legendOpen, setLegendOpen] = useState(false)
  const [colorBlindMode, setColorBlindMode] = useState(false)
  useEffect(() => {
    if (!isMobile) setLegendOpen(true)
    else setLegendOpen(false)
  }, [isMobile])

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
  /** Keep search + filters the same max width as the default map view (do not stretch when bay sheet opens). */
  const TOOLBAR_MAX_PX = 560
  const FILTER_RIGHT_RESERVE_PX = isMobile ? 0 : (selectedBay ? 76 : 24)
  const ZOOM_GROUP_WIDTH_PX = 72

  const activeFilterLabel = useMemo(() => {
    if (activeFilter === 'all') return 'All bays'
    if (activeFilter === 'available') return 'Available'
    if (activeFilter === 'trap') return 'Caution'
    if (activeFilter === 'lt1h') return 'Less than 1h parking'
    if (activeFilter === '1h') return '1h parking'
    if (activeFilter === '2h') return '2h parking'
    if (activeFilter === '3h') return '3h parking'
    if (activeFilter === '4h') return '4h parking'
    return 'All bays'
  }, [activeFilter])

  const { date: arriveDate, time: arriveTime } = splitMelbourneDateTimeParts(plannerArrivalIso)

  const isCustomScope = activeFilter !== 'all' || Boolean(plannerArrivalIso)
  const scopePill = isCustomScope ? (
    <div className="shrink-0 rounded-md border border-brand-300 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-900 shadow-sm dark:border-brand-300/80 dark:bg-brand-50 dark:text-brand-900">
      {activeFilterLabel}
      {plannerArrivalIso ? ` · ${arriveDate || '-'} ${arriveTime || ''}` : ''}
    </div>
  ) : null

  const updateArriveBy = useCallback((nextDate, nextTime) => {
    if (!nextDate || !nextTime) return
    const [ys, mos, ds] = nextDate.split('-').map(Number)
    const [hh, mm] = nextTime.split(':').map(Number)
    if (![ys, mos, ds, hh, mm].every((n) => Number.isFinite(n))) return
    setPlannerArrivalIso(melbourneWallClockToAwareIso(ys, mos, ds, hh, mm, 0))
    setPlannerDurationMins((prev) => (prev == null ? DEFAULT_PLANNER_DURATION_MINS : prev))
    setMapBaysAtPlannedTime(true)
  }, [])

  const mapTopRightControls = (
    <div className="relative flex flex-nowrap items-start gap-2">
      <button
        type="button"
        onClick={togglePressure}
        aria-pressed={pressureEnabled}
        aria-label={pressureEnabled ? 'Hide parking pressure' : 'Show parking pressure'}
        className={`flex h-[64px] w-[64px] flex-col items-center justify-center gap-1 rounded-2xl shadow-map-float transition-colors sm:h-[74px] sm:w-[74px] ${
          pressureEnabled
            ? 'border border-brand bg-brand-50 text-brand dark:border-brand-300 dark:bg-brand-100/35 dark:text-brand-100'
            : 'border border-slate-200 bg-white text-gray-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark'
        }`}
        title={pressureEnabled ? 'Pressure map: ON' : 'Pressure map: OFF'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 17h4V9H3v8zm6 0h4V3H9v14zm6 0h4v-6h-4v6z" fill="currentColor" />
        </svg>
        <span className="text-[9px] font-semibold leading-none">Pressure</span>
      </button>
      <button
        type="button"
        onClick={() => setColorBlindMode((v) => !v)}
        aria-pressed={colorBlindMode}
        aria-label={colorBlindMode ? 'Disable color-blind mode' : 'Enable color-blind mode'}
        className={`flex h-[64px] w-[64px] flex-col items-center justify-center gap-1 rounded-2xl shadow-map-float transition-colors sm:h-[74px] sm:w-[74px] ${
          colorBlindMode
            ? 'border border-brand bg-brand-50 text-brand dark:border-brand-300 dark:bg-brand-100/35 dark:text-brand-100'
            : 'border border-slate-200 bg-white text-gray-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark'
        }`}
        title={colorBlindMode ? 'Color-blind palette: ON' : 'Color-blind palette: OFF'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 12h16M4 7h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span className="text-[9px] font-semibold leading-none">{colorBlindMode ? 'CB ON' : 'CB OFF'}</span>
      </button>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowArrivePicker((v) => !v)}
          aria-expanded={showArrivePicker}
          aria-label={showArrivePicker ? 'Hide arrive by picker' : 'Show arrive by picker'}
          className={`flex h-[64px] w-[64px] flex-col items-center justify-center gap-1 rounded-2xl shadow-map-float transition-colors sm:h-[74px] sm:w-[74px] ${
            showArrivePicker
              ? 'border border-brand bg-brand-50 text-brand dark:border-brand-300 dark:bg-brand-100/35 dark:text-brand-100'
              : 'border border-slate-200 bg-white text-gray-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 7.5v5l3.5 2.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <span className="text-[10px] font-semibold leading-none">Time</span>
        </button>
      </div>
      {showArrivePicker && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[700] w-[min(280px,calc(100vw-24px))] rounded-xl border border-gray-200/90 bg-white/98 p-2 shadow-card-lg dark:border-gray-700 dark:bg-surface-dark-secondary/98">
          <div className="flex flex-col gap-2">
            <label className="rounded-lg border border-gray-200/80 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-surface-dark-secondary">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Date
              </span>
              <input
                type="date"
                value={arriveDate}
                onChange={(e) => updateArriveBy(e.target.value, arriveTime)}
                className="h-8 w-full rounded-md border border-gray-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100"
              />
            </label>
            <label className="rounded-lg border border-gray-200/80 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-surface-dark-secondary">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Time
              </span>
              <input
                type="time"
                value={arriveTime}
                onChange={(e) => updateArriveBy(arriveDate, e.target.value)}
                className="h-8 w-full rounded-md border border-gray-200/80 bg-white px-2 py-0.5 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:bg-surface-dark dark:text-gray-100"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden">
      <div className="relative w-full flex-1 min-h-0 overflow-hidden">
        <ParkingMap
          bays={mapBays}
          visibleBays={mapVisibleBays}
          proximityBays={mapProximityBays}
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
          isMobile={isMobile}
          hideHint={isMobile && legendOpen}
          pressureEnabled={pressureEnabled}
          pressureHulls={pressureHulls}
          pressureZones={pressureZones}
          onPressureZoneClick={handlePressureZoneClick}
          colorBlindMode={colorBlindMode}
        />

        {accessibilityMode && (
          <div
            className={`absolute left-3.5 z-[510] rounded-xl border border-brand bg-white/95 px-3 py-2 text-xs font-semibold text-brand shadow-card dark:border-brand-300/70 dark:bg-surface-dark-secondary/95 dark:text-brand-100 ${
              isMobile ? 'top-[204px]' : 'top-[84px]'
            }`}
            aria-label="Accessibility mode enabled: showing disability bays only"
          >
            Accessibility mode: DIS bays only
          </div>
        )}

        {apiLoading && (
          <div className="absolute inset-0 z-[400] bg-white/35 dark:bg-black/25 pointer-events-none flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            Loading bays...
          </div>
        )}

        {apiError && (
          <div
            className={`absolute z-[520] max-w-[min(420px,92vw)] bg-trap-50 border border-trap-300 text-orange-800 dark:text-orange-200 rounded-xl shadow-overlay ${
              isMobile
                ? 'top-[204px] px-2.5 py-1.5 text-xs leading-snug'
                : 'top-[72px] px-3.5 py-2.5 text-sm leading-relaxed'
            }`}
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

        {isMobile ? (
          <div
            data-testid="map-toolbar-mobile-stack"
            className="absolute top-3.5 left-3.5 right-3.5 z-[500] flex flex-col gap-2 pointer-events-none"
          >
            <div className="flex flex-col gap-2.5 w-full pointer-events-auto">
              <div className="flex items-center gap-2 w-full">
                <div className="min-w-0 flex-1">
                  <SearchBar destination={destination} onPick={handlePickLandmark} onClear={clearDestination} />
                </div>
                <div className="flex flex-row gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAccessibilityAvailableOnly((v) => !v)}
                    aria-label={accessibilityAvailableOnly ? 'Disable accessibility filter' : 'Enable accessibility filter'}
                    title={accessibilityAvailableOnly ? 'Accessibility filter ON' : 'Accessibility filter OFF'}
                    className={`flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 font-sans text-sm font-semibold shadow-map-float transition-colors ${
                      accessibilityAvailableOnly
                        ? 'border border-brand bg-brand-50 text-brand dark:border-brand-300 dark:bg-brand-100/35 dark:text-brand-100'
                        : 'border border-slate-200 bg-white text-gray-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark-secondary'
                    }`}
                  >
                    ♿
                  </button>
                  {[{ delta: 1, label: '+' }, { delta: -1, label: '−' }].map(({ delta, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => zoomBy(delta)}
                      aria-label={delta > 0 ? 'Zoom in' : 'Zoom out'}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white font-sans text-base font-semibold text-gray-700 shadow-map-float transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark-secondary"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-1 flex w-full items-center gap-2">
                <div className="min-w-0 flex-1">
                  <FilterChips activeFilter={activeFilter} onFilterChange={setActiveFilter} />
                </div>
                {scopePill}
              </div>

              <div className="w-full min-w-0 overflow-x-auto overflow-y-visible overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:thin]">
                <div className="pointer-events-auto ml-auto w-max max-w-full min-w-0 pl-1">{mapTopRightControls}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              data-testid="map-toolbar-desktop"
              className="absolute top-3.5 flex flex-col items-center gap-2.5 z-[500] pointer-events-none"
              style={
                desktopSheetReservePx
                  ? {
                      /* Centre within strip [14px, 100% − rightInset] so it matches "main" feel with sheet open */
                      left: `calc(14px + (100% - 14px - ${rightInsetPx}px) / 2)`,
                      transform: 'translateX(-50%)',
                      width: `min(${TOOLBAR_MAX_PX}px, calc(100% - ${14 + rightInsetPx}px))`,
                      maxWidth: TOOLBAR_MAX_PX,
                    }
                  : {
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 'calc(100% - 28px)',
                      maxWidth: TOOLBAR_MAX_PX,
                    }
              }
            >
              <div
                className="flex items-center gap-2 w-full pointer-events-auto"
                style={FILTER_RIGHT_RESERVE_PX ? { paddingRight: FILTER_RIGHT_RESERVE_PX } : undefined}
              >
                <div className="min-w-0 flex-1 max-w-[580px]">
                  <SearchBar destination={destination} onPick={handlePickLandmark} onClear={clearDestination} />
                </div>
                <div className="flex flex-row gap-1">
                  <button
                    type="button"
                    onClick={() => setAccessibilityAvailableOnly((v) => !v)}
                    aria-label={accessibilityAvailableOnly ? 'Disable accessibility filter' : 'Enable accessibility filter'}
                    title={accessibilityAvailableOnly ? 'Accessibility filter ON' : 'Accessibility filter OFF'}
                    className={`flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 font-sans text-sm font-semibold shadow-map-float transition-colors ${
                      accessibilityAvailableOnly
                        ? 'border border-brand bg-brand-50 text-brand dark:border-brand-300 dark:bg-brand-100/35 dark:text-brand-100'
                        : 'border border-slate-200 bg-white text-gray-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark-secondary'
                    }`}
                  >
                    ♿
                  </button>
                  {[{ delta: 1, label: '+' }, { delta: -1, label: '−' }].map(({ delta, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => zoomBy(delta)}
                      aria-label={delta > 0 ? 'Zoom in' : 'Zoom out'}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white font-sans text-base font-semibold text-gray-700 shadow-map-float transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark-secondary"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="w-full pointer-events-auto"
                style={FILTER_RIGHT_RESERVE_PX ? { paddingRight: FILTER_RIGHT_RESERVE_PX } : undefined}
              >
                <div
                  className="mt-1 flex items-center gap-2"
                  style={{ width: `calc(100% - ${ZOOM_GROUP_WIDTH_PX}px)`, maxWidth: 'calc(580px - 72px)' }}
                >
                  <div className="min-w-0 flex-1">
                    <FilterChips activeFilter={activeFilter} onFilterChange={setActiveFilter} />
                  </div>
                  {scopePill}
                </div>
              </div>
            </div>

            <div
              className="absolute top-5 z-[600] pointer-events-auto"
              style={{ right: rightInsetPx }}
            >
              {mapTopRightControls}
            </div>
          </>
        )}

        {destination && (
          <div
            className="absolute bottom-3.5 z-[500] bg-surface-secondary text-gray-900 rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-overlay flex flex-col items-center gap-0.5 max-w-[calc(100%-120px)] border-2 border-brand"
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          >
            <span>
              {proxFreeSpots} free spot{proxFreeSpots !== 1 ? 's' : ''} across&nbsp;
              {proxFreeBays} {proxModeLabel}
              {proxFreeBays !== 1 ? 's' : ''} within 400 m of {destination.name}
            </span>
            {!showLimitedBays && proxLimitedCount > 0 && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                +{proxLimitedCount} no CoM row nearby
              </span>
            )}
          </div>
        )}

        {accessibilityAvailableOnly && (accessibilityLoading || accessibilityError) && (
          <div
            className={`absolute left-3.5 z-[510] rounded-xl border border-gray-200/80 bg-white/95 px-3 py-2 text-xs shadow-card-lg dark:border-gray-700 dark:bg-surface-dark-secondary/95 ${
              isMobile ? 'top-[260px]' : 'top-[126px]'
            }`}
          >
            {accessibilityLoading && (
              <div className="text-gray-600 dark:text-gray-300">Loading accessible bays...</div>
            )}
            {!accessibilityLoading && accessibilityError && (
              <div className="text-trap">{accessibilityError}</div>
            )}
          </div>
        )}

        <div
          className="group absolute bottom-3.5 left-3.5 z-[500] rounded-xl border border-brand bg-brand px-2.5 py-1 sm:px-3.5 sm:py-1.5 shadow-overlay dark:border-brand-300/80 dark:bg-brand-50 flex flex-col cursor-help max-w-[45vw] sm:max-w-none"
          aria-label="Bays with CoM restriction data on the parking feed (has_restriction_data)"
        >
          <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden w-64 rounded-lg border border-brand-800/80 bg-brand px-3 py-2.5 text-xs text-white shadow-card-lg group-hover:block dark:border-brand-300/70 dark:bg-surface-dark-secondary dark:text-gray-100">
            <div className="font-semibold text-white dark:text-white">What are verified bays?</div>
            <div className="mt-1 leading-relaxed">
              Count matches live parking API <span className="whitespace-nowrap">has_restriction_data</span> (CoM restrictions cache).
              All bays can be opened; full verdicts come from the evaluate API.
            </div>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-white dark:text-brand-900 whitespace-nowrap">
            {verifiedCount} verified bay{verifiedCount !== 1 ? 's' : ''}
          </span>
          {!showLimitedBays && limitedCount > 0 && (
            <span className="text-[10px] sm:text-[11px] font-medium text-white/65 dark:text-brand-900/55 whitespace-nowrap">
              +{limitedCount} no CoM row
            </span>
          )}
        </div>

        {(() => {
          const availableColor = getStatusFillColor('available', colorBlindMode)
          const cautionColor = getStatusFillColor('caution', colorBlindMode)
          const occupiedColor = getStatusFillColor('occupied', colorBlindMode)
          const rows = [
            {
              dotClass: '',
              color: availableColor,
              label: 'Available parking spots',
              symbolClass: 'legend-symbol-available',
            },
            {
              dotClass: '',
              color: cautionColor,
              label: 'Caution: Tow Away / Loading Zone',
              symbolClass: 'legend-symbol-caution',
            },
            {
              dotClass: '',
              color: occupiedColor,
              label: 'Parking spots occupied',
              symbolClass: 'legend-symbol-occupied',
            },
          ]
          return (
            <div
              className="absolute bottom-3.5 z-[500] rounded-xl border border-brand bg-brand shadow-overlay dark:border-brand-300/80 dark:bg-brand-50"
              style={{ right: rightInsetPx }}
            >
              {isMobile && !legendOpen ? (
                <button
                  type="button"
                  onClick={() => setLegendOpen(true)}
                  aria-label="Show legend"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer"
                >
                  {rows.map(({ dotClass, symbolClass, color }) => (
                    <span
                      key={symbolClass}
                      className={`${dotClass} ${symbolClass} h-2.5 w-2.5 shrink-0 rounded-full`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="ml-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85 dark:text-brand-800/90">
                    Legend
                  </span>
                </button>
              ) : (
                <div className="p-2.5 max-w-[88vw] sm:max-w-none">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80 dark:text-brand-800/90">
                      Verified bays
                    </span>
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setLegendOpen(false)}
                        aria-label="Hide legend"
                        className="text-white/80 hover:text-white dark:text-brand-800/90 dark:hover:text-brand-900 cursor-pointer text-base leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {rows.map(({ dotClass, label, symbolClass, color }) => (
                    <div key={label} className="mb-1 flex items-center gap-1.5 text-[11px] sm:text-xs text-white/95 dark:text-brand-900">
                      <div
                        className={`${dotClass} ${symbolClass} h-2.5 w-2.5 shrink-0 rounded-full`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Epic 5: Pressure overlays ── */}
        {pressureEnabled && (
          <div className="absolute left-3.5 top-[168px] z-[520] sm:top-[128px]">
            <TimeHorizonSelector value={horizon} onChange={setHorizon} />
          </div>
        )}

        {pressureEnabled && (
          <div className="absolute bottom-28 left-3.5 z-[510] sm:bottom-20">
            <PressureLegend />
          </div>
        )}

        {selectedZone && !destination && (
          <div className="absolute bottom-28 right-3 z-[520] w-72 sm:bottom-6">
            <ZoneDetailPanel zone={selectedZone} onClose={() => setSelectedZone(null)} />
          </div>
        )}

        {pressureEnabled && destination && alternativesData && (
          <div className="absolute bottom-28 right-3 z-[520] w-80 sm:bottom-6">
            <DecisionCard
              target={alternativesData.target}
              alternatives={alternativesData.alternatives}
              destinationName={destination?.name || destination?.label}
              onAlternativeClick={handleAlternativeClick}
              onClose={() => setPressureEnabled(false)}
            />
          </div>
        )}

        {showOnboarding && (
          <OnboardingOverlay onPick={handleOnboardingPick} onSkip={dismissOnboarding} />
        )}

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
