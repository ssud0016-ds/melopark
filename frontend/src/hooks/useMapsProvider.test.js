import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMapsProvider, MAPS_PROVIDER_STORAGE_KEY } from './useMapsProvider'

beforeEach(() => {
  window.localStorage.clear()
})

describe('useMapsProvider', () => {
  it('initial provider is null when storage empty', () => {
    const { result } = renderHook(() => useMapsProvider())
    expect(result.current.provider).toBe(null)
  })

  it('reads existing valid value', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'google')
    const { result } = renderHook(() => useMapsProvider())
    expect(result.current.provider).toBe('google')
  })

  it('ignores invalid stored values', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'bing')
    const { result } = renderHook(() => useMapsProvider())
    expect(result.current.provider).toBe(null)
  })

  it('setProvider writes to localStorage', () => {
    const { result } = renderHook(() => useMapsProvider())
    act(() => result.current.setProvider('apple'))
    expect(result.current.provider).toBe('apple')
    expect(window.localStorage.getItem(MAPS_PROVIDER_STORAGE_KEY)).toBe('apple')
  })

  it('setProvider rejects unknown values', () => {
    const { result } = renderHook(() => useMapsProvider())
    act(() => result.current.setProvider('bing'))
    expect(result.current.provider).toBe(null)
  })

  it('clearProvider removes value', () => {
    window.localStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, 'google')
    const { result } = renderHook(() => useMapsProvider())
    act(() => result.current.clearProvider())
    expect(result.current.provider).toBe(null)
    expect(window.localStorage.getItem(MAPS_PROVIDER_STORAGE_KEY)).toBe(null)
  })

  it('survives localStorage write failure', () => {
    const { result } = renderHook(() => useMapsProvider())
    const orig = window.localStorage.setItem.bind(window.localStorage)
    window.localStorage.setItem = () => {
      throw new Error('quota')
    }
    try {
      act(() => result.current.setProvider('google'))
      expect(result.current.provider).toBe('google')
    } finally {
      window.localStorage.setItem = orig
    }
  })
})
