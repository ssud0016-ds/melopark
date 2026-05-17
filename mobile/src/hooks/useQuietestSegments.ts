import { useEffect, useRef, useState } from 'react';

import { fetchQuietestSegments, type PressureBounds } from '../services/apiPressure';

const DEBOUNCE_MS = 500;

export function useQuietestSegments({
  bounds,
  enabled,
}: {
  bounds: PressureBounds | null;
  enabled: boolean;
}): { segments: unknown[]; loading: boolean } {
  const [segments, setSegments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !bounds) {
      setSegments([]);
      setLoading(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      fetchQuietestSegments(bounds, 150, { signal: ctrl.signal })
        .then((data) => {
          if (ctrl.signal.aborted) return;
          setSegments(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setSegments([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [bounds, enabled]);

  return { segments, loading };
}
