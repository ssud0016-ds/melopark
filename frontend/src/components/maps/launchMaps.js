/**
 * Side-effecting glue: opens maps URL via best available scheme.
 * Epic 7 Phase 1 + Phase 4 (analytics).
 */
import { detectPlatform, preferredScheme } from '../../utils/platform'
import { track } from '../../utils/analytics'

/**
 * @typedef {import('../../utils/buildMapsUrl').MapsProvider} MapsProvider
 * @typedef {import('../../utils/buildMapsUrl').MapsMode} MapsMode
 * @typedef {import('../../utils/buildMapsUrl').LatLng} LatLng
 */

const NATIVE_FALLBACK_TIMEOUT_MS = 600

/**
 * @param {{
 *   provider: MapsProvider,
 *   mode: MapsMode,
 *   origin?: LatLng | null,
 *   destination: LatLng,
 *   onFallback?: (info: { reason: 'unsupported' | 'launch-failed', provider: MapsProvider }) => void,
 *   _now?: () => number,
 * }} args
 */
export function launchMaps(args) {
  const { provider, mode, origin, destination, onFallback } = args
  const platform = detectPlatform()
  const decision = preferredScheme(provider, platform, { mode, origin, destination })

  const eventName = mode === 'walk' ? 'nav.walk.tap' : 'nav.navigate.tap'

  if (decision.kind === 'web') {
    const win = openExternal(decision.url)
    if (!win) return // popup blocked: do not count as a tap
    track(eventName, {
      provider,
      kind: 'web',
      fallback: decision.substituted,
    })
    if (decision.substituted && typeof onFallback === 'function') {
      onFallback({ reason: 'unsupported', provider })
    }
    return
  }

  // Native attempt with web fallback after timeout.
  let cancelled = false
  let fallbackFired = false

  const cancel = () => {
    cancelled = true
    document.removeEventListener('visibilitychange', onVisibility)
  }
  const onVisibility = () => {
    if (document.hidden) cancel()
  }
  document.addEventListener('visibilitychange', onVisibility)

  let attempted = false
  try {
    attemptNativeScheme(decision.url)
    attempted = true
  } catch {
    /* fall through to web */
  }

  // Counter fires immediately on native dispatch (the tap is real).
  track(eventName, {
    provider,
    kind: 'native',
    fallback: false,
  })

  if (!attempted) {
    // Native dispatch threw; web fallback now.
    cancel()
    fireFallback('launch-failed')
    return
  }

  setTimeout(() => {
    if (cancelled) return
    cancel()
    fireFallback('launch-failed')
  }, NATIVE_FALLBACK_TIMEOUT_MS)

  function fireFallback(reason) {
    if (fallbackFired) return
    fallbackFired = true
    const win = openExternal(decision.webUrl)
    if (!win) return
    if (typeof onFallback === 'function') {
      onFallback({ reason, provider })
    }
  }
}

function openExternal(url) {
  if (typeof window === 'undefined') return null
  return window.open(url, '_blank', 'noopener')
}

function attemptNativeScheme(url) {
  if (typeof document === 'undefined') return
  // Hidden iframe pattern: triggers the registered URL handler without
  // navigating the top-level document. If no handler claims it, the
  // iframe silently fails and the timeout above launches the web URL.
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  setTimeout(() => {
    try {
      iframe.parentNode && iframe.parentNode.removeChild(iframe)
    } catch {
      /* swallow */
    }
  }, 100)
}
