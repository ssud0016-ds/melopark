import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type MapFlyTarget = {
  lat: number;
  lng: number;
  label?: string;
};

type MapFlyTargetApi = {
  flyTarget: MapFlyTarget | null;
  setFlyTarget: (t: MapFlyTarget | null) => void;
  consumeFlyTarget: () => MapFlyTarget | null;
};

const Ctx = createContext<MapFlyTargetApi | null>(null);

export function MapFlyTargetProvider({ children }: { children: ReactNode }) {
  const [flyTarget, setFlyTargetState] = useState<MapFlyTarget | null>(null);
  const flyTargetRef = useRef<MapFlyTarget | null>(null);

  const setFlyTarget = useCallback((t: MapFlyTarget | null) => {
    flyTargetRef.current = t;
    setFlyTargetState(t);
  }, []);

  const consumeFlyTarget = useCallback(() => {
    const out = flyTargetRef.current;
    flyTargetRef.current = null;
    setFlyTargetState(null);
    return out;
  }, []);

  const api = useMemo(
    () => ({ flyTarget, setFlyTarget, consumeFlyTarget }),
    [flyTarget, setFlyTarget, consumeFlyTarget],
  );

  return createElement(Ctx.Provider, { value: api }, children);
}

export function useMapFlyTarget(): MapFlyTargetApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMapFlyTarget must be inside <MapFlyTargetProvider>');
  return ctx;
}
