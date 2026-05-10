import { describe, expect, it } from 'vitest'
import { buildMapsUrl, isValidLatLng } from './buildMapsUrl'

const MEL_BAY = { lat: -37.8136, lng: 144.9631 }
const MEL_DEST = { lat: -37.8100, lng: 144.9700 }

describe('isValidLatLng', () => {
  it('accepts finite numeric lat/lng', () => {
    expect(isValidLatLng({ lat: -37.81, lng: 144.96 })).toBe(true)
  })
  it('rejects strings', () => {
    expect(isValidLatLng({ lat: '-37.81', lng: 144.96 })).toBe(false)
  })
  it('rejects NaN', () => {
    expect(isValidLatLng({ lat: NaN, lng: 144.96 })).toBe(false)
  })
  it('rejects null', () => {
    expect(isValidLatLng(null)).toBe(false)
  })
})

describe('buildMapsUrl — google native', () => {
  it('drive includes daddr and driving mode', () => {
    const u = buildMapsUrl('google', 'drive', { destination: MEL_BAY })
    expect(u).toMatch(/^comgooglemaps:\/\//)
    expect(u).toContain('directionsmode=driving')
    expect(u).toContain(encodeURIComponent('-37.8136,144.9631'))
  })
  it('walk includes saddr and daddr', () => {
    const u = buildMapsUrl('google', 'walk', {
      origin: MEL_BAY,
      destination: MEL_DEST,
    })
    expect(u).toContain('saddr=')
    expect(u).toContain('daddr=')
    expect(u).toContain('directionsmode=walking')
  })
  it('walk without origin throws', () => {
    expect(() => buildMapsUrl('google', 'walk', { destination: MEL_DEST })).toThrow()
  })
})

describe('buildMapsUrl — apple native', () => {
  it('drive has dirflg=d', () => {
    const u = buildMapsUrl('apple', 'drive', { destination: MEL_BAY })
    expect(u).toMatch(/^maps:\/\//)
    expect(u).toContain('dirflg=d')
  })
  it('walk has dirflg=w and origin', () => {
    const u = buildMapsUrl('apple', 'walk', {
      origin: MEL_BAY,
      destination: MEL_DEST,
    })
    expect(u).toContain('dirflg=w')
    expect(u).toContain('saddr=')
  })
})

describe('buildMapsUrl — web fallback', () => {
  it('drive matches PredictionsPage canonical template', () => {
    const u = buildMapsUrl('web', 'drive', { destination: MEL_BAY })
    expect(u).toContain('https://www.google.com/maps/dir/?api=1')
    expect(u).toContain('travelmode=driving')
    expect(u).toContain(`destination=${encodeURIComponent('-37.8136,144.9631')}`)
  })
  it('walk includes origin and walking travelmode', () => {
    const u = buildMapsUrl('web', 'walk', { origin: MEL_BAY, destination: MEL_DEST })
    expect(u).toContain('travelmode=walking')
    expect(u).toContain('origin=')
    expect(u).toContain('destination=')
  })
})

describe('buildMapsUrl — invalid input', () => {
  it('throws on missing destination', () => {
    expect(() => buildMapsUrl('web', 'drive', { destination: null })).toThrow()
  })
  it('throws on non-finite lat', () => {
    expect(() =>
      buildMapsUrl('web', 'drive', { destination: { lat: Infinity, lng: 1 } }),
    ).toThrow()
  })
  it('throws on unknown provider', () => {
    expect(() =>
      // @ts-expect-error
      buildMapsUrl('bing', 'drive', { destination: MEL_BAY }),
    ).toThrow()
  })
})
