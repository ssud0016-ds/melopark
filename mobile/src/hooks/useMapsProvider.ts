import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const MAPS_PROVIDER_STORAGE_KEY = 'melopark-maps-provider';
export type MapsProvider = 'google' | 'web';

const VALID: ReadonlySet<MapsProvider> = new Set(['google', 'web']);

function isValid(value: string | null): value is MapsProvider {
  return value !== null && VALID.has(value as MapsProvider);
}

export function useMapsProvider() {
  const [provider, setProviderState] = useState<MapsProvider | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(MAPS_PROVIDER_STORAGE_KEY)
      .then((stored) => {
        if (mounted && isValid(stored)) setProviderState(stored);
        else if (stored) AsyncStorage.removeItem(MAPS_PROVIDER_STORAGE_KEY).catch(() => {});
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setProvider = useCallback((p: MapsProvider) => {
    if (!VALID.has(p)) return;
    setProviderState(p);
    AsyncStorage.setItem(MAPS_PROVIDER_STORAGE_KEY, p).catch(() => {});
  }, []);

  const clearProvider = useCallback(() => {
    setProviderState(null);
    AsyncStorage.removeItem(MAPS_PROVIDER_STORAGE_KEY).catch(() => {});
  }, []);

  return { provider, setProvider, clearProvider };
}
