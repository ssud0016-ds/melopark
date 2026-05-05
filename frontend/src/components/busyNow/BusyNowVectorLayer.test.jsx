import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import BusyNowVectorLayer, { styleSegment } from './BusyNowVectorLayer'
import { SEARCH_RADIUS_M } from '../../utils/mapGeo'

describe('styleSegment', () => {
  it('uses green for low pressure', () => {
    const s = styleSegment({ level: 'low', total: 5 })
    expect(s.opacity).toBe(0.85)
    expect(s.color).toBeTruthy()
  })

  it('uses red for high pressure', () => {
    const s = styleSegment({ level: 'high', total: 5 })
    expect(s.color).toBeTruthy()
    expect(s.opacity).toBe(0.85)
  })

  it('uses dim grey for unknown pressure', () => {
    const s = styleSegment({ level: 'unknown', total: 0 })
    expect(s.opacity).toBe(0.35)
  })

  it('thickens line for segments with many bays', () => {
    expect(styleSegment({ level: 'medium', total: 25 }).weight).toBe(6)
    expect(styleSegment({ level: 'medium', total: 12 }).weight).toBe(4)
    expect(styleSegment({ level: 'medium', total: 5 }).weight).toBe(3)
  })

  it('adds dashArray for high+colorBlind', () => {
    const s = styleSegment({ level: 'high', total: 5 }, { colorBlindMode: true })
    expect(s.dashArray).toBe('6,4')
  })

  it('no dash for non-CB mode', () => {
    const s = styleSegment({ level: 'high', total: 5 }, { colorBlindMode: false })
    expect(s.dashArray).toBeNull()
  })

  describe('B6 — zero-bay opacity', () => {
    it('sets opacity 0.5 when total is 0 and level is high', () => {
      const s = styleSegment({ level: 'high', total: 0 })
      expect(s.opacity).toBe(0.5)
    })

    it('sets opacity 0.5 when total is 0 and level is low', () => {
      const s = styleSegment({ level: 'low', total: 0 })
      expect(s.opacity).toBe(0.5)
    })

    it('keeps full opacity 0.85 when total is 5 and level is high', () => {
      const s = styleSegment({ level: 'high', total: 5 })
      expect(s.opacity).toBe(0.85)
    })

    it('keeps unknown-level opacity 0.35 even when total is 0', () => {
      const s = styleSegment({ level: 'unknown', total: 0 })
      expect(s.opacity).toBe(0.35)
    })
  })

  describe('destination dimming (Phase 2 — A9 / B1)', () => {
    // Use a fixed CBD anchor and offset another point by ~1 m of latitude per
    // 0.000009 deg. We pick midpoints far apart in longitude where 0.001 deg
    // ≈ 88 m at this latitude, so we can craft 599 m vs 601 m precisely.
    // Simpler: anchor the destination, and set mid_lat slightly N/S so
    // distance is purely a function of |Δlat| × 111_320 m/deg.
    const destLat = -37.8136
    const destLng = 144.9631
    const destination = { lat: destLat, lng: destLng }

    // (SEARCH_RADIUS_M − 1) m N of destination — strictly inside radius
    const closeLat = destLat + (SEARCH_RADIUS_M - 1) / 111_320
    // (SEARCH_RADIUS_M + 1) m N — strictly outside
    const farLat = destLat + (SEARCH_RADIUS_M + 1) / 111_320

    it(`keeps full opacity for segment within dimRadiusM (${SEARCH_RADIUS_M - 1} m)`, () => {
      const s = styleSegment(
        { level: 'medium', total: 10, mid_lat: closeLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      )
      expect(s.opacity).toBe(0.85)
    })

    it(`dims segment beyond dimRadiusM (${SEARCH_RADIUS_M + 1} m)`, () => {
      const s = styleSegment(
        { level: 'medium', total: 10, mid_lat: farLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      )
      expect(s.opacity).toBe(0.25)
    })

    it('does not dim when no destination set', () => {
      const s = styleSegment(
        { level: 'medium', total: 10, mid_lat: farLat, mid_lon: destLng },
        { destination: null, dimRadiusM: SEARCH_RADIUS_M },
      )
      expect(s.opacity).toBe(0.85)
    })

    it('does not dim unknown level (already dim grey)', () => {
      const s = styleSegment(
        { level: 'unknown', total: 0, mid_lat: farLat, mid_lon: destLng },
        { destination, dimRadiusM: SEARCH_RADIUS_M },
      )
      expect(s.opacity).toBe(0.35)
    })
  })
})

// ── Phase 3 — A13: ref stability across manifest refreshes ──
//
// We mock react-leaflet's useMap and the leaflet.vectorgrid module so we can
// observe whether the layer is created once and only `setUrl` is called when
// the manifest tick changes.

// Event registry that lets tests fire events on the fake layer.
const _layerListeners = {}
const fakeLayer = {
  on: vi.fn((event, cb) => { _layerListeners[event] = cb }),
  addTo: vi.fn(function () { return this }),
  setUrl: vi.fn(),
  redraw: vi.fn(),
  removeFrom: vi.fn(),
  _fireEvent(event, arg) { _layerListeners[event]?.(arg) },
}

const _mapListeners = {}
const fakeMap = {
  removeLayer: vi.fn(),
  on: vi.fn((event, cb) => { _mapListeners[event] = cb }),
  off: vi.fn((event) => { delete _mapListeners[event] }),
  _fireEvent(event, arg) { _mapListeners[event]?.(arg) },
}

vi.mock('react-leaflet', () => ({
  useMap: () => fakeMap,
}))

vi.mock('./loadVectorGrid', () => ({}))

vi.mock('leaflet.vectorgrid', () => ({}))

vi.mock('leaflet', () => {
  const protobuf = vi.fn(() => fakeLayer)
  return {
    default: {
      vectorGrid: { protobuf },
      canvas: { tile: vi.fn() },
      DomEvent: { stop: vi.fn() },
    },
  }
})

vi.mock('../../services/apiPressure', () => ({
  buildTileUrlTemplate: (m) => `/tiles?v=${m?.data_version || m?.minute_bucket || 'now'}`,
}))

describe('BusyNowVectorLayer lifecycle (Phase 3 — A13)', () => {
  beforeEach(async () => {
    fakeLayer.on.mockClear()
    fakeLayer.addTo.mockClear()
    fakeLayer.setUrl.mockClear()
    fakeLayer.redraw.mockClear()
    fakeMap.removeLayer.mockClear()
    fakeMap.on.mockClear()
    fakeMap.off.mockClear()
    // Clear captured listeners between tests.
    for (const k of Object.keys(_layerListeners)) delete _layerListeners[k]
    for (const k of Object.keys(_mapListeners)) delete _mapListeners[k]
    const L = (await import('leaflet')).default
    L.vectorGrid.protobuf.mockClear()
  })

  it('creates layer once and only calls setUrl when manifest tick changes', async () => {
    const L = (await import('leaflet')).default
    const m1 = { minute_bucket: 1, tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    const { rerender } = render(<BusyNowVectorLayer manifest={m1} />)

    expect(L.vectorGrid.protobuf).toHaveBeenCalledTimes(1)
    expect(fakeLayer.addTo).toHaveBeenCalledTimes(1)

    // Reset spy so we only count calls triggered by the rerender, not the
    // initial setUrl effect run.
    fakeLayer.setUrl.mockClear()

    // New manifest object identity, different minute_bucket → setUrl only.
    const m2 = { ...m1, minute_bucket: 2 }
    rerender(<BusyNowVectorLayer manifest={m2} />)

    expect(L.vectorGrid.protobuf).toHaveBeenCalledTimes(1) // not recreated
    expect(fakeLayer.setUrl).toHaveBeenCalledTimes(1)
    expect(fakeLayer.setUrl).toHaveBeenCalledWith('/tiles?v=2')

    // Same manifest reference rerender → no new setUrl call.
    fakeLayer.setUrl.mockClear()
    rerender(<BusyNowVectorLayer manifest={m2} />)
    expect(fakeLayer.setUrl).not.toHaveBeenCalled()
  })

  it('defers setUrl while the map is moving, then applies it on moveend', async () => {
    const m1 = { data_version: 'v1', tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    const { rerender } = render(<BusyNowVectorLayer manifest={m1} />)
    fakeLayer.setUrl.mockClear()

    fakeMap._fireEvent('movestart')
    rerender(<BusyNowVectorLayer manifest={{ ...m1, data_version: 'v2' }} />)

    expect(fakeLayer.setUrl).not.toHaveBeenCalled()

    fakeMap._fireEvent('moveend')
    expect(fakeLayer.setUrl).toHaveBeenCalledWith('/tiles?v=v2')
  })

  it('configures VectorGrid to retain nearby tiles during pans', async () => {
    const L = (await import('leaflet')).default
    const m1 = { minute_bucket: 1, tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    render(<BusyNowVectorLayer manifest={m1} />)
    const options = L.vectorGrid.protobuf.mock.calls[0][1]
    expect(options.keepBuffer).toBe(4)
    expect(options.updateWhenIdle).toBe(false)
    expect(options.updateWhenZooming).toBe(false)
  })

  it('redraws (no setUrl) when destination/dimRadiusM/colorBlindMode change', async () => {
    const m1 = { minute_bucket: 1, tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    const { rerender } = render(<BusyNowVectorLayer manifest={m1} />)
    fakeLayer.redraw.mockClear()
    fakeLayer.setUrl.mockClear()

    rerender(<BusyNowVectorLayer manifest={m1} destination={{ lat: -37.81, lng: 144.96 }} />)
    expect(fakeLayer.redraw).toHaveBeenCalled()
    expect(fakeLayer.setUrl).not.toHaveBeenCalled()
  })

  it('unmounts only when manifest goes away (toggle off)', async () => {
    const m1 = { minute_bucket: 1, tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    const { rerender } = render(<BusyNowVectorLayer manifest={m1} />)
    expect(fakeMap.removeLayer).not.toHaveBeenCalled()

    rerender(<BusyNowVectorLayer manifest={null} />)
    expect(fakeMap.removeLayer).toHaveBeenCalledTimes(1)
  })
})

// ── A2 — first-paint performance marks ───────────────────────────────────────

describe('BusyNowVectorLayer A2 — first-paint performance marks', () => {
  beforeEach(async () => {
    fakeLayer.on.mockClear()
    fakeLayer.addTo.mockClear()
    fakeLayer.setUrl.mockClear()
    fakeLayer.redraw.mockClear()
    fakeMap.removeLayer.mockClear()
    fakeMap.on.mockClear()
    fakeMap.off.mockClear()
    for (const k of Object.keys(_layerListeners)) delete _layerListeners[k]
    for (const k of Object.keys(_mapListeners)) delete _mapListeners[k]
    const L = (await import('leaflet')).default
    L.vectorGrid.protobuf.mockClear()
    vi.spyOn(performance, 'mark').mockImplementation(() => {})
    vi.spyOn(performance, 'measure').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fires busynow:paint mark and busynow:first-paint measure on first load event', () => {
    const m1 = { minute_bucket: 1, tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    render(<BusyNowVectorLayer manifest={m1} />)

    // Simulate the vectorGrid 'load' event firing.
    fakeLayer._fireEvent('load')

    expect(performance.mark).toHaveBeenCalledWith('busynow:paint')
    expect(performance.measure).toHaveBeenCalledWith(
      'busynow:first-paint',
      'busynow:on',
      'busynow:paint',
    )
  })

  it('fires the paint mark only once even if load fires multiple times (firedRef guard)', () => {
    const m1 = { minute_bucket: 1, tile_url_template: '/tiles', min_zoom: 13, max_zoom: 19 }
    render(<BusyNowVectorLayer manifest={m1} />)

    fakeLayer._fireEvent('load')
    fakeLayer._fireEvent('load')
    fakeLayer._fireEvent('load')

    const paintCalls = vi.mocked(performance.mark).mock.calls.filter(
      ([name]) => name === 'busynow:paint',
    )
    expect(paintCalls).toHaveLength(1)
  })
})
