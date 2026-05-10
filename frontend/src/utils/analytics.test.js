import { describe, expect, it, beforeEach } from 'vitest'
import { track, getCounters, getEvents, resetCounters } from './analytics'

beforeEach(() => resetCounters())

describe('analytics', () => {
  it('counts repeated events', () => {
    track('nav.navigate.tap')
    track('nav.navigate.tap')
    track('nav.walk.tap')
    expect(getCounters()).toEqual({ 'nav.navigate.tap': 2, 'nav.walk.tap': 1 })
  })
  it('records props', () => {
    track('nav.navigate.tap', { provider: 'google', kind: 'web' })
    const ev = getEvents()
    expect(ev[0].props).toEqual({ provider: 'google', kind: 'web' })
  })
  it('reset clears state', () => {
    track('x')
    resetCounters()
    expect(getCounters()).toEqual({})
    expect(getEvents()).toEqual([])
  })
})
