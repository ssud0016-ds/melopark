import { useCallback, useEffect, useRef, useState } from 'react';

import type { Landmark } from '../data/landmarks';
import { fetchAlternatives } from '../services/apiPressure';
import type { AlternativesResponse } from '../types/pressureAlternatives';

export function useDestinationAlternatives({
  destination,
  enabled,
}: {
  destination: Landmark | null;
  enabled: boolean;
}): {
  data: AlternativesResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [data, setData] = useState<AlternativesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  useEffect(() => {
    const lat = destination?.lat;
    const lng = destination?.lng;
    if (!enabled || typeof lat !== 'number' || typeof lng !== 'number') {
      abortRef.current?.abort();
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    fetchAlternatives({ lat, lon: lng, signal: ctrl.signal })
      .then((raw) => {
        if (ctrl.signal.aborted) return;
        setData((raw as AlternativesResponse) ?? null);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setData(null);
        setError(err instanceof Error ? err.message : 'Alternatives unavailable');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => {
      ctrl.abort();
    };
  }, [destination?.lat, destination?.lng, enabled, retryKey]);

  return { data, loading, error, retry };
}
