import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';

import { sheetSnapPoints } from '../../design-system';
import { useThemeColors } from '../../hooks/useThemeColors';

export type HelpModalRef = {
  present: () => void;
  dismiss: () => void;
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Find parking',
    body: 'Search a destination or tap a colored bay on the map. Green dots mean a sensor says the bay is free right now.',
  },
  {
    title: 'Read the colors',
    body: 'Green = good chance. Amber = getting busy. Red = hard to park now. Gray = no live data.',
  },
  {
    title: 'Filters',
    body: 'Use Filters ▾ to narrow by status (Available/Caution), parking duration, or arrival time.',
  },
  {
    title: 'Bay rules',
    body: 'Tap a bay to see its rule one-liner, restriction warnings, and Navigate CTA.',
  },
];

export const HelpModal = forwardRef<HelpModalRef>((_props, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
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
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.tabActive }}>Help & how to use</Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{s.title}</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20 }}>{s.body}</Text>
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
HelpModal.displayName = 'HelpModal';
