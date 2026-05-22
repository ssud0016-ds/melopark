import { apiBase, buildUrl, fetchJson } from './api';

const MANIFEST_TTL_MS = 180_000;
const SEGMENT_DETAIL_TTL_MS = 60_000;

export type DataSourceStatus = {
  status: string;
  detail?: string;
};

export type PressureManifest = {
  data_version?: string;
  minute_bucket?: string;
  tile_url_template: string;
  total_segments?: number;
  min_zoom?: number;
  max_zoom?: number;
  attribution?: string;
  generated_at?: string;
  data_sources?: Record<string, DataSourceStatus>;
  events?: { active_count?: number };
};

export function buildTileUrlTemplate(manifest: PressureManifest | null | undefined): string | null {
  if (!manifest) return null;
  const base = apiBase();
  const v = encodeURIComponent(manifest.data_version || manifest.minute_bucket || 'now');
  const template = manifest.tile_url_template;
  const url = template.startsWith('http') ? template : `${base}${template}`;
  return `${url}?v=${v}`;
}

let _manifestCache: PressureManifest | null = null;
let _manifestCacheTs = 0;
let _manifestInflight: Promise<PressureManifest> | null = null;
const _segmentDetailCache = new Map<string, { ts: number; data: unknown; dataVersion?: string }>();
const _segmentDetailInflight = new Map<string, Promise<unknown>>();

export async function fetchPressureManifest({
  force = false,
  signal,
}: { force?: boolean; signal?: AbortSignal } = {}): Promise<PressureManifest> {
  const now = Date.now();
  if (!force && _manifestCache && now - _manifestCacheTs < MANIFEST_TTL_MS) {
    return _manifestCache;
  }
  if (_manifestInflight) return _manifestInflight;

  _manifestInflight = fetchJson<PressureManifest>(
    buildUrl('/api/pressure/tiles/manifest.json'),
    signal ? { signal } : undefined,
  )
    .then((data) => {
      _manifestCache = data;
      _manifestCacheTs = Date.now();
      return data;
    })
    .finally(() => {
      _manifestInflight = null;
    });
  return _manifestInflight;
}

export async function fetchSegmentDetail(
  segmentId: string | number,
  { signal, force = false, dataVersion }: { signal?: AbortSignal; force?: boolean; dataVersion?: string | null } = {},
): Promise<unknown> {
  const id = segmentId != null ? String(segmentId) : '';
  if (!id) throw new Error('fetchSegmentDetail requires segment id');
  const now = Date.now();
  if (!force) {
    const hit = _segmentDetailCache.get(id);
    if (hit && now - hit.ts < SEGMENT_DETAIL_TTL_MS) {
      const wantVer = dataVersion != null ? String(dataVersion) : null;
      const stale = wantVer != null && hit.dataVersion !== wantVer;
      if (!stale) return hit.data;
    }
    const inflight = _segmentDetailInflight.get(id);
    if (inflight) return inflight;
  }

  const p = fetchJson<{ data_version?: string; minute_bucket?: string }>(
    buildUrl(`/api/pressure/segments/${encodeURIComponent(id)}`),
    { signal },
  )
    .then((data) => {
      const ver = data?.data_version ?? data?.minute_bucket ?? dataVersion ?? undefined;
      _segmentDetailCache.set(id, { ts: Date.now(), data, dataVersion: ver ?? undefined });
      return data;
    })
    .finally(() => {
      _segmentDetailInflight.delete(id);
    });
  _segmentDetailInflight.set(id, p);
  return p;
}

export type PressureBounds = { west: number; south: number; east: number; north: number };

export async function fetchQuietestSegments(
  bounds: PressureBounds,
  limit = 3,
  { signal }: { signal?: AbortSignal } = {},
): Promise<unknown[]> {
  if (!bounds) throw new Error('fetchQuietestSegments requires bounds');
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  const data = await fetchJson<unknown[]>(
    buildUrl('/api/pressure/segments', { bbox, limit }),
    { signal },
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchAlternatives({
  lat,
  lon,
  radius = 800,
  limit = 3,
  signal,
}: {
  lat: number;
  lon: number;
  radius?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<unknown> {
  return fetchJson(
    buildUrl('/api/pressure/alternatives', { lat, lon, radius, limit }),
    { signal },
  );
}

// Test helpers.
export function _resetManifestCacheForTest() {
  _manifestCache = null;
  _manifestCacheTs = 0;
  _manifestInflight = null;
}

export function _resetSegmentDetailCacheForTest() {
  _segmentDetailCache.clear();
  _segmentDetailInflight.clear();
}
