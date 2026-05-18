import { useCallback } from 'react';
import { useColorScheme as useNwColorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

export const DARK_MODE_STORAGE_KEY = 'melopark-dark-mode';

// Thin wrapper over nativewind's useColorScheme.
// Plan §5: replaces web useDarkMode (localStorage + matchMedia) — nativewind
// handles system theme + persistence + system-change listener automatically.
export function useDarkMode(): {
  dark: boolean;
  toggle: () => void;
  setTheme: (mode: ThemeMode) => void;
} {
  const { colorScheme, setColorScheme, toggleColorScheme } = useNwColorScheme();

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setColorScheme(mode);
    },
    [setColorScheme],
  );

  return {
    dark: colorScheme === 'dark',
    toggle: toggleColorScheme,
    setTheme,
  };
}
