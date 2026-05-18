import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'never-asked';

// Plan §Phase 3. expo-location wraps Android FINE/COARSE prompt.
// Re-checks on app foreground so post-Settings grant is reflected.
export function useLocationPermission() {
  const [state, setState] = useState<LocationPermissionState>('unknown');
  const [canAskAgain, setCanAskAgain] = useState(true);

  const refresh = useCallback(async () => {
    const status = await Location.getForegroundPermissionsAsync();
    setCanAskAgain(status.canAskAgain);
    if (status.status === Location.PermissionStatus.GRANTED) setState('granted');
    else if (status.status === Location.PermissionStatus.DENIED)
      setState(status.canAskAgain ? 'never-asked' : 'denied');
    else setState('never-asked');
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async (): Promise<boolean> => {
    const res = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(res.canAskAgain);
    if (res.status === Location.PermissionStatus.GRANTED) {
      setState('granted');
      return true;
    }
    setState(res.canAskAgain ? 'never-asked' : 'denied');
    return false;
  }, []);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  return { state, canAskAgain, request, openSettings, refresh };
}
