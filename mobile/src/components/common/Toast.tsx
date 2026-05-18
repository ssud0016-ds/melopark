import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion } from '../../design-system';

type ToastTone = 'info' | 'success' | 'warning' | 'error';

type ToastState = { message: string; tone: ToastTone } | null;

type ToastApi = {
  show: (message: string, tone?: ToastTone, durationMs?: number) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONE_COLOR: Record<ToastTone, string> = {
  info: colors.brand,
  success: colors.statusGood,
  warning: colors.statusCaution,
  error: colors.statusAvoid,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    opacity.value = withTiming(0, { duration: motion.fast });
    setTimeout(() => setState(null), motion.fast);
  }, [opacity]);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info', durationMs = 3000) => {
      setState({ message, tone });
      opacity.value = withTiming(1, { duration: motion.fast });
      AccessibilityInfo.announceForAccessibility(message);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, durationMs);
    },
    [opacity, dismiss],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ToastContext.Provider value={api}>
      {children}
      {state ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: insets.bottom + 80,
              padding: 12,
              borderRadius: 12,
              backgroundColor: TONE_COLOR[state.tone],
              zIndex: 1200,
            },
            style,
          ]}
        >
          <Text style={{ color: colors.surface, textAlign: 'center', fontWeight: '600' }}>
            {state.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
