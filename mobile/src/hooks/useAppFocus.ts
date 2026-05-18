import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Plan §Phase 3 lifecycle refresh: fire callback on background → active transition.
// Used by useBays to repoll when user returns from elsewhere.
export function useAppFocus(callback: () => void) {
  const prevState = useRef<AppStateStatus>(AppState.currentState);
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (prevState.current.match(/inactive|background/) && state === 'active') {
        cb.current();
      }
      prevState.current = state;
    });
    return () => sub.remove();
  }, []);
}
