import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const COLOR_BLIND_MODE_STORAGE_KEY = 'melopark-color-blind-mode';

let currentColorBlindMode = false;
const listeners = new Set<(enabled: boolean) => void>();

function parseStored(value: string | null) {
  return value === 'true' ? true : value === 'false' ? false : null;
}

function publish(enabled: boolean) {
  currentColorBlindMode = enabled;
  listeners.forEach((listener) => listener(enabled));
}

export function useColorBlindMode() {
  const [enabled, setEnabledState] = useState(currentColorBlindMode);

  useEffect(() => {
    listeners.add(setEnabledState);
    let mounted = true;
    AsyncStorage.getItem(COLOR_BLIND_MODE_STORAGE_KEY)
      .then((stored) => {
        const parsed = parseStored(stored);
        if (!mounted) return;
        if (parsed == null) {
          if (stored) AsyncStorage.removeItem(COLOR_BLIND_MODE_STORAGE_KEY).catch(() => {});
          return;
        }
        publish(parsed);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      listeners.delete(setEnabledState);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    publish(next);
    AsyncStorage.setItem(COLOR_BLIND_MODE_STORAGE_KEY, next ? 'true' : 'false').catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!currentColorBlindMode);
  }, [setEnabled]);

  return { enabled, setEnabled, toggle };
}
