import { useEffect, useRef, useState } from 'react';

import { fetchPressureManifest, type PressureManifest } from '../services/apiPressure';

const POLL_MS = 60_000;
const MANIFEST_TIMEOUT_MS = 10_000;
const ERR_BACKOFF_START_MS = 10_000;
const ERR_BACKOFF_MAX_MS = 120_000;

export type BusyNowStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useBusyNow(enabled: boolean): {
  manifest: PressureManifest | null;
  status: BusyNowStatus;
  error: Error | null;
} {
  const [manifest, setManifest] = useState<PressureManifest | null>(null);
  const [status, setStatus] = useState<BusyNowStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const errBackoffMsRef = useRef(POLL_MS);

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled) {
      setStatus('idle');
      return () => {
        cancelledRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    setStatus((s) => (s === 'idle' ? 'loading' : s));

    const tick = async () => {
      let nextDelay = POLL_MS;
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), MANIFEST_TIMEOUT_MS);
      try {
        const m = await fetchPressureManifest({ force: false, signal: ctrl.signal });
        if (cancelledRef.current) return;
        setManifest(m);
        setStatus('ready');
        setError(null);
        errBackoffMsRef.current = POLL_MS;
        nextDelay = POLL_MS;
      } catch (e) {
        if (cancelledRef.current) return;
        const timedOut = (e as { name?: string })?.name === 'AbortError';
        setError(timedOut ? new Error('Manifest request timed out') : (e as Error));
        setStatus('error');
        const prev = errBackoffMsRef.current;
        const bump = prev === POLL_MS ? ERR_BACKOFF_START_MS : Math.min(prev * 2, ERR_BACKOFF_MAX_MS);
        errBackoffMsRef.current = bump;
        nextDelay = bump;
      } finally {
        clearTimeout(timeoutId);
        if (!cancelledRef.current) {
          timerRef.current = setTimeout(tick, nextDelay);
        }
      }
    };
    tick();

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return { manifest, status, error };
}
