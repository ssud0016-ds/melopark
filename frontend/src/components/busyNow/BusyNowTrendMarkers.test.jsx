import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/apiPressure', () => ({
  fetchQuietestSegments: vi.fn(),
}))

vi.mock('leaflet', () => {
  const markerInstance = {
    addTo: vi.fn(function () { return this }),
    remove: vi.fn(),
  }
  return {
    default: {
      divIcon: vi.fn(() => ({ className: 'busy-trend-marker' })),
      marker: vi.fn(() => markerInstance),
    },
  }
})

import { fetchQuietestSegments } from '../../services/apiPressure'
import L from 'leaflet'
import BusyNowTrendMarkers from './BusyNowTrendMarkers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMap(zoom = 16) {
  const listeners = {}
  return {
    getZoom: () => zoom,
    getBounds: () => ({
      getWest: () => 144.95,
      getSouth: () => -37.82,
      getEast: () => 144.98,
      getNorth: () => -37.80,
    }),
    on: vi.fn((event, cb) => { listeners[event] = cb }),
    off: vi.fn(),
    removeLayer: vi.fn(),
    _listeners: listeners,
  }
}

function makeSegments(count, opts = {}) {
  return Array.from({ length: count }, (_, i) => ({
    segment_id: i * 3, // all divisible by 3 → all pass sparse filter
    mid_lat: -37.81 + i * 0.001,
    mid_lon: 144.96 + i * 0.001,
    trend: opts.trend ?? 'up',
    pressure: 0.4,
    level: 'medium',
    ...opts,
  }))
}

const defaultBounds = { west: 144.95, south: -37.82, east: 144.98, north: -37.80 }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BusyNowTrendMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing and does not fetch when busyNow is false', async () => {
    const map = makeMap(17)
    fetchQuietestSegments.mockResolvedValue([])

    render(<BusyNowTrendMarkers map={map} busyNow={false} bounds={defaultBounds} />)

    // Give microtasks a chance to settle
    await new Promise((r) => setTimeout(r, 0))

    expect(fetchQuietestSegments).not.toHaveBeenCalled()
    expect(L.marker).not.toHaveBeenCalled()
  })

  it('does not create markers at zoom < 16', async () => {
    const map = makeMap(15) // below threshold
    const segs = makeSegments(3)

    render(<BusyNowTrendMarkers map={map} busyNow={true} bounds={defaultBounds} quietSegments={segs} />)

    await new Promise((r) => setTimeout(r, 10))

    // fetchQuietestSegments may be called from the bounds effect but zoom check
    // prevents marker creation
    expect(L.marker).not.toHaveBeenCalled()
  })

  it('creates markers at zoom >= 16', async () => {
    const map = makeMap(16)
    const segs = makeSegments(3)

    render(<BusyNowTrendMarkers map={map} busyNow={true} bounds={defaultBounds} quietSegments={segs} />)

    await new Promise((r) => setTimeout(r, 10))

    expect(L.marker).toHaveBeenCalled()
    expect(L.marker.mock.calls.length).toBeGreaterThan(0)
  })

  it('applies sparse filter — only segment_id % 3 === 0 pass', async () => {
    const map = makeMap(17)
    // 6 segments: ids 0,1,2,3,4,5 — only 0 and 3 pass (% 3 === 0)
    const segs = Array.from({ length: 6 }, (_, i) => ({
      segment_id: i,
      mid_lat: -37.81 + i * 0.001,
      mid_lon: 144.96 + i * 0.001,
      trend: 'flat',
    }))

    render(<BusyNowTrendMarkers map={map} busyNow={true} bounds={defaultBounds} quietSegments={segs} />)

    await new Promise((r) => setTimeout(r, 10))

    // Only segment_id 0 and 3 pass the filter
    expect(L.marker.mock.calls.length).toBe(2)
  })

  it('caps markers at 50', async () => {
    const map = makeMap(17)
    // 200 segments all with id divisible by 3
    const segs = Array.from({ length: 200 }, (_, i) => ({
      segment_id: i * 3,
      mid_lat: -37.81 + i * 0.0001,
      mid_lon: 144.96 + i * 0.0001,
      trend: 'up',
    }))

    render(<BusyNowTrendMarkers map={map} busyNow={true} bounds={defaultBounds} quietSegments={segs} />)

    await new Promise((r) => setTimeout(r, 10))

    expect(L.marker.mock.calls.length).toBeLessThanOrEqual(50)
  })

  it('assigns correct aria-label for each trend value', async () => {
    const map = makeMap(17)
    const segs = [
      { segment_id: 0, mid_lat: -37.81, mid_lon: 144.96, trend: 'up' },
      { segment_id: 3, mid_lat: -37.811, mid_lon: 144.961, trend: 'flat' },
      { segment_id: 6, mid_lat: -37.812, mid_lon: 144.962, trend: 'down' },
    ]

    render(<BusyNowTrendMarkers map={map} busyNow={true} bounds={defaultBounds} quietSegments={segs} />)

    await new Promise((r) => setTimeout(r, 10))

    const htmlCalls = L.divIcon.mock.calls.map((args) => args[0].html)
    const labels = htmlCalls.map((h) => {
      const m = h.match(/aria-label="([^"]+)"/)
      return m ? m[1] : null
    })
    expect(labels).toContain('rising')
    expect(labels).toContain('steady')
    expect(labels).toContain('falling')
  })
})
