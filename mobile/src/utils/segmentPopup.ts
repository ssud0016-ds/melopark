import type { BayStatus } from './pressureSegmentStyle';
import { getStatusFillColor } from './pressureSegmentStyle';
import type { SegmentPopupDetail } from './segmentDetailFromApi';

export const TREND_LABEL: Record<string, string> = {
  up: '↑ rising',
  down: '↓ falling',
  flat: '· steady',
};

export const TREND_ARIA: Record<string, string> = {
  up: 'rising',
  down: 'falling',
  flat: 'steady',
};

/** Web SegmentPopup CHANCE_TEXT (distinct from BusyNowPanel chip copy). */
export const SEGMENT_CHANCE_TEXT: Record<string, string> = {
  low: 'Good parking chance',
  medium: 'Getting busy',
  high: 'Hard to park',
  critical: 'Hard to park',
  unknown: 'No live estimate',
};

export function levelToTone(level: string | undefined): BayStatus {
  if (level === 'high' || level === 'critical') return 'occupied';
  if (level === 'medium') return 'caution';
  if (level === 'low') return 'available';
  return 'unknown';
}

export function statusDotColor(level: string | undefined, colorBlindMode = false): string {
  return getStatusFillColor(levelToTone(level), colorBlindMode);
}

export function coverageText(totalBays: number | undefined, hasLiveBays: boolean | undefined): string {
  if (!hasLiveBays) return 'No live bay coverage';
  if (!totalBays) return 'No live bay coverage';
  if (totalBays < 4) return 'Limited live data';
  return 'Live bays';
}

export function buildReasons(detail: SegmentPopupDetail): string[] {
  const reasons: string[] = [];
  const occ = detail.occ_pct;
  if (occ != null && occ >= 80) reasons.push('Most bays taken');
  else if (occ != null && occ >= 50) reasons.push('Bays filling up');
  if (detail.trend === 'up') reasons.push('Traffic rising');
  const evts = detail.events ?? detail.events_nearby;
  if (evts && evts.length > 0) reasons.push('Event nearby');
  if (reasons.length === 0 && detail.level === 'low') reasons.push('Bays look available');
  return reasons;
}

export function formatWhyLine(detail: SegmentPopupDetail): string | null {
  const reasons = buildReasons(detail);
  return reasons.length > 0 ? `Why: ${reasons.join(' · ')}` : null;
}

export function formatChanceLine(detail: SegmentPopupDetail): {
  chanceText: string;
  occSuffix: string;
  trendLabel: string;
  trendAria: string;
} {
  const chanceText = SEGMENT_CHANCE_TEXT[detail.level ?? 'unknown'] ?? 'No live estimate';
  const occSuffix =
    detail.occ_pct != null ? ` · ${detail.occ_pct}% taken` : '';
  const trendLabel = TREND_LABEL[detail.trend ?? ''] ?? '';
  const trendAria = TREND_ARIA[detail.trend ?? ''] ?? 'steady';
  return { chanceText, occSuffix, trendLabel, trendAria };
}

export function pressureSignalPct(detail: SegmentPopupDetail): number | null {
  return detail.pressure != null ? Math.round(detail.pressure * 100) : null;
}
