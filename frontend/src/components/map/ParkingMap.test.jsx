import { describe, expect, it } from 'vitest'

import {
  getBayMarkerPathOptions,
  getClusterBadgeColors,
  getStatusFillColor,
  MOBILE_CLUSTER_ZOOM_HINT,
} from './ParkingMap'

describe('ParkingMap map hints', () => {
  it('uses clear mobile cluster-mode zoom copy', () => {
    expect(MOBILE_CLUSTER_ZOOM_HINT).toBe('Zoom in to view individual bays')
    expect(MOBILE_CLUSTER_ZOOM_HINT).not.toMatch(/for bays\b/i)
  })
})

describe('ParkingMap marker accessibility styles', () => {
  it('uses clean filled-circle styles without stroke variants', () => {
    const available = getBayMarkerPathOptions('available', '#a3ec48', 0.7)
    const caution = getBayMarkerPathOptions('caution', '#FFB382', 0.7)
    const occupied = getBayMarkerPathOptions('occupied', '#ed6868', 0.7)
    const unknown = getBayMarkerPathOptions('unknown', '#ed6868', 0.7)

    expect(available.weight).toBe(0)
    expect(available.dashArray).toBeUndefined()
    expect(available.color).toBe('#a3ec48')

    expect(caution.weight).toBe(0)
    expect(caution.dashArray).toBeUndefined()
    expect(caution.color).toBe('#FFB382')

    expect(occupied.weight).toBe(0)
    expect(occupied.dashArray).toBeUndefined()
    expect(occupied.color).toBe('#ed6868')

    expect(unknown.weight).toBe(0)
    expect(unknown.dashArray).toBeUndefined()
    expect(unknown.color).toBe('#ed6868')
  })
})

describe('ParkingMap color-blind palette', () => {
  it('uses default palette when color-blind mode is off', () => {
    expect(getStatusFillColor('available', false)).toBe('#a3ec48')
    expect(getStatusFillColor('caution', false)).toBe('#FFB382')
    expect(getStatusFillColor('occupied', false)).toBe('#ed6868')
  })

  it('uses color-blind palette when mode is on', () => {
    expect(getStatusFillColor('available', true)).toBe('#3b82f6')
    expect(getStatusFillColor('caution', true)).toBe('#f59e0b')
    expect(getStatusFillColor('occupied', true)).toBe('#374151')
  })

  it('applies color-blind palette to cluster badges', () => {
    const normal = getClusterBadgeColors({
      available: 6,
      occupied: 0,
      trap: 0,
      total: 6,
      isDark: false,
      colorBlindMode: false,
    })
    const cb = getClusterBadgeColors({
      available: 6,
      occupied: 0,
      trap: 0,
      total: 6,
      isDark: false,
      colorBlindMode: true,
    })
    expect(normal.bg).toBe('#a3ec48')
    expect(cb.bg).toBe('#3b82f6')
  })
})
