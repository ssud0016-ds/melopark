import { describe, expect, it } from 'vitest'
import {
  buildZoneDemandSnapshot,
  buildZoneAvailabilitySnapshot,
  chooseOptimalZoneId,
} from './zoneDemand'
import { normToLatLng } from './mapGeo'

function liveBayAt(x, y, free) {
  const { lat, lng } = normToLatLng(x, y)
  return {
    id: `${x}-${y}-${free}`,
    source: 'live',
    type: free === 1 ? 'available' : 'occupied',
    free,
    lat,
    lng,
  }
}

describe('buildZoneDemandSnapshot', () => {
  it('classifies low, moderate and high demand from live sensor occupancy', () => {
    const bays = [
      // North-West (low: 1/4 occupied)
      liveBayAt(0.1, 0.1, 1),
      liveBayAt(0.12, 0.14, 1),
      liveBayAt(0.16, 0.2, 1),
      liveBayAt(0.2, 0.2, 0),
      // North-Central (moderate: 2/4 occupied)
      liveBayAt(0.4, 0.1, 1),
      liveBayAt(0.45, 0.2, 1),
      liveBayAt(0.5, 0.15, 0),
      liveBayAt(0.55, 0.25, 0),
      // North-East (high: 3/4 occupied)
      liveBayAt(0.8, 0.1, 1),
      liveBayAt(0.75, 0.2, 0),
      liveBayAt(0.9, 0.15, 0),
      liveBayAt(0.85, 0.3, 0),
    ]

    const zones = buildZoneDemandSnapshot(bays)

    expect(zones.find((z) => z.id === 'nw')?.level).toBe('low')
    expect(zones.find((z) => z.id === 'nc')?.level).toBe('moderate')
    expect(zones.find((z) => z.id === 'ne')?.level).toBe('high')
  })

  it('marks zones as no live data when only demo bays exist', () => {
    const { lat, lng } = normToLatLng(0.1, 0.1)
    const zones = buildZoneDemandSnapshot([
      { id: 'demo-1', source: 'demo', type: 'available', free: 1, lat, lng },
    ])
    expect(zones.every((z) => z.hasLiveData === false)).toBe(true)
  })
})

describe('buildZoneAvailabilitySnapshot', () => {
  it('counts available live bays per zone', () => {
    const zones = buildZoneAvailabilitySnapshot([
      liveBayAt(0.1, 0.1, 1),
      liveBayAt(0.2, 0.2, 1),
      liveBayAt(0.25, 0.3, 0),
      { ...liveBayAt(0.15, 0.2, 1), source: 'demo' },
    ])

    const northWest = zones.find((z) => z.id === 'nw')
    expect(northWest?.availableBayCount).toBe(2)
    expect(northWest?.liveBayCount).toBe(3)
  })
})

describe('chooseOptimalZoneId', () => {
  it('chooses nearest zone among lowest-pressure visible zones', () => {
    const zones = buildZoneDemandSnapshot([
      // NW: low 1/4 occupied
      liveBayAt(0.1, 0.1, 1),
      liveBayAt(0.11, 0.14, 1),
      liveBayAt(0.16, 0.2, 1),
      liveBayAt(0.2, 0.25, 0),
      // SW: same low 1/4 occupied
      liveBayAt(0.1, 0.6, 1),
      liveBayAt(0.13, 0.7, 1),
      liveBayAt(0.2, 0.8, 1),
      liveBayAt(0.22, 0.9, 0),
      // NC: moderate 2/4 occupied
      liveBayAt(0.4, 0.2, 1),
      liveBayAt(0.5, 0.2, 1),
      liveBayAt(0.45, 0.25, 0),
      liveBayAt(0.55, 0.3, 0),
    ])

    const mapBounds = { south: -37.83, west: 144.94, north: -37.80, east: 144.98 }
    const destination = { lat: -37.821, lng: 144.95 } // closer to SW than NW
    expect(chooseOptimalZoneId(zones, destination, mapBounds)).toBe('sw')
  })

  it('returns null when fewer than two visible zones', () => {
    const zones = buildZoneDemandSnapshot([
      liveBayAt(0.1, 0.1, 1),
      liveBayAt(0.11, 0.14, 1),
      liveBayAt(0.16, 0.2, 1),
      liveBayAt(0.2, 0.25, 0),
    ])
    const tightBounds = { south: -37.812, west: 144.948, north: -37.805, east: 144.956 }
    const destination = { lat: -37.81, lng: 144.95 }
    expect(chooseOptimalZoneId(zones, destination, tightBounds)).toBeNull()
  })
})
