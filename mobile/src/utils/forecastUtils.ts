import { Linking } from 'react-native';

import type { ForecastWarning, WarningLevel } from '../services/apiForecasts';

export const FORECAST_HOURS = [0, 1, 2, 3, 4, 5, 6] as const;
export const FORECAST_HOUR_LABELS = ['Now', '+1h', '+2h', '+3h', '+4h', '+5h', '+6h'] as const;

export const LEVEL_ORDER: Record<WarningLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

export type ForecastTier = {
  color: string;
  label: string;
  bg: string;
  bgDark: string;
  border: string;
  text: string;
};

/** Web TIERS constant from PredictionsPage.jsx */
export const FORECAST_TIERS: Record<WarningLevel, ForecastTier> = {
  low: {
    color: '#1D9E75',
    label: 'Low',
    bg: '#E8F8F2',
    bgDark: 'rgba(29,158,117,0.18)',
    border: '#9FE1CB',
    text: '#085041',
  },
  moderate: {
    color: '#BA7517',
    label: 'Moderate',
    bg: '#FEF3E2',
    bgDark: 'rgba(186,117,23,0.18)',
    border: '#FAC775',
    text: '#633806',
  },
  high: {
    color: '#D85A30',
    label: 'High',
    bg: '#FEF0EB',
    bgDark: 'rgba(216,90,48,0.18)',
    border: '#F5C4B3',
    text: '#712B13',
  },
  critical: {
    color: '#E24B4A',
    label: 'Very busy',
    bg: '#FEEBEB',
    bgDark: 'rgba(226,75,74,0.18)',
    border: '#F7C1C1',
    text: '#791F1F',
  },
};

const LEVEL_OCC_FALLBACK: Record<WarningLevel, number> = {
  low: 0.3,
  moderate: 0.55,
  high: 0.8,
  critical: 0.95,
};

export type CbdHourPoint = {
  h: number;
  occ: number;
  level: WarningLevel;
};

export type CbdSignal = {
  head: string;
  sub: string;
  level: WarningLevel;
};

export function splitZone(zone: string): [string, string | null] {
  const m = zone.match(/^(.+?)\s*\((.+)\)$/);
  return m ? [m[1], m[2]] : [zone, null];
}

export function drive(distanceM: number | null | undefined): { km: string; mins: number } | null {
  if (!distanceM || distanceM <= 0) return null;
  return {
    km: (distanceM / 1000).toFixed(1),
    mins: Math.max(1, Math.round((distanceM / 1000 / 0.4) * 5)),
  };
}

export function occupancyPct(
  w: ForecastWarning | { predicted_occupancy?: number; warning_level?: WarningLevel },
): number {
  if (typeof w.predicted_occupancy === 'number') return Math.round(w.predicted_occupancy * 100);
  return Math.round((LEVEL_OCC_FALLBACK[w.warning_level ?? 'low'] ?? 0.3) * 100);
}

export function altOccupancyPct(alt: {
  predicted_occ?: number;
  alt_predicted_occupancy?: number;
  predicted_occupancy?: number;
}): number {
  const occ = alt.predicted_occ ?? alt.alt_predicted_occupancy ?? alt.predicted_occupancy ?? 0;
  return Math.round(occ * 100);
}

export function zonesAtCurrentHour(warnings: ForecastWarning[]): ForecastWarning[] {
  const byZone: Record<string, ForecastWarning> = {};
  for (const w of warnings) {
    if (w.hours_from_now !== 0) continue;
    const prev = byZone[w.zone];
    if (!prev || (LEVEL_ORDER[w.warning_level] ?? 0) > (LEVEL_ORDER[prev.warning_level] ?? 0)) {
      byZone[w.zone] = w;
    }
  }
  return Object.values(byZone);
}

/** Web PredictionsPage cbdChart — average occupancy per hour across all zones. */
export function buildCbdHourlyChart(warnings: ForecastWarning[]): CbdHourPoint[] {
  return FORECAST_HOURS.map((h) => {
    const sl = warnings.filter((w) => w.hours_from_now === h);
    if (!sl.length) return { h, occ: 0.19, level: 'low' as WarningLevel };
    const avg =
      sl.reduce((s, w) => s + (w.predicted_occupancy ?? LEVEL_OCC_FALLBACK[w.warning_level]), 0) / sl.length;
    const level = sl.reduce<WarningLevel>(
      (best, w) => ((LEVEL_ORDER[w.warning_level] ?? 0) > (LEVEL_ORDER[best] ?? 0) ? w.warning_level : best),
      'low',
    );
    return { h, occ: avg, level };
  });
}

export function buildTopFreeZones(zones: ForecastWarning[], limit = 6): ForecastWarning[] {
  return [...zones]
    .sort((a, b) => (a.predicted_occupancy ?? 1) - (b.predicted_occupancy ?? 1))
    .slice(0, limit);
}

export function buildBusiestZones(zones: ForecastWarning[], limit = 3): ForecastWarning[] {
  return [...zones]
    .sort((a, b) => (b.predicted_occupancy ?? 0) - (a.predicted_occupancy ?? 0))
    .slice(0, limit);
}

export function worstLevelFromZones(zones: ForecastWarning[]): WarningLevel {
  if (!zones.length) return 'low';
  return zones.reduce<WarningLevel>(
    (best, w) => ((LEVEL_ORDER[w.warning_level] ?? 0) > (LEVEL_ORDER[best] ?? 0) ? w.warning_level : best),
    'low',
  );
}

export function buildCbdSignals(
  cbdChart: CbdHourPoint[],
  topFree: ForecastWarning[],
  busiest: ForecastWarning[],
): CbdSignal[] {
  const peakIdx = cbdChart.reduce((b, d, i) => (d.occ > cbdChart[b].occ ? i : b), 0);
  const peakPct = Math.round(cbdChart[peakIdx]?.occ * 100);
  const signals: CbdSignal[] = [];

  if (topFree[0]) {
    const [head] = splitZone(topFree[0].zone);
    signals.push({
      head,
      sub: `${occupancyPct(topFree[0])}% occupied, best now`,
      level: topFree[0].warning_level,
    });
  }

  const rising = (cbdChart[1]?.occ ?? 0) > (cbdChart[0]?.occ ?? 0);
  signals.push({
    head: `Pressure ${rising ? 'rising' : 'easing'}`,
    sub: `${Math.round((cbdChart[1]?.occ ?? 0) * 100)}% at +1 hour`,
    level: 'moderate',
  });

  if (busiest[0]) {
    const [head] = splitZone(busiest[0].zone);
    signals.push({
      head,
      sub: `${occupancyPct(busiest[0])}% occupied, avoid`,
      level: 'high',
    });
  }

  signals.push({
    head: `Peak at ${FORECAST_HOUR_LABELS[peakIdx]}`,
    sub: `${peakPct}% CBD average`,
    level: 'moderate',
  });

  return signals;
}

export function zoneChartForZone(
  warnings: ForecastWarning[],
  zoneName: string,
): { h: number; occ: number; level: WarningLevel }[] {
  return FORECAST_HOURS.map((h) => {
    const w = warnings.find((x) => x.zone === zoneName && x.hours_from_now === h);
    return {
      h,
      occ: w?.predicted_occupancy ?? 0,
      level: w?.warning_level ?? 'low',
    };
  });
}

export function openGoogleMapsDirections(lat: number, lon: number): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  Linking.openURL(url).catch(() => {});
}
