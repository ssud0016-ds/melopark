import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors, haptics } from '../../design-system';
import {
  fetchBayCarbon,
  fetchBayEvaluation,
  type BayCarbon,
  type BayEvaluation,
} from '../../services/apiBays';

const SNAP_POINTS = ['50%', '90%'];
const SNAP_FULL_INDEX = 1;

export type BayDetailSheetRef = {
  present: (bayId: string) => void;
  dismiss: () => void;
  snapTo: (index: number) => void;
  getIndex: () => number;
};

type Props = {
  onNavigateCta?: (bayId: string) => void;
  onSheetIndexChange?: (index: number) => void;
};

export const BayDetailSheet = forwardRef<BayDetailSheetRef, Props>(
  ({ onNavigateCta, onSheetIndexChange }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const indexRef = useRef(-1);
    const [bayId, setBayId] = useState<string | null>(null);
    const [evaluation, setEvaluation] = useState<BayEvaluation | null>(null);
    const [carbon, setCarbon] = useState<BayCarbon | null>(null);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      present: (id: string) => {
        setBayId(id);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
      snapTo: (i: number) => sheetRef.current?.snapToIndex(i),
      getIndex: () => indexRef.current,
    }));

    useEffect(() => {
      if (!bayId) return;
      let cancelled = false;
      setLoading(true);
      setEvaluation(null);
      setCarbon(null);
      Promise.all([fetchBayEvaluation(bayId), fetchBayCarbon(bayId)])
        .then(([ev, cb]) => {
          if (cancelled) return;
          setEvaluation(ev);
          setCarbon(cb);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [bayId]);

    const verdictColor =
      evaluation?.verdict === 'yes'
        ? colors.statusGood
        : evaluation?.verdict === 'no'
          ? colors.statusAvoid
          : colors.statusUnknown;

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.surfaceDarkTertiary }}
        onChange={(i) => {
          indexRef.current = i;
          onSheetIndexChange?.(i);
        }}
        onDismiss={() => {
          indexRef.current = -1;
          onSheetIndexChange?.(-1);
        }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '500',
                color: colors.brand,
                textTransform: 'uppercase',
              }}
            >
              Bay
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.surfaceDark }}>
              {bayId ? `Bay ${bayId}` : 'Loading…'}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : evaluation ? (
            <>
              <VerdictCard
                verdict={evaluation.verdict}
                reason={evaluation.reason}
                color={verdictColor}
              />

              {evaluation.active_restriction ? (
                <Card title="Active restriction">
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>
                    {evaluation.active_restriction.typedesc}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>
                    {evaluation.active_restriction.plain_english}
                  </Text>
                  {evaluation.active_restriction.max_stay_mins != null ? (
                    <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>
                      Max stay: {evaluation.active_restriction.max_stay_mins} min
                    </Text>
                  ) : null}
                </Card>
              ) : null}

              {evaluation.warning ? (
                <Card title="Warning" tint={colors.statusCautionBg}>
                  <Text style={{ fontSize: 13, color: colors.surfaceDark }}>
                    {evaluation.warning.description}
                  </Text>
                </Card>
              ) : null}

              {carbon ? (
                <Card title="Carbon savings">
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.surfaceDark }}>
                    Score: {carbon.score}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.surfaceDarkTertiary }}>
                    ~{Math.round(carbon.saved_g)} g CO₂ saved ·{' '}
                    {Math.round(carbon.pct_avoided * 100)}% avoided
                  </Text>
                </Card>
              ) : null}
            </>
          ) : (
            <Text style={{ color: colors.surfaceDarkTertiary }}>Bay evaluation unavailable.</Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!bayId}
            onPress={() => {
              if (!bayId) return;
              haptics.medium();
              onNavigateCta?.(bayId);
            }}
            style={{
              minHeight: 48,
              borderRadius: 12,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: colors.surface, fontWeight: '600' }}>Navigate</Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);
BayDetailSheet.displayName = 'BayDetailSheet';

export { SNAP_FULL_INDEX };

function VerdictCard({
  verdict,
  reason,
  color,
}: {
  verdict: 'yes' | 'no' | 'unknown';
  reason: string;
  color: string;
}) {
  const label = verdict === 'yes' ? 'OK to park' : verdict === 'no' ? 'Avoid' : 'Unknown';
  return (
    <View
      style={{
        gap: 6,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surfaceTertiary,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color }}>{label}</Text>
      <Text style={{ fontSize: 13, color: colors.surfaceDark }}>{reason}</Text>
    </View>
  );
}

function Card({
  title,
  children,
  tint,
}: {
  title: string;
  children: React.ReactNode;
  tint?: string;
}) {
  return (
    <View
      style={{
        gap: 6,
        padding: 14,
        borderRadius: 14,
        backgroundColor: tint ?? colors.surfaceTertiary,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '500',
          color: colors.surfaceDarkTertiary,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
