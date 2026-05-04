import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fetchPressureManifest,
  buildTileUrlTemplate,
  fetchAlternatives,
  fetchSegmentDetail,
  _resetManifestCacheForTest,
  _resetSegmentDetailCacheForTest,
} from './apiPressure'

describe('apiPressure', () => {
  beforeEach(() => {
    _resetManifestCacheForTest()
    _resetSegmentDetailCacheForTest()
    global.fetch = vi.fn()
  })

  it('caches manifest within TTL', async () => {
    const manifest = {
      minute_bucket: '2026-05-02T11:00',
      tile_url_template: '/api/pressure/tiles/{z}/{x}/{y}.mvt',
      attribution: 'attr',
    }
    global.fetch.mockResolvedValue({ ok: true, json: async () => manifest })
    await fetchPressureManifest()
    await fetchPressureManifest()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('forces refetch when force=true', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ minute_bucket: '1' }) })
    await fetchPressureManifest()
    await fetchPressureManifest({ force: true })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('builds tile URL template with version param', () => {
    const url = buildTileUrlTemplate({
      data_version: 'pressure-v1',
      minute_bucket: '2026-05-02T11:00',
      tile_url_template: '/api/pressure/tiles/{z}/{x}/{y}.mvt',
    })
    expect(url).toContain('/api/pressure/tiles/{z}/{x}/{y}.mvt')
    expect(url).toContain('?v=pressure-v1')
  })

  it('returns null tile URL when manifest missing', () => {
    expect(buildTileUrlTemplate(null)).toBeNull()
  })

  it('rejects fetchAlternatives without numeric coords', async () => {
    await expect(fetchAlternatives({ lat: 'x', lon: 1 })).rejects.toThrow(/numeric/)
  })

  it('throws on non-ok response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ detail: 'boom' }),
    })
    await expect(fetchSegmentDetail('123')).rejects.toThrow(/HTTP 500/)
  })

  it('caches segment detail per id within TTL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        segment_id: 's1',
        street_name: 'A St',
        occ_pct: 5,
        free: 1,
        total: 2,
        trend: 'flat',
        pressure: 0.2,
        level: 'low',
        events: [],
      }),
    })
    await fetchSegmentDetail('s1')
    await fetchSegmentDetail('s1')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pressure/segments/s1'),
      expect.anything(),
    )
  })

  it('refetches segment detail when cached data_version differs from request', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        segment_id: 'sv',
        data_version: 'v1',
        events: [],
        trend: 'flat',
        level: 'low',
        street_name: 'V',
        occ_pct: null,
        free: 0,
        total: 0,
        pressure: null,
      }),
    })
    await fetchSegmentDetail('sv', { dataVersion: 'v1' })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        segment_id: 'sv',
        data_version: 'v2',
        events: [],
        trend: 'flat',
        level: 'low',
        street_name: 'V',
        occ_pct: null,
        free: 0,
        total: 0,
        pressure: null,
      }),
    })
    await fetchSegmentDetail('sv', { dataVersion: 'v2' })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('refetches segment detail when force=true', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        segment_id: 's2',
        events: [],
        trend: 'flat',
        level: 'low',
        street_name: 'B',
        occ_pct: null,
        free: 0,
        total: 0,
        pressure: null,
      }),
    })
    await fetchSegmentDetail('s2')
    await fetchSegmentDetail('s2', { force: true })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
