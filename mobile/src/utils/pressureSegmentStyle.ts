import { haversineMeters, SEARCH_RADIUS_M } from './mapGeo';

/** Bay-dot / pressure stroke colours (match web ParkingMap). */
const VERIFIED_FILL = {
  available: '#a3ec48',
  trap: '#FFB382',
  occupied: '#ed6868',
} as const;

const VERIFIED_FILL_COLOR_BLIND = {
  available: '#3b82f6',
  trap: '#f59e0b',
  occupied: '#374151',
} as const;

export const PRESSURE_UNKNOWN_COLOR = '#cbd5e1';
export const PRESSURE_UNKNOWN_COLOR_BLIND = '#9ca3af';

export type BayStatus = 'available' | 'caution' | 'trap' | 'occupied' | 'unknown';

export function getStatusFillColor(status: BayStatus, colorBlindMode = false): string {
  const palette = colorBlindMode ? VERIFIED_FILL_COLOR_BLIND : VERIFIED_FILL;
  if (status === 'caution' || status === 'trap' || status === 'unknown') return palette.trap;
  if (status === 'occupied') return palette.occupied;
  return palette.available;
}

export type SegmentProps = {
  level?: string;
  total?: number | string;
  mid_lat?: number;
  mid_lon?: number;
};

export type StyleSegmentOptions = {
  colorBlindMode?: boolean;
  destination?: { lat: number; lng: number } | null;
  dimRadiusM?: number;
};

export type SegmentStyle = {
  color: string;
  weight: number;
  opacity: number;
  dashArray: string | null;
  lineCap: 'round';
  lineJoin: 'round';
};

/** Mirrors web BusyNowVectorLayer.styleSegment. */
export function styleSegment(
  props: SegmentProps | null | undefined,
  { colorBlindMode = false, destination = null, dimRadiusM = SEARCH_RADIUS_M }: StyleSegmentOptions = {},
): SegmentStyle {
  const { level = 'unknown', total = 0, mid_lat, mid_lon } = props || {};
  const totalNum = Number(total);
  let color: string;
  let opacity = 0.85;

  if (level === 'high') color = getStatusFillColor('occupied', colorBlindMode);
  else if (level === 'medium') color = getStatusFillColor('caution', colorBlindMode);
  else if (level === 'low') color = getStatusFillColor('available', colorBlindMode);
  else {
    color = colorBlindMode ? PRESSURE_UNKNOWN_COLOR_BLIND : PRESSURE_UNKNOWN_COLOR;
    opacity = 0.35;
  }

  if (totalNum === 0 && level !== 'unknown') {
    opacity = 0.5;
  }

  if (
    destination &&
    typeof mid_lat === 'number' &&
    typeof mid_lon === 'number' &&
    typeof destination.lat === 'number' &&
    typeof destination.lng === 'number' &&
    level !== 'unknown'
  ) {
    const d = haversineMeters(mid_lat, mid_lon, destination.lat, destination.lng);
    if (d > dimRadiusM) opacity = 0.25;
  }

  const weight = totalNum >= 20 ? 6 : totalNum >= 10 ? 4 : 3;
  const dashArray = level === 'high' && colorBlindMode ? '6,4' : null;

  return { color, weight, opacity, dashArray, lineCap: 'round', lineJoin: 'round' };
}
