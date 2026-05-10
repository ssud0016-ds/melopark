import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { launchMaps } from './launchMaps'
import { resetCounters, getCounters, getEvents } from '../../utils/analytics'

const BAY = { lat: -37.8136, lng: 144.9631 }
const DEST = { lat: -37.81, lng: 144.97 }

let openSpy
let originalUA

function setUA(ua) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  resetCounters()
  originalUA = window.navigator.userAgent
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
})

afterEach(() => {
  vi.useRealTimers()
  openSpy.mockRestore()
  setUA(originalUA)
})

describe('launchMaps', () => {
  it('google + desktop → opens web URL, fires nav.navigate.tap', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    launchMaps({ provider: 'google', mode: 'drive', destination: BAY })
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0][0]).toContain('travelmode=driving')
    expect(getCounters()['nav.navigate.tap']).toBe(1)
  })

  it('apple + desktop → web fallback + onFallback("unsupported")', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    const onFallback = vi.fn()
    launchMaps({
      provider: 'apple',
      mode: 'drive',
      destination: BAY,
      onFallback,
    })
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledWith({
      reason: 'unsupported',
      provider: 'apple',
    })
    const ev = getEvents()[0]
    expect(ev.event).toBe('nav.navigate.tap')
    expect(ev.props.fallback).toBe(true)
  })

  it('walk mode → fires nav.walk.tap', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    launchMaps({ provider: 'web', mode: 'walk', origin: BAY, destination: DEST })
    expect(getCounters()['nav.walk.tap']).toBe(1)
  })

  it('apple + iOS → native scheme attempted (counter fires)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    launchMaps({ provider: 'apple', mode: 'drive', destination: BAY })
    // Native counter recorded with kind=native
    const ev = getEvents()[0]
    expect(ev.props.kind).toBe('native')
    expect(ev.props.fallback).toBe(false)
    // Web fallback fires after timeout (no real app to take over).
    vi.advanceTimersByTime(700)
    expect(openSpy).toHaveBeenCalled()
  })

  it('does not fire counter when window.open is blocked (web path)', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    openSpy.mockImplementation(() => null)
    launchMaps({ provider: 'web', mode: 'drive', destination: BAY })
    expect(getCounters()['nav.navigate.tap']).toBeUndefined()
  })

  it('google + desktop is not flagged as substituted', () => {
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    const onFallback = vi.fn()
    launchMaps({
      provider: 'google',
      mode: 'drive',
      destination: BAY,
      onFallback,
    })
    expect(onFallback).not.toHaveBeenCalled()
  })
})
