import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchForecastAlternatives,
  fetchForecastWarnings,
  type ForecastAlternativesResponse,
  type ForecastWarning,
  type WarningLevel,
} from '../services/apiForecasts';

const POLL_MS = 5 * 60 * 1000;
const LEVEL_ORDER: Record<WarningLevel, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

type Destination = { lat: number; lng: number } | null;

export function useParkingForecast({
  destination = null,
  plannerArrivalIso = null,
  enabled = true,
  hoursAhead = 6,
}: {
  destination?: Destination;
  plannerArrivalIso?: string | null;
  enabled?: boolean;
  hoursAhead?: number;
} = {}) {
  const [warnings, setWarnings] = useState<ForecastWarning[]>([]);
  const [alternatives, setAlternatives] = useState<ForecastAlternativesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWarnings = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await fetchForecastWarnings(hoursAhead);
      setWarnings(data.warnings ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'forecast warnings failed');
    }
  }, [enabled, hoursAhead]);

  useEffect(() => {
    if (!enabled) {
      setWarnings([]);
      return;
    }
    refreshWarnings();
    const id = setInterval(refreshWarnings, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refreshWarnings]);

  useEffect(() => {
    if (!enabled || !destination || destination.lat == null || destination.lng == null) {
      setAlternatives(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchForecastAlternatives(destination.lat, destination.lng, plannerArrivalIso || null)
      .then((data) => {
        if (!cancelled) setAlternatives(data);
      })
      .catch(() => {
        if (!cancelled) setAlternatives(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, destination?.lat, destination?.lng, plannerArrivalIso]);

  const worstLevel = useMemo<WarningLevel>(() => {
    const now = warnings.filter((w) => w.hours_from_now <= 1);
    if (!now.length) return 'low';
    return now.reduce<WarningLevel>(
      (best, w) =>
        (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[best] || 0) ? w.warning_level : best,
      'low',
    );
  }, [warnings]);

  const zoneWarnings = useMemo(() => {
    const byZone: Record<string, ForecastWarning> = {};
    for (const w of warnings) {
      const prev = byZone[w.zone];
      if (!prev || (LEVEL_ORDER[w.warning_level] || 0) > (LEVEL_ORDER[prev.warning_level] || 0)) {
        byZone[w.zone] = w;
      }
    }
    return Object.values(byZone).sort(
      (a, b) => (LEVEL_ORDER[b.warning_level] || 0) - (LEVEL_ORDER[a.warning_level] || 0),
    );
  }, [warnings]);

  return {
    warnings,
    zoneWarnings,
    worstLevel,
    alternatives,
    loading,
    error,
    refresh: refreshWarnings,
  };
}
