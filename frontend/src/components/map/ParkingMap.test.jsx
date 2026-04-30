import { describe, expect, it } from 'vitest'

import { MOBILE_CLUSTER_ZOOM_HINT } from './ParkingMap'

describe('ParkingMap map hints', () => {
  it('uses clear mobile cluster-mode zoom copy', () => {
    expect(MOBILE_CLUSTER_ZOOM_HINT).toBe('Zoom in to view individual bays')
    expect(MOBILE_CLUSTER_ZOOM_HINT).not.toMatch(/for bays\b/i)
  })
})
