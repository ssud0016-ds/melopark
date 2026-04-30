import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useMapState } from './useMapState'

describe('Bug 2: hasRules must not block selection', () => {
  it('allows selecting bay when hasRules is false and allowDetail is true', () => {
    const bays = [
      {
        id: 'test-bay-1',
        hasRules: false,
        allowDetail: true,
      },
    ]

    const { result } = renderHook(() => useMapState())

    act(() => {
      result.current.setBaysRef(bays)
      result.current.setSelectedBayId('test-bay-1')
    })

    expect(result.current.selectedBayId).toBe('test-bay-1')
  })

  it('blocks selection when allowDetail is false', () => {
    const bays = [
      {
        id: 'blocked-bay',
        hasRules: true,
        allowDetail: false,
      },
    ]

    const { result } = renderHook(() => useMapState())

    act(() => {
      result.current.setBaysRef(bays)
      result.current.setSelectedBayId('blocked-bay')
    })

    expect(result.current.selectedBayId).toBe(null)
  })
})
