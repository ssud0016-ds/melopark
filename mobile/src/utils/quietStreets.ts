import type { QuietStreet } from '../components/sheets/ParkingChanceSheet';
import { QUIET_STREET_FLY_MS, QUIET_STREET_MAP_ZOOM } from './mapGeo';

/** Mirrors web BusyNowPanel CHANCE_TEXT. */
export const CHANCE_TEXT: Record<string, string> = {
  low: 'Good chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  unknown: 'No live estimate',
};

export type PressureSegmentRow = {
  segment_id: string;
  street_name?: string;
  level?: string;
  free?: number;
  total?: number;
  has_live_bays?: boolean;
  mid_lat?: number;
  mid_lon?: number;
  walk_distance_m?: number;
};

export function splitStreetName(name: string | undefined): { main: string; cross: string | null } {
  if (!name) return { main: name ?? '', cross: null };
  const m = name.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
  return m ? { main: m[1].trim(), cross: m[2].trim() } : { main: name, cross: null };
}

export function levelToStatus(level: string | undefined): QuietStreet['status'] {
  if (level === 'low') return 'good';
  if (level === 'medium') return 'caution';
  if (level === 'high' || level === 'critical') return 'avoid';
  return 'unknown';
}

const STATUS_TO_LEVEL: Record<QuietStreet['status'], keyof typeof CHANCE_TEXT> = {
  good: 'low',
  caution: 'medium',
  avoid: 'high',
  unknown: 'unknown',
};

export function coverageLabel(seg: Pick<PressureSegmentRow, 'has_live_bays' | 'total'>): string {
  const hasLiveBays = seg.has_live_bays !== false;
  if (!hasLiveBays) return 'No live bay coverage';
  const total = Number(seg.total ?? 0);
  if (total < 4) return 'Limited live data';
  return 'Live bays';
}

/** Web MapPage quietStreets sort + slice(0, 3). */
export function pickTopQuietStreets(segments: PressureSegmentRow[]): PressureSegmentRow[] {
  const levelScore: Record<string, number> = { low: 0, medium: 1, high: 2, unknown: 3 };
  return [...segments]
    .sort((a, b) => {
      const liveA = a.has_live_bays === false ? 1 : 0;
      const liveB = b.has_live_bays === false ? 1 : 0;
      if (liveA !== liveB) return liveA - liveB;
      const levelA = levelScore[a.level ?? 'unknown'] ?? 3;
      const levelB = levelScore[b.level ?? 'unknown'] ?? 3;
      if (levelA !== levelB) return levelA - levelB;
      return Number(b.free ?? 0) - Number(a.free ?? 0);
    })
    .slice(0, 3);
}

export function segmentToQuietStreet(seg: PressureSegmentRow): QuietStreet {
  const { main, cross } = splitStreetName(seg.street_name);
  return {
    id: String(seg.segment_id),
    name: main,
    fullStreetName: seg.street_name ?? main,
    crossStreet: cross,
    freeBays: Number(seg.free ?? 0),
    totalBays: Number(seg.total ?? 0),
    hasLiveBays: seg.has_live_bays !== false,
    status: levelToStatus(seg.level),
    coverage: coverageLabel(seg),
    midLat: seg.mid_lat,
    midLng: seg.mid_lon,
    walkM: seg.walk_distance_m,
  };
}

export function mapSegmentsToQuietStreets(segments: unknown[]): QuietStreet[] {
  const rows = (Array.isArray(segments) ? segments : []).filter(
    (s): s is PressureSegmentRow =>
      s != null && typeof s === 'object' && (s as PressureSegmentRow).segment_id != null,
  );
  return pickTopQuietStreets(rows).map(segmentToQuietStreet);
}

/** Web MapPage handleQuietStreetClick — fly + alt pin payload. */
export function buildQuietStreetSelection(street: QuietStreet): {
  lat: number;
  lng: number;
  flyOpts: { zoom: number; durationMs: number };
  altPin: {
    segmentId: string;
    lat: number;
    lng: number;
    label: string;
    subtitle: string;
  };
} | null {
  const lat = street.midLat;
  const lng = street.midLng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    lat,
    lng,
    flyOpts: { zoom: QUIET_STREET_MAP_ZOOM, durationMs: QUIET_STREET_FLY_MS },
    altPin: {
      segmentId: street.id,
      lat,
      lng,
      label: street.fullStreetName ?? street.name,
      subtitle: buildPinSubtitle(street),
    },
  };
}

/** Web MapPage buildPinSubtitle for quiet-street alt pin. */
export function buildPinSubtitle(street: QuietStreet): string {
  const level = STATUS_TO_LEVEL[street.status];
  const parts: string[] = [CHANCE_TEXT[level] ?? 'No live estimate'];
  if (street.hasLiveBays) {
    parts.push(`${street.freeBays}/${street.totalBays} bays free`);
  }
  if (street.walkM != null) {
    parts.push(`${Math.round(street.walkM)} m away`);
  }
  return parts.join(' · ');
}
