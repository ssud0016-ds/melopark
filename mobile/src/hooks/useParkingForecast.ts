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

type LatLng = { lat: number; lng: number } | null;

export function useParkingForecast({
  destination = null,
  selectedZone = null,
  plannerArrivalIso = null,
  enabled = true,
  hoursAhead = 6,
}: {
  destination?: LatLng;
  selectedZone?: LatLng;
  plannerArrivalIso?: string | null;
  enabled?: boolean;
  hoursAhead?: number;
} = {}) {
  const [warnings, setWarnings] = useState<ForecastWarning[]>([]);
  const [alternatives, setAlternatives] = useState<ForecastAlternativesResponse | null>(null);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWarnings = useCallback(async () => {
    if (!enabled) return;
    try {
      setWarningsLoading(true);
      const data = await fetchForecastWarnings(hoursAhead);
      setWarnings(data.warnings ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'forecast warnings failed');
    } finally {
      setWarningsLoading(false);
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

  const altCoords = useMemo(() => {
    if (selectedZone?.lat != null && selectedZone?.lng != null) return selectedZone;
    if (destination?.lat != null && destination?.lng != null) return destination;
    return null;
  }, [selectedZone?.lat, selectedZone?.lng, destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!enabled || !altCoords) {
      setAlternatives(null);
      return;
    }
    let cancelled = false;
    setAlternativesLoading(true);
    fetchForecastAlternatives(altCoords.lat, altCoords.lng, plannerArrivalIso || null)
      .then((data) => {
        if (!cancelled) setAlternatives(data);
      })
      .catch(() => {
        if (!cancelled) setAlternatives({ target_zone: null, alternatives: [] });
      })
      .finally(() => {
        if (!cancelled) setAlternativesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, altCoords?.lat, altCoords?.lng, plannerArrivalIso]);

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
    loading: warningsLoading,
    alternativesLoading,
    error,
    refresh: refreshWarnings,
  };
}
