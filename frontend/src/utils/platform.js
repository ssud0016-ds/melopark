/**
 * Platform detection + scheme decision for Epic 7 maps deep links.
 *
 * @typedef {'ios' | 'android' | 'desktop'} Platform
 * @typedef {import('./buildMapsUrl').MapsProvider} MapsProvider
 */
import { buildMapsUrl } from './buildMapsUrl'

/** @param {string} [ua] */
export function detectPlatform(ua) {
  const s =
    typeof ua === 'string'
      ? ua
      : typeof navigator !== 'undefined'
        ? navigator.userAgent || ''
        : ''
  if (!s) return 'desktop'
  // iPad on iPadOS 13+ reports as Mac with touch; treat MacIntel + touch as ios.
  if (/iPhone|iPad|iPod/.test(s)) return 'ios'
  if (
    typeof navigator !== 'undefined' &&
    /Macintosh/.test(s) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  ) {
    return 'ios'
  }
  if (/Android/i.test(s)) return 'android'
  return 'desktop'
}

/**
 * Returns whether the chosen provider can be launched natively on
 * this platform, plus the URL to use.
 *
 * Native is only attempted when the provider scheme is known to work
 * on the platform. Otherwise, the canonical Google Maps web URL is
 * returned so callers can `window.open` directly.
 *
 * @param {MapsProvider} provider
 * @param {Platform} platform
 * @param {{ mode: import('./buildMapsUrl').MapsMode, origin?: import('./buildMapsUrl').LatLng | null, destination: import('./buildMapsUrl').LatLng }} options
 */
export function preferredScheme(provider, platform, options) {
  const webUrl = buildMapsUrl('web', options.mode, options)

  if (provider === 'web') {
    return { kind: 'web', url: webUrl, substituted: false }
  }

  if (provider === 'apple') {
    if (platform === 'ios') {
      return {
        kind: 'native',
        url: buildMapsUrl('apple', options.mode, options),
        webUrl,
        substituted: false,
      }
    }
    return { kind: 'web', url: webUrl, substituted: true }
  }

  if (provider === 'google') {
    if (platform === 'ios' || platform === 'android') {
      return {
        kind: 'native',
        url: buildMapsUrl('google', options.mode, options),
        webUrl,
        substituted: false,
      }
    }
    return { kind: 'web', url: webUrl, substituted: false }
  }

  throw new Error(`preferredScheme: unknown provider "${provider}"`)
}
