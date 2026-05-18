import { renderHook } from '@testing-library/react-native';

import { colors } from '../../design-system';
import { getThemeColors, useThemeColors } from '../useThemeColors';

jest.mock('../useDarkMode', () => ({
  useDarkMode: jest.fn(() => ({ dark: false, toggle: jest.fn(), setTheme: jest.fn() })),
}));

const { useDarkMode } = jest.requireMock('../useDarkMode') as {
  useDarkMode: jest.Mock;
};

describe('getThemeColors', () => {
  test('light mode uses white surfaces and dark ink', () => {
    const t = getThemeColors(false);
    expect(t.sheet).toBe(colors.surface);
    expect(t.chrome).toBe(colors.surface);
    expect(t.text).toBe(colors.surfaceDark);
    expect(t.tabActive).toBe(colors.brand);
  });

  test('dark mode uses surface-dark tokens from design system', () => {
    const t = getThemeColors(true);
    expect(t.sheet).toBe(colors.surfaceDark);
    expect(t.chrome).toBe(colors.surfaceDarkSecondary);
    expect(t.chromeMuted).toBe(colors.surfaceDarkTertiary);
    expect(t.tabActive).toBe(colors.brandLight);
    expect(t.text).toBe('#f3f4f6');
  });
});

describe('useThemeColors', () => {
  test('follows useDarkMode', () => {
    useDarkMode.mockReturnValue({ dark: true, toggle: jest.fn(), setTheme: jest.fn() });
    const { result } = renderHook(() => useThemeColors());
    expect(result.current.sheet).toBe('#111827');
    useDarkMode.mockReturnValue({ dark: false, toggle: jest.fn(), setTheme: jest.fn() });
    const { result: light } = renderHook(() => useThemeColors());
    expect(light.current.sheet).toBe('#ffffff');
  });
});
