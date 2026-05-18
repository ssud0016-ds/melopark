import { useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';

// Native equivalent of web sr-only live region.
// TalkBack reads `announceForAccessibility` immediately, no DOM trick needed.
export function useAccessibility() {
  const announce = useCallback((message: string) => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, []);
  return { announce };
}
