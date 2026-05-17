import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const ONBOARDING_KEY = 'melopark-onboarding-v1';

export function useOnboarding() {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((seen) => setNeedsOnboarding(seen !== 'true'))
      .catch(() => setNeedsOnboarding(false));
  }, []);

  const complete = useCallback(async () => {
    setNeedsOnboarding(false);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // best-effort
    }
  }, []);

  const reset = useCallback(async () => {
    setNeedsOnboarding(true);
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
    } catch {
      // best-effort
    }
  }, []);

  return { needsOnboarding, complete, reset };
}
