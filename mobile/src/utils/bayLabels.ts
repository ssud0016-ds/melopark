import type { Bay } from '../services/apiBays';
import type { BayEvaluation } from '../services/apiBays';

export function bayHeading(bay: Bay | null | undefined): string {
  const id = bay?.id != null ? String(bay.id) : '';
  const name = typeof bay?.name === 'string' ? bay.name.trim() : '';
  if (name) return name;
  return id ? `Bay #${id}` : 'Bay';
}

export function bayMissingStreetNote(bay: Bay | null | undefined): string | null {
  const name = typeof bay?.name === 'string' ? bay.name.trim() : '';
  if (name) return null;
  return 'Street not listed in data';
}

export function liveOccupancyLabel(bay: Bay | null | undefined): string {
  if (bay?.free === 1) return 'Free';
  if (bay?.free === 0) return 'Taken';
  return 'No sensor';
}

export function rulesVerdictLabel(evaluation: BayEvaluation | null | undefined): string {
  const v = evaluation?.verdict;
  if (v === 'yes') return 'Allowed now';
  if (v === 'no') return 'Not allowed';
  return 'Unclear';
}

export function streetShort(name: string | null | undefined): string {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^(.+?)\s+between\s+(.+?)\s+and\s+(.+)$/i);
  if (!m) return trimmed;
  return `${m[1].trim()} (${m[2].trim()} to ${m[3].trim()})`;
}
