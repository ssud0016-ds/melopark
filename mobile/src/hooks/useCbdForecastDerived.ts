import { useMemo } from 'react';

import type { ForecastWarning, WarningLevel } from '../services/apiForecasts';
import {
  buildBusiestZones,
  buildCbdHourlyChart,
  buildCbdSignals,
  buildTopFreeZones,
  FORECAST_HOUR_LABELS,
  FORECAST_TIERS,
  type CbdHourPoint,
  type CbdSignal,
  worstLevelFromZones,
  zonesAtCurrentHour,
} from '../utils/forecastUtils';

export function useCbdForecastDerived(warnings: ForecastWarning[]) {
  return useMemo(() => {
    const cbdChart = buildCbdHourlyChart(warnings);
    const zones = zonesAtCurrentHour(warnings);
    const topFree = buildTopFreeZones(zones, 6);
    const busiest = buildBusiestZones(zones, 3);
    const worstLevel = worstLevelFromZones(zones);

    const cbdOcc = Math.round((cbdChart[0]?.occ ?? 0.19) * 100);
    const cbdLv = cbdChart[0]?.level ?? 'low';
    const cbdTier = FORECAST_TIERS[cbdLv];
    const cbdFree = 100 - cbdOcc;

    const peakIdx = cbdChart.reduce((b, d, i) => (d.occ > cbdChart[b].occ ? i : b), 0);
    const peakPct = Math.round(cbdChart[peakIdx]?.occ * 100);
    const signals = buildCbdSignals(cbdChart, topFree, busiest);

    const best = topFree[0];
    const bestMain = best ? best.zone.split(' (')[0] : 'N/A';

    return {
      cbdChart,
      zones,
      topFree,
      busiest,
      worstLevel,
      cbdOcc,
      cbdLv,
      cbdTier,
      cbdFree,
      peakIdx,
      peakPct,
      peakLabel: FORECAST_HOUR_LABELS[peakIdx],
      signals,
      bestMain,
      best,
    };
  }, [warnings]);
}

export type CbdForecastDerived = {
  cbdChart: CbdHourPoint[];
  zones: ForecastWarning[];
  topFree: ForecastWarning[];
  busiest: ForecastWarning[];
  worstLevel: WarningLevel;
  cbdOcc: number;
  cbdLv: WarningLevel;
  cbdTier: (typeof FORECAST_TIERS)[WarningLevel];
  cbdFree: number;
  peakIdx: number;
  peakPct: number;
  peakLabel: string;
  signals: CbdSignal[];
  bestMain: string;
  best: ForecastWarning | undefined;
};
