import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Landmark } from '../data/landmarks';

export type AltPin = {
  segmentId?: string | null;
  bayId?: string | null;
  lat: number;
  lng: number;
  label: string;
};

type DestinationApi = {
  destination: Landmark | null;
  setDestination: (d: Landmark | null) => void;
  clearDestination: () => void;
  altPin: AltPin | null;
  setAltPin: (a: AltPin | null) => void;
};

const Ctx = createContext<DestinationApi | null>(null);

export function DestinationProvider({ children }: { children: ReactNode }) {
  const [destination, setDestinationState] = useState<Landmark | null>(null);
  const [altPin, setAltPinState] = useState<AltPin | null>(null);

  const setDestination = useCallback((d: Landmark | null) => {
    setDestinationState(d);
    if (!d) setAltPinState(null);
  }, []);
  const clearDestination = useCallback(() => {
    setDestinationState(null);
    setAltPinState(null);
  }, []);
  const setAltPin = useCallback((a: AltPin | null) => setAltPinState(a), []);

  const api = useMemo(
    () => ({ destination, setDestination, clearDestination, altPin, setAltPin }),
    [destination, setDestination, clearDestination, altPin, setAltPin],
  );

  return createElement(Ctx.Provider, { value: api }, children);
}

export function useDestination(): DestinationApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDestination must be inside <DestinationProvider>');
  return ctx;
}
