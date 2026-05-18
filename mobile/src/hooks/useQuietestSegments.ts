import { useEffect, useRef, useState } from 'react';

import { fetchQuietestSegments, type PressureBounds } from '../services/apiPressure';
import { boundsToKey } from '../utils/mapBounds';

const DEBOUNCE_MS = 300;

export function useQuietestSegments({
  bounds,
  enabled,
}: {
  bounds: PressureBounds | null;
  enabled: boolean;
}): { segments: unknown[]; loading: boolean; error: string | null } {
  const [segments, setSegments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boundsRef = useRef<PressureBounds | null>(bounds);
  boundsRef.current = bounds;
  const boundsKey = boundsToKey(bounds);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || !boundsKey) {
      setLoading(false);
      if (!enabled) {
        setSegments([]);
        setError(null);
      }
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const run = () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const b = boundsRef.current;
      if (!b) return;

      setLoading(true);
      setError(null);
      fetchQuietestSegments(b, 150, { signal: ctrl.signal })
        .then((data) => {
          if (ctrl.signal.aborted) return;
          setSegments(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setSegments([]);
          setError(err instanceof Error ? err.message : 'Failed to load quiet streets');
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    };

    timerRef.current = setTimeout(run, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [boundsKey, enabled]);

  return { segments, loading, error };
}
