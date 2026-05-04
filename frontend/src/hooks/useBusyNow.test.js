import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBusyNow } from './useBusyNow'
import * as apiPressure from '../services/apiPressure'

describe('useBusyNow', () => {
  beforeEach(() => {
    apiPressure._resetManifestCacheForTest()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stays idle when disabled', () => {
    const { result } = renderHook(() => useBusyNow(false))
    expect(result.current.status).toBe('idle')
    expect(result.current.manifest).toBeNull()
  })

  it('fetches manifest when enabled', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ minute_bucket: '2026', tile_url_template: '/x' }),
    })
    const { result } = renderHook(() => useBusyNow(true))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.manifest.minute_bucket).toBe('2026')
  })

  it('requests manifest without force (uses client TTL cache)', async () => {
    const spy = vi.spyOn(apiPressure, 'fetchPressureManifest').mockResolvedValue({
      minute_bucket: '2026',
      tile_url_template: '/x',
    })
    const { result } = renderHook(() => useBusyNow(true))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ force: false }))
  })

  it('records error on fetch failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'unavail',
      json: async () => ({ detail: 'down' }),
    })
    const { result } = renderHook(() => useBusyNow(true))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBeTruthy()
  })
})
