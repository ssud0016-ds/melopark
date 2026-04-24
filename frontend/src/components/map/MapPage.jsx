import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import ParkingMap from './ParkingMap'
import OnboardingOverlay from './OnboardingOverlay'
import SearchBar from '../search/SearchBar'
import BayDetailSheet from '../bay/BayDetailSheet'
import FilterChips from '../feedback/FilterChips'
import { useMapState } from '../../hooks/useMapState'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useDebouncedPlannerParams } from '../../hooks/useDebouncedPlannerParams'
import { fetchEvaluateBulk } from '../../services/apiBays'
import { formatAtDateTime, formatDurationLabel } from '../../utils/plannerTime'

function toLocalDateTimeInputValue(iso) {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${da}T${hh}:${mm}`
}

function splitLocalDateTimeParts(iso) {
  const dt = toLocalDateTimeInputValue(iso)
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

  const handleOnboardingPick = useCallback((lm, arrivalIso = null) => {
    pickDestination(lm)
    if (arrivalIso) {
      setPlannerArrivalIso(arrivalIso)
      setPlannerDurationMins(60)
      setMapBaysAtPlannedTime(true)
    }
    dismissOnboarding()
  }, [pickDestination, dismissOnboarding])

  const [mapBounds, setMapBounds] = useState(null)
  const [bulkVerdictById, setBulkVerdictById] = useState({})
  const [showArrivePicker, setShowArrivePicker] = useState(false)
  const [filterCollapsed, setFilterCollapsed] = useState(true)

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

  const {
    verifiedCount,
    limitedCount,
    proxFreeSpots,
    proxFreeBays,
    proxLimitedCount,
    proxModeLabel,
  } = useMemo(() => {
    const verified = visibleBays.filter((b) => b.hasRules)
    const limited = visibleBays.filter((b) => !b.hasRules)
    const proxVerified = proximityBays.filter((b) => b.hasRules)
    const proxLimited = proximityBays.filter((b) => !b.hasRules)

    const proxLive = proximityBays.filter((b) => b.source === 'live')
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
  }, [visibleBays, proximityBays, showLimitedBays])

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  const { date: arriveDate, time: arriveTime } = splitLocalDateTimeParts(plannerArrivalIso)

  const updateArriveBy = useCallback((nextDate, nextTime) => {
    if (!nextDate || !nextTime) return
    setPlannerArrivalIso(`${nextDate}T${nextTime}:00`)
    setPlannerDurationMins((prev) => (prev == null ? 60 : prev))
    setMapBaysAtPlannedTime(true)
  }, [])

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden">
      <div className="relative w-full flex-1 min-h-[600px] overflow-hidden">
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
          isMobile={isMobile}
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
              ? {
                  /* Centre within strip [14px, 100% − rightInset] so it matches “main” feel with sheet open */
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
              {[{ delta: 1, label: '+' }, { delta: -1, label: '−' }].map(({ delta, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => zoomBy(delta)}
                  aria-label={delta > 0 ? 'Zoom in' : 'Zoom out'}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200/60 bg-white font-sans text-base font-semibold text-gray-700 shadow-card transition-colors hover:bg-gray-50 dark:border-gray-700/60 dark:bg-surface-dark-secondary dark:text-gray-100 dark:hover:bg-surface-dark-secondary"
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
              className="mt-1 rounded-lg border border-gray-200/80 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-card backdrop-blur-[1px] dark:border-gray-700/70 dark:bg-surface-dark-secondary/85 dark:text-gray-100"
              style={{ width: `calc(100% - ${ZOOM_GROUP_WIDTH_PX}px)`, maxWidth: 'calc(580px - 72px)' }}
            >
              Currently showing: <span className="text-brand dark:text-brand-100">{activeFilterLabel}</span>
              {' · '}Date: <span className="text-brand dark:text-brand-100">{arriveDate || '-'}</span>
              {' · '}Time: <span className="text-brand dark:text-brand-100">{arriveTime || '-'}</span>
            </div>
          </div>

        </div>

        <div
          className="absolute top-5 z-[500] pointer-events-auto"
          style={{ right: rightInsetPx }}
        >
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowArrivePicker((v) => {
                    const next = !v
                    if (next) setFilterCollapsed(true)
                    return next
                  })
                }
                aria-expanded={showArrivePicker}
                aria-label={showArrivePicker ? 'Hide arrive by picker' : 'Show arrive by picker'}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 bg-white/95 text-gray-600 shadow-card transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-surface-dark-secondary dark:text-gray-200 dark:hover:bg-surface-dark"
              >
                <span aria-hidden className="text-[12px] leading-none">🕒</span>
              </button>
            </div>
            <FilterChips
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              collapsed={filterCollapsed}
              onToggleCollapsed={(nextCollapsed) => {
                if (!nextCollapsed) setShowArrivePicker(false)
                setFilterCollapsed(nextCollapsed)
              }}
            />
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
        </div>

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
                +{proxLimitedCount} sensor-only nearby
              </span>
            )}
          </div>
        )}

        <div
          className="group absolute bottom-3.5 left-3.5 z-[500] rounded-xl border border-brand bg-brand px-3.5 py-1.5 shadow-overlay dark:border-brand-300/80 dark:bg-brand-50 flex flex-col cursor-help"
          aria-label="Verified bays are bays with parking rule data available in MeloPark"
        >
          <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden w-64 rounded-lg border border-brand-800/80 bg-brand px-3 py-2.5 text-xs text-white shadow-card-lg group-hover:block dark:border-brand-300/70 dark:bg-surface-dark-secondary dark:text-gray-100">
            <div className="font-semibold text-white dark:text-white">What are verified bays?</div>
            <div className="mt-1 leading-relaxed">
              Verified bays have parking rule data available in MeloPark. Tap a bay to view its parking rules and limits.
            </div>
          </div>
          <span className="text-sm font-semibold text-white dark:text-brand-900">
            {verifiedCount} verified bay{verifiedCount !== 1 ? 's' : ''}
          </span>
          {!showLimitedBays && limitedCount > 0 && (
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
            ['bg-[#a3ec48]', 'Available parking spots'],
            ['bg-[#FFB382]', 'Caution: Tow Away / Loading Zone'],
            ['bg-[#ed6868]', 'Parking spots occupied'],
          ].map(([bg, label]) => (
            <div key={label} className="mb-1 flex items-center gap-1.5 text-xs text-white/95 dark:text-brand-900">
              <div className={`${bg} h-2.5 w-2.5 shrink-0 rounded-full`} />
              {label}
            </div>
          ))}
        </div>

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
