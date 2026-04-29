import { bayLatLng, destinationLatLng, haversineMeters, normToLatLng } from './mapGeo'

export const DEMAND_FILL = {
  low: '#4ade80',
  moderate: '#f59e0b',
  high: '#ef4444',
}

export const ZONE_GRID = [
  { id: 'nw', xMin: 0, xMax: 1 / 3, yMin: 0, yMax: 0.5, label: 'North-West CBD' },
  { id: 'nc', xMin: 1 / 3, xMax: 2 / 3, yMin: 0, yMax: 0.5, label: 'North-Central CBD' },
  { id: 'ne', xMin: 2 / 3, xMax: 1, yMin: 0, yMax: 0.5, label: 'North-East CBD' },
  { id: 'sw', xMin: 0, xMax: 1 / 3, yMin: 0.5, yMax: 1, label: 'South-West CBD' },
  { id: 'sc', xMin: 1 / 3, xMax: 2 / 3, yMin: 0.5, yMax: 1, label: 'South-Central CBD' },
  { id: 'se', xMin: 2 / 3, xMax: 1, yMin: 0.5, yMax: 1, label: 'South-East CBD' },
]

function classifyDemand(occupiedRatio) {
  if (occupiedRatio < 0.4) return 'low'
  if (occupiedRatio < 0.75) return 'moderate'
  return 'high'
}

function zoneBounds(zone) {
  const northWest = normToLatLng(zone.xMin, zone.yMin)
  const southEast = normToLatLng(zone.xMax, zone.yMax)
  return {
    southWest: [southEast.lat, northWest.lng],
    northEast: [northWest.lat, southEast.lng],
  }
}

function zoneCenter(zone) {
  const northWest = normToLatLng(zone.xMin, zone.yMin)
  const southEast = normToLatLng(zone.xMax, zone.yMax)
  return {
    lat: (northWest.lat + southEast.lat) / 2,
    lng: (northWest.lng + southEast.lng) / 2,
  }
}

function bayToDemandSignal(bay) {
  if ((bay?.source || '').toLowerCase() !== 'live') return null
  if (bay?.type === 'trap') return null
  if (bay?.free === 1) return 0
  if (bay?.free === 0) return 1
  return null
}

function includesPoint(zone, bay) {
  const { lat, lng } = bayLatLng(bay)
  const northWest = normToLatLng(zone.xMin, zone.yMin)
  const southEast = normToLatLng(zone.xMax, zone.yMax)
  return lat <= northWest.lat && lat >= southEast.lat && lng >= northWest.lng && lng <= southEast.lng
}

export function buildZoneDemandSnapshot(bays) {
  return ZONE_GRID.map((zone) => {
    let occupancySignals = 0
    let occupiedSignals = 0

    for (const bay of bays) {
      if (!includesPoint(zone, bay)) continue
      const signal = bayToDemandSignal(bay)
      if (signal == null) continue
      occupancySignals += 1
      occupiedSignals += signal
    }

    if (occupancySignals === 0) {
      return {
        id: zone.id,
        label: zone.label,
        level: null,
        hasLiveData: false,
        occupiedRatio: null,
        ...zoneBounds(zone),
      }
    }

    const occupiedRatio = occupiedSignals / occupancySignals
    return {
      id: zone.id,
      label: zone.label,
      level: classifyDemand(occupiedRatio),
      hasLiveData: true,
      occupiedRatio,
      center: zoneCenter(zone),
      ...zoneBounds(zone),
    }
  })
}

export function buildZoneAvailabilitySnapshot(bays) {
  return ZONE_GRID.map((zone) => {
    let liveBayCount = 0
    let availableBayCount = 0

    for (const bay of bays) {
      if (!includesPoint(zone, bay)) continue
      if ((bay?.source || '').toLowerCase() !== 'live') continue
      liveBayCount += 1
      if (bay?.free === 1) availableBayCount += 1
    }

    return {
      id: zone.id,
      label: zone.label,
      liveBayCount,
      availableBayCount,
    }
  })
}

function zoneIntersectsBounds(zone, bounds) {
  if (!bounds) return true
  const zoneWest = zone.southWest[1]
  const zoneEast = zone.northEast[1]
  const zoneSouth = zone.southWest[0]
  const zoneNorth = zone.northEast[0]
  if (zoneEast < bounds.west) return false
  if (zoneWest > bounds.east) return false
  if (zoneNorth < bounds.south) return false
  if (zoneSouth > bounds.north) return false
  return true
}

export function chooseOptimalZoneId(zones, destination, mapBounds) {
  if (!Array.isArray(zones) || zones.length === 0 || !destination) return null
  const visible = zones.filter((z) => z.hasLiveData && z.occupiedRatio != null && zoneIntersectsBounds(z, mapBounds))
  if (visible.length < 2) return null

  const minRatio = visible.reduce((min, z) => Math.min(min, z.occupiedRatio), Infinity)
  const EPS = 1e-9
  const lowestPressure = visible.filter((z) => Math.abs(z.occupiedRatio - minRatio) <= EPS)
  const dest = destinationLatLng(destination)
  if (!dest) return null

  let best = null
  for (const zone of lowestPressure) {
    const center = zone.center || zoneCenter(zone)
    const distance = haversineMeters(dest.lat, dest.lng, center.lat, center.lng)
    if (!best || distance < best.distance) {
      best = { id: zone.id, distance }
    }
  }
  return best?.id || null
}
