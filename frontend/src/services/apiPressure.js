/**
 * Frontend API layer for Busy Now (parking pressure) overlay.
 *
 * Endpoints:
 *   GET /api/pressure/tiles/manifest.json
 *   GET /api/pressure/tiles/{z}/{x}/{y}.mvt
 *   GET /api/pressure/segments/{segment_id}
 *   GET /api/pressure/alternatives?lat&lon
 *
 * Manifest is cached for 60 seconds in-process; tile URLs include the
 * minute_bucket as a `v` query param so browser tile cache busts cleanly
 * when the manifest version changes.
 */

const MANIFEST_TTL_MS = 60_000
const SEGMENT_DETAIL_TTL_MS = 60_000

let _manifestCache = null
let _manifestCacheTs = 0
let _manifestInflight = null

/** @type {Map<string, { ts: number, data: unknown }>} */
let _segmentDetailCache = new Map()
/** @type {Map<string, Promise<unknown>>} */
let _segmentDetailInflight = new Map()

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
}

async function _fetchJsonOrThrow(url, init) {
  const res = await fetch(url, init)
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      const d = body.detail ?? body.message
      detail = typeof d === 'string' ? d : JSON.stringify(d ?? body)
    } catch (_e) {
      detail = res.statusText
    }
    const err = new Error(`HTTP ${res.status}: ${detail}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function fetchPressureManifest({ force = false, signal } = {}) {
  const now = Date.now()
  if (!force && _manifestCache && now - _manifestCacheTs < MANIFEST_TTL_MS) {
    return _manifestCache
  }
  if (_manifestInflight) return _manifestInflight

  const url = `${apiBase()}/api/pressure/tiles/manifest.json`
  _manifestInflight = _fetchJsonOrThrow(url, signal ? { signal } : undefined)
    .then((data) => {
      _manifestCache = data
      _manifestCacheTs = Date.now()
      return data
    })
    .finally(() => {
      _manifestInflight = null
    })
  return _manifestInflight
}

export function buildTileUrlTemplate(manifest) {
  if (!manifest) return null
  const base = apiBase()
  const v = encodeURIComponent(manifest.data_version || manifest.minute_bucket || 'now')
  // Leaflet.VectorGrid uses {x}/{y}/{z} placeholders.
  return `${base}${manifest.tile_url_template}?v=${v}`
}

export async function fetchSegmentDetail(segmentId, { signal, force = false, dataVersion = null } = {}) {
  const id = segmentId != null ? String(segmentId) : ''
  if (!id) {
    throw new Error('fetchSegmentDetail requires segment id')
  }
  const now = Date.now()
  if (!force) {
    const hit = _segmentDetailCache.get(id)
    if (hit && now - hit.ts < SEGMENT_DETAIL_TTL_MS) {
      const cachedVer = hit.dataVersion
      const wantVer = dataVersion != null ? String(dataVersion) : null
      const stale =
        (wantVer != null && cachedVer == null) ||
        (wantVer != null && cachedVer != null && String(cachedVer) !== wantVer)
      if (!stale) {
        return hit.data
      }
    }
    const inflight = _segmentDetailInflight.get(id)
    if (inflight) return inflight
  }

  const url = `${apiBase()}/api/pressure/segments/${encodeURIComponent(id)}`
  const p = _fetchJsonOrThrow(url, { signal }).then((data) => {
    const ver = data?.data_version ?? data?.minute_bucket ?? dataVersion
    _segmentDetailCache.set(id, { ts: Date.now(), data, dataVersion: ver })
    return data
  }).finally(() => {
    _segmentDetailInflight.delete(id)
  })
  _segmentDetailInflight.set(id, p)
  return p
}

export async function fetchAlternatives({ lat, lon, radius = 800, limit = 3, signal } = {}) {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('fetchAlternatives requires numeric lat/lon')
  }
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(radius),
    limit: String(limit),
  })
  const url = `${apiBase()}/api/pressure/alternatives?${params.toString()}`
  return _fetchJsonOrThrow(url, { signal })
}

/**
 * Fetch quietest segments within a Leaflet bounds object.
 * @param {{ west, south, east, north }} bounds
 * @param {number} limit
 * @param {{ signal?: AbortSignal }} opts
 */
export async function fetchQuietestSegments(bounds, limit = 3, { signal } = {}) {
  if (!bounds) throw new Error('fetchQuietestSegments requires bounds')
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`
  const params = new URLSearchParams({ bbox, limit: String(limit) })
  const url = `${apiBase()}/api/pressure/segments?${params.toString()}`
  return _fetchJsonOrThrow(url, { signal })
}

// Test-only — clears module-level cache between unit tests.
export function _resetManifestCacheForTest() {
  _manifestCache = null
  _manifestCacheTs = 0
  _manifestInflight = null
}

export function _resetSegmentDetailCacheForTest() {
  _segmentDetailCache = new Map()
  _segmentDetailInflight = new Map()
}
