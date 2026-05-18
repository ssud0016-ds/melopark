import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchForecastAlternatives,
  fetchForecastPressure,
  fetchForecastWarnings,
  type ForecastAlternativesResponse,
  type ForecastPressureResponse,
  type ForecastWarning,
  type PressureZone,
  type WarningLevel,
} from '../services/apiForecasts';

const POLL_MS = 5 * 60 * 1000;
export const LEVEL_ORDER: Record<WarningLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

type Destination = { lat: number; lng: number } | null;

function hasValidCoordinates(value: Destination): value is NonNullable<Destination> {
  return (
    !!value &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng)
  );
}

export function sortPressureZones(zones: PressureZone[], direction: 'busy' | 'quiet' = 'busy') {
  return [...zones].sort((a, b) => {
    const levelDelta =
      direction === 'busy'
        ? (LEVEL_ORDER[b.pressure_level] || 0) - (LEVEL_ORDER[a.pressure_level] || 0)
        : (LEVEL_ORDER[a.pressure_level] || 0) - (LEVEL_ORDER[b.pressure_level] || 0);
    return levelDelta || a.zone.localeCompare(b.zone);
  });
}

export function useParkingForecast({
  destination = null,
  pressureLocation = null,
  plannerArrivalIso = null,
  enabled = true,
  hoursAhead = 6,
}: {
  destination?: Destination;
  pressureLocation?: Destination;
  plannerArrivalIso?: string | null;
  enabled?: boolean;
  hoursAhead?: number;
} = {}) {
  const [warnings, setWarnings] = useState<ForecastWarning[]>([]);
  const [pressure, setPressure] = useState<ForecastPressureResponse | null>(null);
  const [alternatives, setAlternatives] = useState<ForecastAlternativesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [pressureLoading, setPressureLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pressureError, setPressureError] = useState<string | null>(null);

  const refreshWarnings = useCallback(async () => {
    if (!enabled) return;
    setWarningsLoading(true);
    try {
      const data = await fetchForecastWarnings(hoursAhead);
      setWarnings(data.warnings ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'forecast warnings failed');
    } finally {
      setWarningsLoading(false);
    }
  }, [enabled, hoursAhead]);

  const refreshPressure = useCallback(async () => {
    if (!enabled) return;
    const pressureCoordinates = pressureLocation ?? destination;
    if (!hasValidCoordinates(pressureCoordinates)) {
      setPressure(null);
      setPressureError(null);
      setPressureLoading(false);
      return;
    }
    setPressureLoading(true);
    try {
      const data = await fetchForecastPressure(
        pressureCoordinates.lat,
        pressureCoordinates.lng,
        plannerArrivalIso || null,
      );
      setPressure(data);
      setPressureError(null);
    } catch (e) {
      setPressureError(e instanceof Error ? e.message : 'forecast pressure failed');
    } finally {
      setPressureLoading(false);
    }
  }, [
    enabled,
    plannerArrivalIso,
    pressureLocation?.lat,
    pressureLocation?.lng,
    destination?.lat,
    destination?.lng,
  ]);

  const refresh = useCallback(() => {
    refreshWarnings();
    refreshPressure();
  }, [refreshPressure, refreshWarnings]);

  useEffect(() => {
    if (!enabled) {
      setWarnings([]);
      setPressure(null);
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !hasValidCoordinates(destination)) {
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

  const pressureZones = useMemo(
    () => sortPressureZones(pressure?.zones ?? [], 'busy'),
    [pressure?.zones],
  );

  const quietestZones = useMemo(
    () => sortPressureZones(pressure?.zones ?? [], 'quiet').slice(0, 5),
    [pressure?.zones],
  );

  const busiestZones = useMemo(() => pressureZones.slice(0, 5), [pressureZones]);

  return {
    warnings,
    zoneWarnings,
    pressure,
    pressureZones,
    busiestZones,
    quietestZones,
    worstLevel,
    alternatives,
    loading: loading || warningsLoading || pressureLoading,
    warningsLoading,
    pressureLoading,
    error,
    pressureError,
    arrivalIso: plannerArrivalIso,
    refresh,
  };
}
