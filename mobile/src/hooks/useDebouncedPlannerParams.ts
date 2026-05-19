import { useEffect, useState } from 'react';

export type PlannerParams = {
  arrivalIso: string;
  durationMins: number;
};

export function useDebouncedPlannerParams(
  rawPlanner: PlannerParams | null,
  delayMs = 300,
): PlannerParams | null {
  const [debounced, setDebounced] = useState<PlannerParams | null>(null);

  useEffect(() => {
    if (rawPlanner === null) {
      setDebounced(null);
      return;
    }
    const t = setTimeout(() => setDebounced(rawPlanner), delayMs);
    return () => clearTimeout(t);
  }, [rawPlanner?.arrivalIso, rawPlanner?.durationMins, rawPlanner === null, delayMs]);

  return debounced;
}
