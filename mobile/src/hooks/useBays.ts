import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchParkingBays, type Bay } from '../services/apiBays';
import { baysMapFingerprint } from '../utils/baysMapFingerprint';
import { useAppFocus } from './useAppFocus';

const POLL_MS = 10_000;

export function useBays() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapFingerprintRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const raw = await fetchParkingBays();
      const fp = baysMapFingerprint(raw);
      if (fp !== mapFingerprintRef.current) {
        mapFingerprintRef.current = fp;
        setBays(raw);
        setLastUpdated(new Date());
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load parking data');
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Plan §Phase 3: refresh on app-foreground transition.
  useAppFocus(refresh);

  const availableBayCount = bays.filter((b) => b.type === 'available').length;
  const totalFreeSpots = bays.filter((b) => b.type === 'available').reduce((sum, b) => sum + (b.free ?? 0), 0);

  return { bays, lastUpdated, loading, error, refresh, availableBayCount, totalFreeSpots };
}
