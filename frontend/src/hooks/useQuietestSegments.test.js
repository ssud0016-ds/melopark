import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuietestSegments } from './useQuietestSegments'

const MOCK_BOUNDS = { west: 144.95, south: -37.82, east: 144.98, north: -37.80 }

const MOCK_SEGMENTS = [
  { segment_id: '1', street_name: 'Lygon St', pressure: 0.1, level: 'low', free: 7, total: 9, mid_lat: -37.81, mid_lon: 144.96 },
  { segment_id: '2', street_name: 'Swanston St', pressure: 0.2, level: 'low', free: 5, total: 8, mid_lat: -37.812, mid_lon: 144.962 },
  { segment_id: '3', street_name: 'Collins St', pressure: 0.35, level: 'low', free: 3, total: 6, mid_lat: -37.814, mid_lon: 144.964 },
]

describe('useQuietestSegments', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_SEGMENTS,
    })
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns empty segments and no loading when enabled=false', () => {
    const { result } = renderHook(() =>
      useQuietestSegments({ bounds: MOCK_BOUNDS, enabled: false })
    )
    expect(result.current.segments).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns empty segments when bounds is null', () => {
    const { result } = renderHook(() =>
      useQuietestSegments({ bounds: null, enabled: true })
    )
    expect(result.current.segments).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('debounces fetch by 500ms — no fetch before delay', () => {
    renderHook(() =>
      useQuietestSegments({ bounds: MOCK_BOUNDS, enabled: true })
    )
    act(() => { vi.advanceTimersByTime(400) })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fires fetch after 500ms debounce', async () => {
    renderHook(() =>
      useQuietestSegments({ bounds: MOCK_BOUNDS, enabled: true })
    )
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(global.fetch).toHaveBeenCalledOnce()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pressure/segments'),
      expect.any(Object)
    )
  })

  it('returns segments after successful fetch', async () => {
    const { result } = renderHook(() =>
      useQuietestSegments({ bounds: MOCK_BOUNDS, enabled: true })
    )
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.segments).toHaveLength(3)
    expect(result.current.segments[0].street_name).toBe('Lygon St')
  })

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(
      ({ enabled }) => useQuietestSegments({ bounds: MOCK_BOUNDS, enabled }),
      { initialProps: { enabled: false } }
    )
    act(() => { vi.advanceTimersByTime(600) })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.segments).toEqual([])
  })

  it('resets segments when enabled switches to false after fetch', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useQuietestSegments({ bounds: MOCK_BOUNDS, enabled }),
      { initialProps: { enabled: true } }
    )
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.segments).toHaveLength(3)

    rerender({ enabled: false })
    expect(result.current.segments).toEqual([])
  })

  it('includes bbox query parameter in the URL', async () => {
    renderHook(() =>
      useQuietestSegments({ bounds: MOCK_BOUNDS, enabled: true })
    )
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(global.fetch).toHaveBeenCalled()
    const calledUrl = global.fetch.mock.calls[0][0]
    expect(calledUrl).toContain('bbox=144.95')
    expect(calledUrl).toContain('limit=150')
  })
})
