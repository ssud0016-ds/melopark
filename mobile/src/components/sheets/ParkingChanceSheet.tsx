import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, sheetSnapPoints, SNAP_HALF, SNAP_PEEK } from '../../design-system';
import type { Landmark } from '../../data/landmarks';
import type { AltPin } from '../../hooks/useDestination';

export type ParkingChanceSheetRef = {
  snapTo: (index: number) => void;
  expand: () => void;
  collapse: () => void;
  getIndex: () => number;
};

export type QuietStreet = {
  id: string;
  name: string;
  freeBays: number;
  walkM: number;
  status: 'good' | 'caution' | 'avoid' | 'unknown';
};

type Props = {
  destination: Landmark | null;
  altPin: AltPin | null;
  quietStreets: QuietStreet[];
  pressureModeNote: string;
  onAlternativeClick?: (s: QuietStreet) => void;
  onStreetClick?: (id: string) => void;
  onClearSelectedSuggestion: () => void;
  onSheetIndexChange?: (i: number) => void;
};

const STATUS_LABEL: Record<QuietStreet['status'], string> = {
  good: 'Good chance',
  caution: 'Getting busy',
  avoid: 'Hard to park now',
  unknown: 'No live data',
};
const STATUS_COLOR: Record<QuietStreet['status'], string> = {
  good: colors.statusGood,
  caution: colors.statusCaution,
  avoid: colors.statusAvoid,
  unknown: colors.statusUnknown,
};

export const ParkingChanceSheet = forwardRef<ParkingChanceSheetRef, Props>((props, ref) => {
  const {
    destination,
    altPin,
    quietStreets,
    pressureModeNote,
    onAlternativeClick,
    onStreetClick,
    onClearSelectedSuggestion,
    onSheetIndexChange,
  } = props;

  const sheetRef = useRef<BottomSheet>(null);
  const indexRef = useRef(SNAP_PEEK);

  useImperativeHandle(ref, () => ({
    snapTo: (i) => sheetRef.current?.snapToIndex(i),
    expand: () => sheetRef.current?.expand(),
    collapse: () => sheetRef.current?.collapse(),
    getIndex: () => indexRef.current,
  }));

  const snaps = useMemo(() => [...sheetSnapPoints], []);

  const recommended = quietStreets[0];
  const others = quietStreets.slice(1, 3);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snaps}
      index={destination ? SNAP_HALF : SNAP_PEEK}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.surfaceDarkTertiary, width: 32, height: 4 }}
      onChange={(i) => {
        indexRef.current = i;
        onSheetIndexChange?.(i);
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.surfaceDark }}>
            {destination ? `Near ${destination.name}` : 'Parking chance nearby'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>{pressureModeNote}</Text>
        </View>

        {altPin ? (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.statusGoodBg,
              borderWidth: 1,
              borderColor: '#bbf7d0',
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.statusGood, letterSpacing: 1 }}>
                YOUR PICK
              </Text>
              <Pressable accessibilityRole="button" onPress={onClearSelectedSuggestion} hitSlop={8}>
                <Text style={{ fontSize: 12, color: colors.brand, fontWeight: '600' }}>Clear</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>{altPin.label}</Text>
            <Text style={{ fontSize: 12, color: colors.statusGood, fontWeight: '500' }}>Good chance · selected</Text>
          </View>
        ) : null}

        {recommended ? (
          <Section title="RECOMMENDED">
            <StreetRow s={recommended} onPress={() => onAlternativeClick?.(recommended)} />
          </Section>
        ) : null}

        {others.length > 0 ? (
          <Section title="OTHER QUIET STREETS">
            {others.map((s) => (
              <StreetRow key={s.id} s={s} onPress={() => onStreetClick?.(s.id)} />
            ))}
          </Section>
        ) : null}

        {quietStreets.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.surfaceDarkTertiary }}>
            No quiet streets nearby right now.
          </Text>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});
ParkingChanceSheet.displayName = 'ParkingChanceSheet';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.surfaceDarkTertiary, letterSpacing: 1 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function StreetRow({ s, onPress }: { s: QuietStreet; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 44,
        paddingVertical: 8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[s.status] }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>{s.name}</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: STATUS_COLOR[s.status] }}>
          {STATUS_LABEL[s.status]} · {s.freeBays} bays · {Math.round(s.walkM)}m
        </Text>
      </View>
    </Pressable>
  );
}
