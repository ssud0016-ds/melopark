import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, haptics, sheetSnapPoints } from '../../design-system';
import { useMapsProvider, type MapsProvider } from '../../hooks/useMapsProvider';
import type { RootStackParamList } from '../../navigation/types';

export type SettingsSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  colorBlindMode: boolean;
  onToggleColorBlind: (next: boolean) => void;
  accessibleOnly: boolean;
  onToggleAccessible: (next: boolean) => void;
  onOpenHelp: () => void;
};

const DARK_MODE_KEY = 'melopark-dark-mode';
type ThemeMode = 'light' | 'dark' | 'system';

const Nav: ThemeMode[] = ['light', 'dark', 'system'];

export const SettingsSheet = forwardRef<SettingsSheetRef, Props>((props, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snaps = useMemo(() => [...sheetSnapPoints], []);
  const { colorScheme, setColorScheme } = useColorScheme();
  const { provider, setProvider } = useMapsProvider();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [theme, setTheme] = useState<ThemeMode>((colorScheme as ThemeMode) ?? 'system');

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const applyTheme = useCallback(
    (next: ThemeMode) => {
      setTheme(next);
      setColorScheme(next);
      AsyncStorage.setItem(DARK_MODE_KEY, next).catch(() => {});
    },
    [setColorScheme],
  );

  const goto = (target: 'About' | 'Attribution' | 'Terms') => {
    sheetRef.current?.dismiss();
    setTimeout(() => navigation.navigate(target), 120);
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snaps}
      index={1}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceDarkTertiary, width: 32, height: 4 }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand }}>Settings</Text>

        <Section title="Appearance">
          <ChipRow>
            {Nav.map((m) => (
              <Chip key={m} active={theme === m} onPress={() => applyTheme(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </Chip>
            ))}
          </ChipRow>
        </Section>

        <Section title="Map Display">
          <ToggleRow
            label="Color-blind palette"
            value={props.colorBlindMode}
            onChange={props.onToggleColorBlind}
          />
        </Section>

        <Section title="Accessibility">
          <ToggleRow
            label="Accessible bays only"
            value={props.accessibleOnly}
            onChange={props.onToggleAccessible}
          />
        </Section>

        <Section title="Navigation">
          <ChipRow>
            {(['google', 'web'] as MapsProvider[]).map((p) => (
              <Chip
                key={p}
                active={provider === p}
                onPress={() => {
                  haptics.selection();
                  setProvider(p);
                }}
              >
                {p === 'google' ? 'Google Maps' : 'Browser'}
              </Chip>
            ))}
          </ChipRow>
        </Section>

        <Section title="Help & About">
          <LinkRow label="Help & How to use" onPress={() => { sheetRef.current?.dismiss(); setTimeout(props.onOpenHelp, 120); }} />
          <LinkRow label="Attribution" onPress={() => goto('Attribution')} />
          <LinkRow label="Terms of Use" onPress={() => goto('Terms')} />
          <LinkRow label="About MelOPark" onPress={() => goto('About')} />
          <Text style={{ fontSize: 11, color: colors.surfaceDarkTertiary, marginTop: 8 }}>
            MelOPark v1.0 · Data: City of Melbourne + VicRoads
          </Text>
        </Section>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
SettingsSheet.displayName = 'SettingsSheet';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.surfaceDarkTertiary, letterSpacing: 1 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

function Chip({
  children,
  active,
  onPress,
}: {
  children: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.brand : colors.surfaceTertiary,
      }}
    >
      <Text style={{ color: active ? colors.surface : colors.surfaceDark, fontWeight: '600', fontSize: 13 }}>
        {children}
      </Text>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.surfaceDark }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand }} />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 14, color: colors.surfaceDark }}>{label}</Text>
      <Text style={{ fontSize: 16, color: colors.surfaceDarkTertiary }}>›</Text>
    </Pressable>
  );
}
