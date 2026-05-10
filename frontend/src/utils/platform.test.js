import { describe, expect, it } from 'vitest'
import { detectPlatform, preferredScheme } from './platform'

const BAY = { lat: -37.8136, lng: 144.9631 }
const DEST = { lat: -37.81, lng: 144.97 }

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0'
const UA_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

describe('detectPlatform', () => {
  it('iPhone UA → ios', () => {
    expect(detectPlatform(UA_IPHONE)).toBe('ios')
  })
  it('iPad UA → ios', () => {
    expect(detectPlatform(UA_IPAD)).toBe('ios')
  })
  it('Android UA → android', () => {
    expect(detectPlatform(UA_ANDROID)).toBe('android')
  })
  it('Mac UA → desktop', () => {
    expect(detectPlatform(UA_MAC)).toBe('desktop')
  })
  it('empty UA → desktop', () => {
    expect(detectPlatform('')).toBe('desktop')
  })
})

describe('preferredScheme', () => {
  it('apple + ios → native maps://', () => {
    const r = preferredScheme('apple', 'ios', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('native')
    expect(r.url).toMatch(/^maps:\/\//)
    expect(r.substituted).toBe(false)
  })
  it('apple + android → web fallback, substituted', () => {
    const r = preferredScheme('apple', 'android', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('web')
    expect(r.substituted).toBe(true)
  })
  it('apple + desktop → web fallback, substituted', () => {
    const r = preferredScheme('apple', 'desktop', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('web')
    expect(r.substituted).toBe(true)
  })
  it('google + ios → native comgooglemaps://', () => {
    const r = preferredScheme('google', 'ios', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('native')
    expect(r.url).toMatch(/^comgooglemaps:\/\//)
  })
  it('google + android → native', () => {
    const r = preferredScheme('google', 'android', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('native')
  })
  it('google + desktop → web (not substituted)', () => {
    const r = preferredScheme('google', 'desktop', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('web')
    expect(r.substituted).toBe(false)
  })
  it('web → web (not substituted)', () => {
    const r = preferredScheme('web', 'desktop', { mode: 'drive', destination: BAY })
    expect(r.kind).toBe('web')
    expect(r.substituted).toBe(false)
  })
  it('walk mode passes origin through', () => {
    const r = preferredScheme('apple', 'ios', {
      mode: 'walk',
      origin: BAY,
      destination: DEST,
    })
    expect(r.url).toContain('saddr=')
    expect(r.url).toContain('dirflg=w')
  })
})
