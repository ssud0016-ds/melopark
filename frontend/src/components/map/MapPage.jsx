
import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import ParkingMap from './ParkingMap'
import OnboardingOverlay from './OnboardingOverlay'
import SearchBar from '../search/SearchBar'
import BayDetailSheet from '../bay/BayDetailSheet'
import FilterChips from '../feedback/FilterChips'
import BusyNowPanel from '../busyNow/BusyNowPanel'
import SegmentPopup from '../busyNow/SegmentPopup'
import BottomSheet, { SNAP_PEEK, SNAP_HALF } from '../layout/BottomSheet'
import { segmentDetailFromApi } from '../busyNow/segmentDetailFromApi'
import { useBusyNow } from '../../hooks/useBusyNow'
import { useQuietestSegments } from '../../hooks/useQuietestSegments'
import { buildSegmentPopupDom } from '../busyNow/segmentPopupDom'
import { fetchSegmentDetail } from '../../services/apiPressure'
import { useMapState } from '../../hooks/useMapState'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useDebouncedPlannerParams } from '../../hooks/useDebouncedPlannerParams'
import { fetchAccessibilityNearby, fetchAccessibilityAll, fetchEvaluateBulk } from '../../services/apiBays'
import { destinationLatLng, SEARCH_RADIUS_M } from '../../utils/mapGeo'
import {
  DEFAULT_PLANNER_DURATION_MINS,
  melbourneWallClockToAwareIso,
  toMelbourneDateTimeInputValue,
  formatAtDateTime,
} from '../../utils/plannerTime'
import L from 'leaflet'
import { getStatusFillColor } from './ParkingMap'

const CHANCE_TEXT = {
  low: 'Good chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  unknown: 'No live estimate',
}

function splitMelbourneDateTimeParts(iso) {
  const dt = toMelbourneDateTimeInputValue(iso)
  if (!dt) return { date: '', time: '' }
  const [date, time] = dt.split('T')
  return { date: date || '', time: time || '' }
}

