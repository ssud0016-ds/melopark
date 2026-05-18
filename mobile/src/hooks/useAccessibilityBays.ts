import { useEffect, useMemo, useState } from 'react';

import {
  fetchAccessibilityAll,
  type AccessibilityBayRow,
} from '../services/apiBays';

/** Match web MapPage: small batch fits DO gateway on cold start. */
const ACCESSIBILITY_ALL_TOP_N = 200;

export function useAccessibilityBays(enabled: boolean) {
  const [rows, setRows] = useState<AccessibilityBayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAccessibilityAll({ topN: ACCESSIBILITY_ALL_TOP_N, availableOnly: false })
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data?.bays) ? data.bays : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : 'Could not load accessibility bays');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const accessibleBayIds = useMemo(
    () => (enabled ? rows.map((b) => String(b.bay_id)) : undefined),
    [enabled, rows],
  );

  const accessibleRulesByBayId = useMemo(() => {
    const out: Record<string, AccessibilityBayRow> = {};
    for (const row of rows) {
      const key = String(row?.bay_id ?? '');
      if (key) out[key] = row;
    }
    return out;
  }, [rows]);

  return { accessibleBayIds, accessibleRulesByBayId, loading, error };
}
