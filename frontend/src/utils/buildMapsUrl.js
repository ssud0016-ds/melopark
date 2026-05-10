/**
 * Pure URL builder for native + web maps targets.
 * Epic 7 Phase 0.
 *
 * @typedef {'google' | 'apple' | 'web'} MapsProvider
 * @typedef {'drive' | 'walk'} MapsMode
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {{ origin?: LatLng | null, destination: LatLng }} BuildOptions
 */

export function isValidLatLng(v) {
  if (!v || typeof v !== 'object') return false
  const { lat, lng } = v
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  )
}

function fmt(ll) {
  return `${ll.lat},${ll.lng}`
}

/**
 * Returns a maps URL for the canonical native scheme of the provider,
 * or the Google Maps web URL when provider === 'web'.
 *
 * @param {MapsProvider} provider
 * @param {MapsMode} mode
 * @param {BuildOptions} options
 * @returns {string}
 */
export function buildMapsUrl(provider, mode, options) {
  if (!options || !isValidLatLng(options.destination)) {
    throw new Error('buildMapsUrl: destination lat/lng required')
  }
  if (mode === 'walk' && !isValidLatLng(options.origin)) {
    throw new Error('buildMapsUrl: walk mode requires origin lat/lng')
  }

  const dest = encodeURIComponent(fmt(options.destination))
  const origin = options.origin ? encodeURIComponent(fmt(options.origin)) : null

  if (provider === 'web') {
    if (mode === 'walk') {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
  }

  if (provider === 'apple') {
    if (mode === 'walk') {
      return `maps://?saddr=${origin}&daddr=${dest}&dirflg=w`
    }
    return `maps://?daddr=${dest}&dirflg=d`
  }

  if (provider === 'google') {
    if (mode === 'walk') {
      return `comgooglemaps://?saddr=${origin}&daddr=${dest}&directionsmode=walking`
    }
    return `comgooglemaps://?daddr=${dest}&directionsmode=driving`
  }

  throw new Error(`buildMapsUrl: unknown provider "${provider}"`)
}