export default function MapPage({ bays, lastUpdated, apiError, apiLoading, onRetry, flyTarget }) {
  const mapRef = useRef(null)

  // Navigate from Predictions page: fly to selected zone
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    const { lat, lon } = flyTarget
    if (typeof lat === 'number' && typeof lon === 'number') {
      setTimeout(() => mapRef.current?.flyTo([lat, lon], 17, { duration: 1.2 }), 300)
    }
  }, [flyTarget])
  const segmentPopupRef = useRef(null)
  const segmentReactRootRef = useRef(null)
  const segmentFetchAbortRef = useRef(null)

  const {
    selectedBayId,
    setSelectedBayId,
    statusFilter,
    setStatusFilter,
    durationFilter,
    setDurationFilter,
    customDuration,
    setCustomDuration,
    filterTime,
    setFilterTime,
    filterDate,
    setFilterDate,
    destination,
    pickDestination,
    clearDestination,
    showLimitedBays,
    setAccessibilityMode,
    setBaysRef,
    getVisibleBays,
    getProximityBays,
    defaultMapCenter,
    defaultMapZoom,
    destinationMapZoom,
  } = useMapState()

  /** Stable reference for map layers so vector redraw does not run on unrelated parent re-renders. */
  const destinationStable = useMemo(
    () => destination,
    [destination?.lat, destination?.lng, destination?.name],
  )
  const activeFilter = durationFilter ?? statusFilter

  /** Persisted across bay opens: last debounced plan from the detail sheet. */
  const [plannerArrivalIso, setPlannerArrivalIso] = useState(null)
  const [plannerDurationMins, setPlannerDurationMins] = useState(null)

  /** True after "Show all bays at this time" in the panel. */
  const [mapBaysAtPlannedTime, setMapBaysAtPlannedTime] = useState(false)
  /** Bump to force sheet form reset when banner or Clear resets live mode. */
  const [plannerResetNonce, setPlannerResetNonce] = useState(0)
  const [parkingChanceSnap, setParkingChanceSnap] = useState(SNAP_PEEK)

  // ── Parking chance context (internal vector-tile street pressure layer) ──
  const { manifest: busyNowManifest, status: busyNowStatus } = useBusyNow(true)
  const [colorBlindMode, setColorBlindMode] = useState(false)

  const parkingChanceActive =
    busyNowStatus === 'ready' &&
    busyNowManifest != null &&
    busyNowManifest.total_segments > 0

  // Alternative-pin position (Phase 2 — A11). Set when the user clicks an
  // alternative zone in the BusyNowPanel; cleared when destination changes.
  const [altPinPos, setAltPinPos] = useState(null)

  const buildPinSubtitle = useCallback((item) => {
    if (!item) return ''
    const parts = []
    const level = item.level || item.pressure_level
    if (level) parts.push(CHANCE_TEXT[level] || 'No live estimate')
    const free = item.free_bays ?? item.free
    const total = item.total_bays ?? item.total
    if (free != null) {
      parts.push(total != null ? `${free}/${total} bays free` : `${free} bays free`)
    }
    const distance = item.walk_distance_m ?? item.distance_m
    if (distance != null) parts.push(`${distance} m away`)
    return parts.join(' · ')
  }, [])

  const handleAlternativeClick = useCallback((alt) => {
    if (!alt) return
    const lat = alt.centroid_lat
    const lon = alt.centroid_lon
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    if (mapRef.current) {
      const dest = destination ? destinationLatLng(destination) : null
      if (dest?.lat != null && dest?.lng != null) {
        mapRef.current.fitBounds(
          [[dest.lat, dest.lng], [lat, lon]],
          { padding: [80, 80], maxZoom: 18 },
        )
      } else {
        mapRef.current.flyTo([lat, lon], 18, { duration: 0.8 })
      }
    }
    const name = alt.label || alt.name || alt.zone_name || `Zone ${alt.zone_id}`
    setAltPinPos({
      lat,
      lng: lon,
      name,
      subtitle: buildPinSubtitle(alt),
      source: 'alternative',
      zoneId: alt.zone_id,
    })
  }, [buildPinSubtitle, destination])

  const handleQuietStreetClick = useCallback((seg) => {
    if (!seg) return
    const lat = seg.lat ?? seg.mid_lat
    const lng = seg.lng ?? seg.mid_lon
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    mapRef.current?.flyTo([lat, lng], 18, { duration: 0.8 })
    setAltPinPos({
      lat,
      lng,
      name: seg.street_name || seg.name || 'Less busy street',
      subtitle: buildPinSubtitle(seg),
      source: 'quiet-street',
      segmentId: seg.segment_id,
    })
  }, [buildPinSubtitle])

  const clearSelectedSuggestion = useCallback(() => {
    setAltPinPos(null)
  }, [])

  // Clear alt pin whenever the destination changes (incl. clear).
  useEffect(() => {
    setAltPinPos(null)
  }, [destination])

  const handleSegmentClick = useCallback(
    (props, latlng) => {
      if (!mapRef.current || !latlng) return
      const map = mapRef.current

      segmentFetchAbortRef.current?.abort()
      const ac = new AbortController()
      segmentFetchAbortRef.current = ac

      if (segmentReactRootRef.current) {
        try {
          segmentReactRootRef.current.unmount()
        } catch (_e) {
          /* noop */
        }
        segmentReactRootRef.current = null
      }

      const skeleton = buildSegmentPopupDom(props)
      const popup = L.popup().setLatLng(latlng).setContent(skeleton).openOn(map)
      segmentPopupRef.current = popup

      const cleanupReact = () => {
        if (segmentReactRootRef.current) {
          try {
            segmentReactRootRef.current.unmount()
          } catch (_e) {
            /* noop */
          }
          segmentReactRootRef.current = null
        }
      }
      popup.on('remove', cleanupReact)

      const segmentId = props?.id != null ? String(props.id) : null
      if (!segmentId) return

      fetchSegmentDetail(segmentId, {
        signal: ac.signal,
        dataVersion: busyNowManifest?.data_version ?? busyNowManifest?.minute_bucket ?? null,
      })
        .then((apiDetail) => {
          if (segmentPopupRef.current !== popup) return
          const detail = segmentDetailFromApi(apiDetail)
          if (!detail) return
          const wrap = document.createElement('div')
          const root = createRoot(wrap)
          segmentReactRootRef.current = root
          root.render(
            <SegmentPopup
              detail={detail}
              colorBlindMode={colorBlindMode}
              isMobile={isMobile}
              onRequestClose={() => {
                map.closePopup(popup)
              }}
              onMarkAsTarget={() => {
                handleQuietStreetClick({
                  ...detail,
                  lat: latlng.lat,
                  lng: latlng.lng,
                  mid_lat: latlng.lat,
                  mid_lon: latlng.lng,
                  street_name: detail.street_name || props?.name || props?.street_name,
                  segment_id: props?.id ?? detail.segment_id,
                })
                map.closePopup(popup)
              }}
            />,
          )
          popup.setContent(wrap)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          if (segmentPopupRef.current !== popup) return
          const errWrap = document.createElement('div')
          errWrap.className =
            'p-3 text-xs text-rose-700 dark:text-rose-300 max-w-[240px]'
          errWrap.textContent = 'Could not load street details. Try again in a moment.'
          popup.setContent(errWrap)
          window.setTimeout(() => {
            if (segmentPopupRef.current === popup && map?.closePopup) {
              map.closePopup(popup)
            }
          }, 2000)
        })
    },
    [colorBlindMode, handleQuietStreetClick, busyNowManifest?.data_version, busyNowManifest?.minute_bucket],
  )

  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.sessionStorage.getItem('melopark.onboarded')
  })
  const [showPressureCoach, setShowPressureCoach] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.sessionStorage.getItem('melopark.pressureCoachSeen')
  })

  const dismissOnboarding = useCallback(() => {
    try {
      window.sessionStorage.setItem('melopark.onboarded', '1')
    } catch (_e) {}
    setShowOnboarding(false)
  }, [])

  const dismissPressureCoach = useCallback(() => {
    try {
      window.sessionStorage.setItem('melopark.pressureCoachSeen', '1')
    } catch (_e) {}
    setShowPressureCoach(false)
  }, [])

  const handleOnboardingPick = useCallback((lm, arrivalIso = null, opts = null) => {
    pickDestination(lm)
    const accessible = opts?.accessible || false
    const sf = accessible ? 'all' : (opts?.statusFilter || 'all')
    const df = opts?.durationFilter || null
    const cd = opts?.customDuration || 60
    setStatusFilter(sf)
    setDurationFilter(df)
    if (df === 'custom') setCustomDuration(cd)
    setAccessibilityMode(accessible)
    setAccessibilityAvailableOnly(accessible)
    // Sync arrival time → filterDate/filterTime (via plannerArrivalIso useEffect)
    if (arrivalIso) {
      setPlannerArrivalIso(arrivalIso)
      setPlannerDurationMins(DEFAULT_PLANNER_DURATION_MINS)
      setMapBaysAtPlannedTime(true)
    }
    dismissOnboarding()
  }, [pickDestination, dismissOnboarding, setStatusFilter, setDurationFilter, setCustomDuration, setAccessibilityMode])

  const [mapBounds, setMapBounds] = useState(null)
  const [bulkVerdictById, setBulkVerdictById] = useState({})
  const [accessibilityNearby, setAccessibilityNearby] = useState([])
  const [accessibilityLoading, setAccessibilityLoading] = useState(false)
  const [accessibilityError, setAccessibilityError] = useState(null)
  const [accessibilityAvailableOnly, setAccessibilityAvailableOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    if (!filtersOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFiltersOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtersOpen])

  const debouncedBounds = useDebouncedValue(mapBounds, 300)

  // Quietest segments in viewport (single fetch, limit 150 — panel uses first 3, trend markers use full list).
  const { segments: quietSegmentsAll } = useQuietestSegments({
    bounds: debouncedBounds,
    enabled: parkingChanceActive,
  })
  const quietStreets = useMemo(() => {
    const levelScore = { low: 0, medium: 1, high: 2, unknown: 3 }
    return [...quietSegmentsAll]
      .sort((a, b) => {
        const liveA = a.has_live_bays === false ? 1 : 0
        const liveB = b.has_live_bays === false ? 1 : 0
        if (liveA !== liveB) return liveA - liveB
        const levelA = levelScore[a.level] ?? 3
        const levelB = levelScore[b.level] ?? 3
        if (levelA !== levelB) return levelA - levelB
        const freeA = Number(a.free ?? 0)
        const freeB = Number(b.free ?? 0)
        return freeB - freeA
      })
      .slice(0, 3)
  }, [quietSegmentsAll])

  const plannerParams = useMemo(() => {
    if (!plannerArrivalIso || plannerDurationMins == null) return null
    return { arrivalIso: plannerArrivalIso, durationMins: plannerDurationMins }
  }, [plannerArrivalIso, plannerDurationMins])

  const pressureModeNote = useMemo(() => {
    if (!plannerArrivalIso) return 'Parking chance: live now'
    return `Parking chance: live now · Rules: ${formatAtDateTime(plannerArrivalIso)}`
  }, [plannerArrivalIso])

  const parkingChanceSheetTitle = useMemo(() => {
    if (altPinPos) return 'Less busy pick'
    if (destination) return 'Near destination'
    return 'Best nearby parking'
  }, [altPinPos, destination])

  const parkingChanceSheetSubtitle = useMemo(() => {
    if (altPinPos) return altPinPos.name
    if (destination) return 'Compare parking chance before you drive'
    return 'Quiet streets around current map view'
  }, [altPinPos, destination])

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

    fetchAccessibilityAll({
      // Small batch so cold /api/accessibility/all fits DO gateway timeout.
      topN: 200,
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
  }, [accessibilityAvailableOnly])

  useEffect(() => {
    if (!accessibilityAvailableOnly) return
    // Keep one source of truth for accessible filtering to avoid intersecting filters.
    setAccessibilityMode(false)
  }, [accessibilityAvailableOnly, setAccessibilityMode])

  useEffect(() => {
    setBaysRef(bays)
  }, [bays, setBaysRef])

  useEffect(() => {
    if (!plannerArrivalIso) {
      const now = new Date()
      setFilterTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      setFilterDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
      return
    }
    const { date, time } = splitMelbourneDateTimeParts(plannerArrivalIso)
    if (time) setFilterTime(time.slice(0, 5))
    if (date) setFilterDate(date)
  }, [plannerArrivalIso, setFilterTime, setFilterDate])

  const visibleBays = getVisibleBays(bays)
  const proximityBays = getProximityBays(bays)
  const accessibleBayIds = useMemo(
    () => new Set(accessibilityNearby.map((b) => String(b.bay_id))),
    [accessibilityNearby],
  )
  const accessibleRulesByBayId = useMemo(() => {
    const out = {}
    for (const row of accessibilityNearby) {
      const key = String(row?.bay_id ?? '')
      if (!key) continue
      out[key] = row
    }
    return out
  }, [accessibilityNearby])

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
  const accessibleShownCount = accessibilityAvailableOnly ? mapBays.length : 0

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
  useEffect(() => {
    if (!isMobile) setLegendOpen(true)
    else setLegendOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!isMobile) return
    setParkingChanceSnap(altPinPos ? SNAP_HALF : SNAP_PEEK)
  }, [isMobile, altPinPos])

  useEffect(() => {
    if (isMobile || !altPinPos) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') clearSelectedSuggestion()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [altPinPos, clearSelectedSuggestion, isMobile])

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
  const FILTER_RIGHT_RESERVE_PX = isMobile ? 0 : 24
  const ZOOM_GROUP_WIDTH_PX = 72

const { date: arriveDate, time: arriveTime } = splitMelbourneDateTimeParts(plannerArrivalIso)

  const _scopeDateStr = arriveDate || filterDate
  const _scopeTimeStr = arriveTime || filterTime
  const _DAY_ABBRS2 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const _scopeDateLabel = _scopeDateStr
    ? (() => { const dt = new Date(_scopeDateStr + 'T00:00:00'); const mm = String(dt.getMonth() + 1).padStart(2, '0'); const dd = String(dt.getDate()).padStart(2, '0'); const yyyy = dt.getFullYear(); return `${_DAY_ABBRS2[dt.getDay()]}, ${mm}/${dd}/${yyyy}` })()
    : 'Today'
  const _scopeTimeLabel = _scopeTimeStr
    ? (() => { const [hh, mm] = _scopeTimeStr.split(':').map(Number); const ampm = hh >= 12 ? 'PM' : 'AM'; const h12 = hh % 12 || 12; return `${h12}:${String(mm).padStart(2, '0')} ${ampm}` })()
    : ''

  const _statusLabel = statusFilter === 'available' ? 'Available' : statusFilter === 'trap' ? 'Caution' : 'All bay status'
  const _durLabels = { '15min': '15 min', '30min': '30 min', '1h': '1H', '2h': '2H', '3h': '3H', '4h': '4H' }
  const _durationLabel = durationFilter
    ? (durationFilter === 'custom' && customDuration ? `${customDuration} min` : (_durLabels[durationFilter] || durationFilter))
    : 'Any duration'

  const scopeStrip = (
    <div className="px-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate">
      <span>Showing: </span>
      <span className="font-semibold text-slate-700 dark:text-gray-200">{_statusLabel}</span>
      <span className="mx-1 text-slate-400">·</span>
      <span className="font-semibold text-slate-700 dark:text-gray-200">{_durationLabel}</span>
      <span className="mx-1 text-slate-400">·</span>
      <span className="font-semibold text-slate-700 dark:text-gray-200">{_scopeDateLabel} {_scopeTimeLabel}</span>
    </div>
  )

  const updateArriveBy = useCallback((nextDate, nextTime) => {
    if (!nextDate || !nextTime) return
    const [ys, mos, ds] = nextDate.split('-').map(Number)
    const [hh, mm] = nextTime.split(':').map(Number)
    if (![ys, mos, ds, hh, mm].every((n) => Number.isFinite(n))) return
    setPlannerArrivalIso(melbourneWallClockToAwareIso(ys, mos, ds, hh, mm, 0))
    setPlannerDurationMins((prev) => (prev == null ? DEFAULT_PLANNER_DURATION_MINS : prev))
    setMapBaysAtPlannedTime(true)
  }, [])

  const chipBase = 'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors cursor-pointer backdrop-blur-sm'
  const chipActive = 'border-brand bg-brand text-white shadow-sm dark:border-brand dark:bg-brand'
  const chipIdle = 'border-slate-300/70 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-400 dark:border-slate-500/60 dark:bg-surface-dark-secondary/60 dark:text-gray-100'

  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)

  const _DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dateLabel = arriveDate
    ? (() => { const d = new Date(arriveDate + 'T00:00:00'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); const yyyy = d.getFullYear(); return `${_DAY_ABBRS[d.getDay()]}, ${mm}/${dd}/${yyyy}` })()
    : 'Date'

  const arriveChip = (
    <div className="flex w-full flex-col gap-1">
      <span className="px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Arrival time</span>
      {/* Hidden inputs — off-screen but rendered so showPicker() works */}
      <input
        ref={dateInputRef}
        type="date"
        value={arriveDate}
        onChange={(e) => updateArriveBy(e.target.value, arriveTime || '09:00')}
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: 0, left: 0 }}
        tabIndex={-1}
      />
      <input
        ref={timeInputRef}
        type="time"
        value={arriveTime}
        onChange={(e) => {
          const today = new Date()
          const d = arriveDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          updateArriveBy(d, e.target.value)
        }}
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: 0, left: 0 }}
        tabIndex={-1}
      />
      <div className="flex w-full items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => dateInputRef.current?.showPicker()}
        className={`${chipBase} ${plannerArrivalIso ? chipActive : chipIdle} inline-flex items-center gap-1`}
        aria-label="Set arrival date"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
          <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {dateLabel}
      </button>
      <button
        type="button"
        onClick={() => timeInputRef.current?.showPicker()}
        className={`${chipBase} ${plannerArrivalIso ? chipActive : chipIdle} inline-flex items-center gap-1`}
        aria-label="Set arrival time"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7.5v5l3.5 2.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {arriveTime || 'Time'}
      </button>
      {plannerArrivalIso && (
        <button
          type="button"
          onClick={resetPlannerToLive}
          aria-label="Clear arrival time"
          className={`${chipBase} ${chipIdle}`}
        >
          Clear
        </button>
      )}
      </div>
    </div>
  )

  const filterInnerContent = (
    <>
      <div className="w-full rounded-xl overflow-hidden bg-white/85 backdrop-blur-md border border-slate-200/70 shadow-sm dark:bg-surface-dark-secondary/85 dark:border-slate-600/50">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
          aria-expanded={filtersOpen}
        >
          <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-300">
            Filters
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`shrink-0 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {filtersOpen && (
          <div className="px-3 pb-3 pt-1 flex flex-col gap-1 border-t border-slate-200/60 dark:border-slate-600/40">
            <FilterChips
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              durationFilter={durationFilter}
              onDurationFilterChange={setDurationFilter}
              accessibleOn={accessibilityAvailableOnly}
              onToggleAccessible={() => setAccessibilityAvailableOnly((v) => !v)}
              customDuration={customDuration}
              onCustomDurationChange={setCustomDuration}
            />
            {arriveChip}
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-slate-200/60 bg-white/60 px-2.5 py-1.5 dark:border-slate-600/40 dark:bg-surface-dark/50">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-300">Color-blind palette</span>
              <button
                type="button"
                role="switch"
                aria-checked={colorBlindMode}
                aria-label={colorBlindMode ? 'Disable color-blind mode' : 'Enable color-blind mode'}
                onClick={() => setColorBlindMode((v) => !v)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 ${
                  colorBlindMode
                    ? 'border-sky-400 bg-sky-500 dark:border-sky-500 dark:bg-sky-600'
                    : 'border-gray-300 bg-gray-200 hover:bg-gray-300 dark:border-slate-600 dark:bg-slate-700'
                }`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow ring-1 transition-transform duration-200 ease-out ${
                    colorBlindMode
                      ? 'translate-x-5 bg-white ring-sky-300/40'
                      : 'translate-x-0 bg-white ring-black/10 dark:bg-slate-300 dark:ring-white/10'
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-2 w-full rounded-lg bg-brand px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-brand/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 dark:focus-visible:ring-offset-surface-dark-secondary"
            >
              Done
            </button>
          </div>
        )}
      </div>
      <div className="rounded-lg bg-white/85 backdrop-blur-md px-2.5 py-1 border border-slate-200/50 shadow-sm dark:bg-surface-dark-secondary/85 dark:border-slate-600/40">
        {scopeStrip}
      </div>
      {accessibilityAvailableOnly && (
        <div
          className="rounded-xl border border-brand bg-white/95 px-3 py-2 text-xs font-semibold text-brand text-center shadow-card dark:border-brand-300/70 dark:bg-surface-dark-secondary/95 dark:text-brand-100"
          aria-label="Accessibility mode enabled: showing accessibility overlay bays"
        >
          Accessibility mode: accessible bays only
        </div>
      )}
    </>
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
          destination={destinationStable}
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
          busyNow={parkingChanceActive}
          busyNowManifest={busyNowManifest}
          busyNowQuietSegments={parkingChanceActive ? quietSegmentsAll : undefined}
          onSegmentClick={handleSegmentClick}
          colorBlindMode={colorBlindMode}
          altPinPos={altPinPos}
          onMapEmptyClick={clearSelectedSuggestion}
          dimRadiusM={SEARCH_RADIUS_M}
          accessibilityBayIds={accessibleBayIds}
        />

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

              <div className="mt-1 flex w-full flex-col gap-1.5">
                {filterInnerContent}
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
                      left: 'calc(50% - 80px)',
                      transform: 'translateX(-50%)',
                      width: `min(${TOOLBAR_MAX_PX}px, calc(100% - 408px))`,
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
                  className="mt-1 flex flex-col gap-1.5"
                  style={{ width: `calc(100% - ${ZOOM_GROUP_WIDTH_PX}px)`, maxWidth: 'calc(580px - 72px)' }}
                >
                  {filterInnerContent}
                </div>
              </div>
            </div>

            <div
              className="absolute top-5 z-[600] pointer-events-auto"
              style={{ right: rightInsetPx }}
            >
            </div>
          </>
        )}

        {destination && !isMobile && (
          <div
            className="absolute bottom-3.5 z-[500] bg-surface-secondary text-gray-900 rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-overlay flex flex-col items-center gap-0.5 max-w-[calc(100%-120px)] border-2 border-brand"
            style={selectedBay ? { left: 'calc(50% - 190px)', transform: 'translateX(-50%)' } : { left: '50%', transform: 'translateX(-50%)' }}
          >
            <span>
              {proxFreeSpots === proxFreeBays ? (
                <>
                  {proxFreeBays} free {proxModeLabel}
                  {proxFreeBays !== 1 ? 's' : ''} within {SEARCH_RADIUS_M} m of {destination.name}
                </>
              ) : (
                <>
                  {proxFreeSpots} free spot{proxFreeSpots !== 1 ? 's' : ''} across {proxFreeBays}{' '}
                  {proxModeLabel}
                  {proxFreeBays !== 1 ? 's' : ''} within {SEARCH_RADIUS_M} m of {destination.name}
                </>
              )}
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


        {!isMobile && (
        <div
          className="group absolute bottom-3.5 left-3.5 z-[500] rounded-xl border border-brand bg-brand px-2.5 py-1 sm:px-3.5 sm:py-1.5 shadow-overlay dark:border-brand-300/80 dark:bg-brand-50 flex flex-col cursor-help max-w-[45vw] sm:max-w-none"
          aria-label="Total parking bays on the live feed"
        >
          <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden w-64 rounded-lg border border-brand-800/80 bg-brand px-3 py-2.5 text-xs text-white shadow-card-lg group-hover:block dark:border-brand-300/70 dark:bg-surface-dark-secondary dark:text-gray-100">
            <div className="font-semibold text-white dark:text-white">Total parking bays</div>
            <div className="mt-1 leading-relaxed">
              Total bays loaded from the live parking feed across the City of Melbourne.
              {verifiedCount > 0 && (
                <> Currently in view: {verifiedCount} with CoM restriction data{limitedCount > 0 ? `, ${limitedCount} without` : ''}.</>
              )}
            </div>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-white dark:text-brand-900 whitespace-nowrap">
            {(bays?.length ?? 0).toLocaleString()} total bay{(bays?.length ?? 0) !== 1 ? 's' : ''}
          </span>
          {accessibilityAvailableOnly && (
            <span className="text-[10px] sm:text-xs font-semibold text-white/90 dark:text-brand-900 whitespace-nowrap">
              {accessibleShownCount.toLocaleString()} accessible shown
            </span>
          )}
        </div>
        )}

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
          const streetRows = [
            { color: availableColor, label: 'Good chance street', symbolClass: 'legend-street-good' },
            { color: cautionColor, label: 'Getting busy street', symbolClass: 'legend-street-busy' },
            { color: occupiedColor, label: 'Hard to park street', symbolClass: 'legend-street-hard' },
            { color: colorBlindMode ? '#9ca3af' : '#cbd5e1', label: 'No live estimate', symbolClass: 'legend-street-unknown' },
          ]
          return (
            <div
              className="absolute bottom-3.5 z-[510] flex flex-col gap-2"
              style={{ right: rightInsetPx }}
            >
              {parkingChanceActive && showPressureCoach && !showOnboarding && !selectedBay && (
                <div className="self-end max-w-[260px] rounded-xl border border-emerald-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-card dark:border-emerald-800 dark:bg-surface-dark-secondary/95 dark:text-gray-100">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-200">
                    Parking chance is live now
                  </div>
                  <div className="mt-0.5 leading-snug">
                    Green streets are easier. Tap any colored street to see why.
                  </div>
                  <button
                    type="button"
                    onClick={dismissPressureCoach}
                    className="mt-1 text-[11px] font-semibold text-brand hover:underline dark:text-brand-light"
                  >
                    Got it
                  </button>
                </div>
              )}
            <div
              className="rounded-xl border border-brand bg-brand shadow-overlay dark:border-brand-300/80 dark:bg-brand-50"
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
                        className={`${dotClass} ${symbolClass} h-3.5 w-3.5 shrink-0 rounded-full`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] sm:text-xs text-white/95 dark:text-brand-900">
                    <div className="relative h-3.5 w-3.5 shrink-0">
                      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full">
                        <circle cx="12" cy="12" r="12" fill="#60a5fa"/>
                        <path fill="white" d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
                      </svg>
                    </div>
                    <span className="truncate">Accessible bays</span>
                  </div>
                  <div className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/80 dark:text-brand-800/90">
                    Street parking chance
                  </div>
                  {streetRows.map(({ label, symbolClass, color }) => (
                    <div key={label} className="mb-1 flex items-center gap-1.5 text-[11px] sm:text-xs text-white/95 dark:text-brand-900">
                      <div
                        className={`${symbolClass} h-1.5 w-5 shrink-0 rounded-full`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          )
        })()}

        {busyNowStatus !== 'idle' && (
          isMobile ? (
            <BottomSheet
              snap={parkingChanceSnap}
              onSnapChange={setParkingChanceSnap}
              title={parkingChanceSheetTitle}
              subtitle={parkingChanceSheetSubtitle}
            >
              <div className="px-3 pb-4">
                {altPinPos && (
                  <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50/95 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">
                      Less busy pick
                    </div>
                    <div className="truncate text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                      {altPinPos.name}
                    </div>
                    {altPinPos.subtitle && (
                      <div className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-100">
                        {altPinPos.subtitle}
                      </div>
                    )}
                    {destination && altPinPos.source === 'alternative' && (
                      <div className="mt-2 rounded-lg bg-white/65 px-2 py-1.5 text-[11px] text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
                        <div>
                          <span className="font-semibold">Destination:</span> {destination.name}
                        </div>
                        <div>
                          <span className="font-semibold">Selected:</span> {altPinPos.subtitle || 'Less busy option'}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={clearSelectedSuggestion}
                      className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-surface-dark dark:text-emerald-100"
                    >
                      Clear pick
                    </button>
                  </div>
                )}
                <BusyNowPanel
                  manifest={busyNowManifest}
                  status={busyNowStatus}
                  destination={destination}
                  onAlternativeClick={handleAlternativeClick}
                  colorBlindMode={colorBlindMode}
                  quietStreets={quietStreets}
                  onStreetClick={handleQuietStreetClick}
                  selectedSuggestion={altPinPos}
                  pressureModeNote={pressureModeNote}
                  mobileSheet
                />

              </div>
            </BottomSheet>
          ) : (
            <div className="absolute bottom-28 left-3.5 z-[510] flex max-w-[min(320px,calc(100vw-28px))] flex-col gap-2 sm:bottom-20">
              {altPinPos && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/95 p-2.5 shadow-card backdrop-blur-sm dark:border-emerald-800/60 dark:bg-emerald-950/80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">
                        Less busy pick
                      </div>
                      <div className="truncate text-[12px] font-semibold text-emerald-950 dark:text-emerald-50">
                        {altPinPos.name}
                      </div>
                      {altPinPos.subtitle && (
                        <div className="mt-0.5 text-[10px] text-emerald-800 dark:text-emerald-100">
                          {altPinPos.subtitle}
                        </div>
                      )}
                      {destination && altPinPos.source === 'alternative' && (
                        <div className="mt-1 rounded-lg bg-white/65 px-2 py-1 text-[10px] text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
                          <div>
                            <span className="font-semibold">Destination:</span> {destination.name}
                          </div>
                          <div>
                            <span className="font-semibold">Selected:</span> {altPinPos.subtitle || 'Less busy option'}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearSelectedSuggestion}
                      className="shrink-0 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-surface-dark dark:text-emerald-100"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <BusyNowPanel
                manifest={busyNowManifest}
                status={busyNowStatus}
                destination={destination}
                onAlternativeClick={handleAlternativeClick}
                colorBlindMode={colorBlindMode}
                quietStreets={quietStreets}
                onStreetClick={handleQuietStreetClick}
                selectedSuggestion={altPinPos}
                pressureModeNote={pressureModeNote}
              />

            </div>
          )
        )}

        {showOnboarding && (
          <OnboardingOverlay
            onPick={handleOnboardingPick}
            onSkip={dismissOnboarding}
            busyNowManifest={busyNowManifest}
          />
        )}

        {selectedBay && (
          <BayDetailSheet
            bay={selectedBay}
            accessibilityRuleFallback={accessibleRulesByBayId[String(selectedBay.id)] ?? null}
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
            durationFilter={durationFilter}
            customDuration={customDuration}
          />
        )}
      </div>
    </div>
  )
}
