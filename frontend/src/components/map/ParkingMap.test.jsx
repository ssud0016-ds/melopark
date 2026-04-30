import { describe, expect, it } from 'vitest'

import { getBayMarkerPathOptions, MOBILE_CLUSTER_ZOOM_HINT } from './ParkingMap'

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
