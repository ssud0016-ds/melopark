import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, haptics, sheetSnapPoints } from '../../design-system';
import { useFilters, type DurationFilter, type StatusFilter } from '../../hooks/useFilters';
import { useThemeColors, type ThemeColors } from '../../hooks/useThemeColors';

export type FilterSheetRef = {
  present: () => void;
  dismiss: () => void;
};

const STATUS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'caution', label: 'Caution' },
];

const DURATIONS: { value: DurationFilter; label: string }[] = [
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1H' },
  { value: '2h', label: '2H' },
  { value: '3h', label: '3H' },
  { value: '4h', label: '4H' },
];

export const FilterSheet = forwardRef<FilterSheetRef>((_props, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const filters = useFilters();
  const theme = useThemeColors();
  const snaps = useMemo(() => [...sheetSnapPoints], []);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snaps}
      index={1}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: theme.sheet }}
      handleIndicatorStyle={{ backgroundColor: theme.handle, width: 32, height: 4 }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Filters</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.light();
              sheetRef.current?.dismiss();
            }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text style={{ color: theme.tabActive, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>

        <Group title="Status" theme={theme}>
          <ChipRow>
            {STATUS.map((s) => (
              <Chip
                key={s.value}
                theme={theme}
                active={filters.statusFilter === s.value}
                onPress={() => {
                  haptics.selection();
                  filters.setStatus(s.value);
                }}
              >
                {s.label}
              </Chip>
            ))}
          </ChipRow>
        </Group>

        <Group title="Duration" theme={theme}>
          <ChipRow>
            {DURATIONS.map((d) => (
              <Chip
                key={d.value}
                theme={theme}
                active={filters.durationFilter === d.value}
                onPress={() => {
                  haptics.selection();
                  filters.setDuration(d.value);
                }}
              >
                {d.label}
              </Chip>
            ))}
            <Chip
              theme={theme}
              active={filters.durationFilter === 'custom'}
              onPress={() => {
                haptics.selection();
                filters.setDuration('custom');
              }}
            >
              Custom
            </Chip>
          </ChipRow>
        </Group>

        <Group title="Arrive by" theme={theme}>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            {filters.plannerArrivalIso ? `Arriving ${filters.plannerArrivalIso}` : 'Live now (no arrival set)'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip
              theme={theme}
              active={filters.plannerArrivalIso == null}
              onPress={() => {
                haptics.selection();
                filters.setArrival(null);
              }}
            >
              Live now
            </Chip>
            <Chip
              theme={theme}
              active={!!filters.plannerArrivalIso}
              onPress={() => {
                haptics.selection();
                const d = new Date(Date.now() + 30 * 60_000);
                filters.setArrival(d.toISOString());
              }}
            >
              +30 min
            </Chip>
            <Chip
              theme={theme}
              active={false}
              onPress={() => {
                haptics.selection();
                const d = new Date(Date.now() + 60 * 60_000);
                filters.setArrival(d.toISOString());
              }}
            >
              +1 hr
            </Chip>
          </View>
        </Group>

        {!filters.isDefault ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              filters.reset();
            }}
            style={{
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Reset filters</Text>
          </Pressable>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
FilterSheet.displayName = 'FilterSheet';

function Group({ title, children, theme }: { title: string; children: React.ReactNode; theme: ThemeColors }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1 }}>
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
  theme,
}: {
  children: React.ReactNode;
  active: boolean;
  onPress: () => void;
  theme: ThemeColors;
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
        backgroundColor: active ? colors.brand : theme.chromeMuted,
      }}
    >
      <Text style={{ color: active ? theme.brandOnBrand : theme.text, fontWeight: '600', fontSize: 13 }}>
        {children}
      </Text>
    </Pressable>
  );
}
