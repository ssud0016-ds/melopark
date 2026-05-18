import { dedupeByKey } from './dedupeByKey';
import type { BayStatus } from './pressureSegmentStyle';
import { getStatusFillColor } from './pressureSegmentStyle';
import type {
  PressureAlternativeZone,
  PressureTargetZone,
} from '../types/pressureAlternatives';

/** Web BusyNowPanel LEVEL_RANK */
export const LEVEL_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  unknown: 3,
};

/** Web BusyNowPanel CHANCE_TEXT. */
export const DESTINATION_CHANCE_TEXT: Record<string, string> = {
  low: 'Good chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  unknown: 'No live estimate',
};

export function splitStreetName(name: string | undefined): { main: string; cross: string | null } {
  if (!name) return { main: name ?? '', cross: null };
  const m = name.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
  return m ? { main: m[1].trim(), cross: m[2].trim() } : { main: name, cross: null };
}

export function targetZoneMainLabel(label: string | undefined): string {
  return splitStreetName(label).main;
}

export function levelToTone(level: string | undefined): BayStatus {
  if (level === 'high' || level === 'critical') return 'occupied';
  if (level === 'medium') return 'caution';
  if (level === 'low') return 'available';
  return 'unknown';
}

export function chanceLabelForLevel(level: string | undefined): string {
  return DESTINATION_CHANCE_TEXT[level ?? 'unknown'] ?? DESTINATION_CHANCE_TEXT.unknown;
}

export function targetZoneBarPct(zone: Pick<PressureTargetZone, 'pressure'>): number {
  return Math.min(100, Math.max(0, Math.round((zone.pressure ?? 0) * 100)));
}

export function targetZoneBarColor(level: string | undefined, colorBlindMode = false): string {
  return getStatusFillColor(levelToTone(level), colorBlindMode);
}

export function isTargetZoneBusy(level: string | undefined): boolean {
  return level === 'high' || level === 'medium';
}

export function formatTargetZoneMetadata(zone: PressureTargetZone): string {
  const main = targetZoneMainLabel(zone.label);
  const chance = chanceLabelForLevel(zone.level);
  const free = zone.free_bays ?? 0;
  const total = zone.total_bays ?? 0;
  return `Destination: ${main} · ${chance} · ${free}/${total} bays free`;
}

/** Web BusyNowPanel displayLabel */
export function displayAlternativeLabel(label: string | undefined, zoneId?: string | number): string {
  const raw = label || (zoneId != null ? `Zone ${zoneId}` : 'Zone');
  if (/^Zone \d+$/.test(raw)) return `Nearby · ${raw}`;
  return raw;
}

/** Web BusyNowPanel betterAlternatives filter/sort/slice */
export function pickBetterAlternatives(
  target: PressureTargetZone | null | undefined,
  alternatives: PressureAlternativeZone[] | undefined,
): PressureAlternativeZone[] {
  if (!target) return [];
  const targetRank = LEVEL_RANK[target.level ?? 'unknown'] ?? 3;
  const targetPressure = Number(target.pressure ?? 1);
  const unique = dedupeByKey(alternatives ?? [], (alt) => String(alt.zone_id));
  return unique
    .filter((alt) => {
      const rank = LEVEL_RANK[alt.level ?? 'unknown'] ?? 3;
      const pressure = Number(alt.pressure ?? 1);
      return rank < targetRank || pressure < targetPressure;
    })
    .sort((a, b) => {
      const rankDiff = (LEVEL_RANK[a.level ?? 'unknown'] ?? 3) - (LEVEL_RANK[b.level ?? 'unknown'] ?? 3);
      if (rankDiff !== 0) return rankDiff;
      const pressureDiff = Number(a.pressure ?? 1) - Number(b.pressure ?? 1);
      if (pressureDiff !== 0) return pressureDiff;
      return Number(a.walk_distance_m ?? 9999) - Number(b.walk_distance_m ?? 9999);
    })
    .slice(0, 3);
}

export function formatAlternativeRowMeta(alt: PressureAlternativeZone): string {
  const chance = chanceLabelForLevel(alt.level);
  const free = alt.free_bays ?? 0;
  return `${chance} · ${free} bays free`;
}

/** Web MapPage buildPinSubtitle for alternative alt pin card */
export function buildAlternativePinSubtitle(alt: PressureAlternativeZone): string {
  const parts: string[] = [];
  const chance = chanceLabelForLevel(alt.level);
  if (chance) parts.push(chance);
  if (alt.free_bays != null) parts.push(`${alt.free_bays} bays free`);
  if (alt.walk_distance_m != null) parts.push(`${alt.walk_distance_m} m away`);
  return parts.join(' · ');
}

export function alternativeRowAccessibilityLabel(alt: PressureAlternativeZone): string {
  const label = displayAlternativeLabel(alt.label, alt.zone_id);
  const chance = chanceLabelForLevel(alt.level);
  const free = alt.free_bays ?? 0;
  const dist = alt.walk_distance_m ?? 0;
  return `${label} — ${chance}, ${free} bays free, ${dist}m away`;
}
