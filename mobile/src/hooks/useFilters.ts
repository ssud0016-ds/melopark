import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type StatusFilter = 'all' | 'available' | 'caution';
export type DurationFilter = '15m' | '30m' | '1h' | '2h' | '3h' | '4h' | 'custom';

export type FiltersState = {
  statusFilter: StatusFilter;
  durationFilter: DurationFilter;
  customDurationMins: number;
  plannerArrivalIso: string | null;
};

export type FiltersApi = FiltersState & {
  setStatus: (s: StatusFilter) => void;
  setDuration: (d: DurationFilter) => void;
  setCustomDuration: (m: number) => void;
  setArrival: (iso: string | null) => void;
  reset: () => void;
  isDefault: boolean;
  modifiedPills: string[];
  plannerDurationMins: number;
  pressureModeNote: string;
};

const DEFAULT_STATE: FiltersState = {
  statusFilter: 'all',
  durationFilter: '1h',
  customDurationMins: 60,
  plannerArrivalIso: null,
};

const DURATION_MINS: Record<DurationFilter, number> = {
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '3h': 180,
  '4h': 240,
  custom: 60,
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  available: 'Available',
  caution: 'Caution',
};

const DURATION_LABEL: Record<DurationFilter, string> = {
  '15m': '15 min',
  '30m': '30 min',
  '1h': '1H',
  '2h': '2H',
  '3h': '3H',
  '4h': '4H',
  custom: 'Custom',
};

function labelTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  } catch {
    return iso;
  }
}

const Ctx = createContext<FiltersApi | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FiltersState>(DEFAULT_STATE);

  const setStatus = useCallback((s: StatusFilter) => setState((p) => ({ ...p, statusFilter: s })), []);
  const setDuration = useCallback((d: DurationFilter) => setState((p) => ({ ...p, durationFilter: d })), []);
  const setCustomDuration = useCallback(
    (m: number) => setState((p) => ({ ...p, customDurationMins: m, durationFilter: 'custom' })),
    [],
  );
  const setArrival = useCallback((iso: string | null) => setState((p) => ({ ...p, plannerArrivalIso: iso })), []);
  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const api = useMemo<FiltersApi>(() => {
    const plannerDurationMins =
      state.durationFilter === 'custom' ? state.customDurationMins : DURATION_MINS[state.durationFilter];
    const isDefault =
      state.statusFilter === 'all' && state.durationFilter === '1h' && state.plannerArrivalIso == null;

    const pills: string[] = [];
    if (state.statusFilter !== 'all') pills.push(STATUS_LABEL[state.statusFilter]);
    if (state.durationFilter !== '1h') pills.push(DURATION_LABEL[state.durationFilter]);
    if (state.plannerArrivalIso) pills.push(`@${labelTime(state.plannerArrivalIso)}`);

    const pressureModeNote = state.plannerArrivalIso
      ? `Rules checked for ${labelTime(state.plannerArrivalIso)}`
      : 'Live now';

    return {
      ...state,
      setStatus,
      setDuration,
      setCustomDuration,
      setArrival,
      reset,
      isDefault,
      modifiedPills: pills,
      plannerDurationMins,
      pressureModeNote,
    };
  }, [state, setStatus, setDuration, setCustomDuration, setArrival, reset]);

  return createElement(Ctx.Provider, { value: api }, children);
}

export function useFilters(): FiltersApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilters must be inside <FiltersProvider>');
  return ctx;
}
