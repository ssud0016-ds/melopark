/**
 * ParkingAlertBanner.jsx — AC 6.1.1 + AC 6.1.2
 *
 * Shows a smart dismissible alert when:
 *   - An event is detected within 400m of destination
 *   - A peak demand period is predicted
 *
 * Once dismissed, stays gone until a NEW event or demand spike occurs.
 * Stores dismissal key in sessionStorage so it reappears on new conditions.
 *
 * Props:
 *   warnings        {array}   -- from useParkingForecast().warnings
 *   destination     {object}  -- { name, lat, lng } or null
 *   plannerArrivalIso {string} -- selected arrival time ISO or null
 *   onZoneClick     {fn}      -- (zone) => fly map there
 */
import { useState, useEffect, useMemo } from 'react'

const LEVEL_COLOR = {
  critical: { bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-300 dark:border-red-700',     text: 'text-red-800 dark:text-red-200',     icon: '🔴', bar: 'bg-red-500' },
  high:     { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-800 dark:text-orange-200', icon: '🟠', bar: 'bg-orange-500' },
  moderate: { bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-300 dark:border-amber-700',  text: 'text-amber-800 dark:text-amber-200',  icon: '🟡', bar: 'bg-amber-400' },
  low:      { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-800 dark:text-emerald-200', icon: '🟢', bar: 'bg-emerald-500' },
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180
  const dp = (lat2 - lat1) * Math.PI / 180
  const dl = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function ParkingAlertBanner({
  warnings = [],
  destination = null,
  plannerArrivalIso = null,
  onZoneClick,
}) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Build alert from warnings data
  const alert = useMemo(() => {
    if (!warnings.length) return null

    // Filter to arrival hour (or next 2 hours if no planner time)
    const targetHours = plannerArrivalIso
      ? [0, 1] // near the planned time
      : [0, 1, 2]

    const relevant = warnings.filter(w => targetHours.includes(w.hours_from_now))

    // Find event alerts (AC 6.1.1 — event within 400m)
    const eventAlerts = relevant.filter(w =>
      (w.event_risk_level === 'high' || w.event_risk_level === 'medium') &&
      w.events_nearby && w.events_nearby !== 'None'
    )

    // Find high demand zones (peak-time warnings)
    const demandAlerts = relevant.filter(w =>
      w.warning_level === 'critical' || w.warning_level === 'high'
    )

    // Check 400m radius if destination set
    let nearbyEventAlerts = eventAlerts
    if (destination?.lat && destination?.lng) {
      nearbyEventAlerts = eventAlerts.filter(w => {
        if (!w.zone_lat || !w.zone_lon) return true // include if no coords
        const dist = haversineM(destination.lat, destination.lng, w.zone_lat, w.zone_lon)
        return dist <= 400
      })
    }

    if (!nearbyEventAlerts.length && !demandAlerts.length) return null

    const hasEvent = nearbyEventAlerts.length > 0
    const worstDemand = demandAlerts.reduce((worst, w) => {
      const order = { critical: 3, high: 2, moderate: 1, low: 0 }
      return (order[w.warning_level] || 0) > (order[worst?.warning_level] || 0) ? w : worst
    }, null)

    const worstLevel = hasEvent
      ? (nearbyEventAlerts[0].event_risk_level === 'high' ? 'critical' : 'high')
      : (worstDemand?.warning_level || 'moderate')

    const affectedZones = [...new Set([
      ...nearbyEventAlerts.map(w => w.zone),
      ...demandAlerts.map(w => w.zone),
    ])]

    const eventNames = [...new Set(
      nearbyEventAlerts
        .map(w => w.events_nearby)
        .filter(e => e && e !== 'None')
    )]

    const peakHour = demandAlerts.length
      ? Math.min(...demandAlerts.map(w => w.hours_from_now))
      : null

    return {
      worstLevel,
      hasEvent,
      eventNames,
      affectedZones,
      peakHour,
      demandAlerts,
      nearbyEventAlerts,
      // Key for dismissal — changes when new events appear (AC 6.1.2)
      dismissKey: `alert-${affectedZones.sort().join(',')}-${eventNames.join(',')}-${worstLevel}`,
    }
  }, [warnings, destination, plannerArrivalIso])

  // AC 6.1.2 — restore dismissed state per unique alert key
  useEffect(() => {
    if (!alert) return
    const wasDismissed = sessionStorage.getItem(`melopark.alert.${alert.dismissKey}`)
    setDismissed(!!wasDismissed)
  }, [alert?.dismissKey])

  const handleDismiss = () => {
    if (alert) {
      try { sessionStorage.setItem(`melopark.alert.${alert.dismissKey}`, '1') } catch (_) {}
    }
    setDismissed(true)
  }

  if (!alert || dismissed) return null

  const col = LEVEL_COLOR[alert.worstLevel] || LEVEL_COLOR.moderate

  return (
    <div className={`rounded-2xl border ${col.bg} ${col.border} shadow-md overflow-hidden pointer-events-auto`}
      role="alert" aria-live="polite">

      {/* Top accent */}
      <div className={`h-0.5 w-full ${col.bar}`} />

      {/* Header row */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span className="text-base leading-none mt-0.5 shrink-0">{col.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-bold ${col.text}`}>
            {alert.hasEvent
              ? `Event alert${destination ? ` near ${destination.name}` : ''}`
              : `Peak demand predicted${alert.peakHour === 0 ? ' right now' : ` in ${alert.peakHour}h`}`}
          </div>

          {/* Event names — AC 6.1.2 shows event details */}
          {alert.eventNames.length > 0 && (
            <div className="mt-0.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate">
              {alert.eventNames.slice(0, 2).join(' · ')}
            </div>
          )}

          {/* Affected zones summary */}
          <div className="mt-1 flex flex-wrap gap-1">
            {alert.affectedZones.slice(0, 3).map(zone => {
              const w = alert.demandAlerts.find(x => x.zone === zone) ||
                        alert.nearbyEventAlerts.find(x => x.zone === zone)
              const lvl = w?.warning_level || 'moderate'
              const zonecol = LEVEL_COLOR[lvl] || LEVEL_COLOR.moderate
              return (
                <button key={zone} type="button"
                  onClick={() => {
                    const zw = warnings.find(x => x.zone === zone && x.zone_lat)
                    if (zw) onZoneClick?.({ ...zw, centroid_lat: zw.zone_lat, centroid_lon: zw.zone_lon })
                  }}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${zonecol.border} ${zonecol.text} bg-white/60 dark:bg-gray-900/40 hover:bg-white transition-colors`}>
                  {zone}
                  {w?.predicted_occupancy ? ` · ${Math.round(w.predicted_occupancy * 100)}%` : ''}
                </button>
              )
            })}
          </div>

          {/* Expandable detail — AC 6.1.2 shows impact */}
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {alert.demandAlerts.filter((v,i,a) => a.findIndex(x=>x.zone===v.zone && x.hours_from_now===v.hours_from_now)===i).slice(0,4).map(w => (
                <div key={`${w.zone}-${w.hours_from_now}`}
                  className="flex items-center gap-2 rounded-lg bg-white/50 dark:bg-gray-900/30 px-2 py-1">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">{w.zone}</span>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 ml-1">
                      {w.hours_from_now === 0 ? 'now' : `+${w.hours_from_now}h`}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full ${col.bar}`}
                        style={{ width: `${Math.round((w.predicted_occupancy || 0) * 100)}%` }}/>
                    </div>
                    <span className={`text-[9px] font-black ${col.text}`}>
                      {Math.round((w.predicted_occupancy || 0) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-gray-400 dark:text-gray-500 px-1">
                Tap any zone above to see it on the map
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setExpanded(v => !v)}
            className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${col.border} ${col.text} bg-white/50 hover:bg-white/80 transition-colors`}>
            {expanded ? 'Less' : 'Details'}
          </button>
          {/* AC 6.1.2 — dismiss once, stays gone until new conditions */}
          <button type="button" onClick={handleDismiss} aria-label="Dismiss alert"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/60 text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
